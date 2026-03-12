import { useState, useCallback, useMemo, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { TreeEntry } from '../types';
import { isFullHtmlDocument } from './HtmlPreview';

interface MarkdownProps {
  children: string;
  /** Flat set of relative file paths in the workspace (e.g. "src/index.ts") */
  workspaceFiles?: Set<string>;
  /** Called when user clicks a recognised file reference */
  onFileClick?: (relativePath: string) => void;
}

/** Build a flat set of all relative file paths from a tree */
export function flattenTree(entries: TreeEntry[], prefix = ''): Set<string> {
  const out = new Set<string>();
  for (const e of entries) {
    const rel = prefix ? `${prefix}/${e.name}` : e.name;
    if (e.type === 'file') out.add(rel);
    if (e.children) {
      for (const p of flattenTree(e.children, rel)) out.add(p);
    }
  }
  return out;
}

/** Simple file-extension → emoji mapping */
function fileEmoji(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    ts: '🟦', tsx: '🟦', js: '🟨', jsx: '🟨', json: '📋', css: '🎨', html: '🌐',
    md: '📝', py: '🐍', rs: '🦀', go: '🐹', yaml: '⚙️', yml: '⚙️', toml: '⚙️',
    sh: '🖥', bash: '🖥', zsh: '🖥', txt: '📄', svg: '🖼', png: '🖼', jpg: '🖼',
  };
  return map[ext] ?? '📄';
}

/** Inline copy button for code blocks */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [text]);
  return (
    <button className="md-copy-btn" onClick={handleCopy} title="Copy">
      {copied ? '✓' : '⎘'}
    </button>
  );
}

/** Collapsible code block — collapsed by default for long blocks */
function CollapsibleCode({ lang, code, className, children, rest }: {
  lang: string;
  code: string;
  className?: string;
  children: React.ReactNode;
  rest: Record<string, unknown>;
}) {
  const lines = code.split('\n').length;
  const isLong = lines > 15;
  const [open, setOpen] = useState(!isLong);

  return (
    <div className="md-code-block">
      <div className="md-code-header">
        <button className="md-code-collapse" onClick={() => setOpen(v => !v)}>
          <span className="md-code-chevron">{open ? '▾' : '▸'}</span>
          <span className="md-code-lang">{lang}</span>
          {!open && <span className="md-code-lines">{lines} lines</span>}
        </button>
        <CopyButton text={code} />
      </div>
      {open && (
        <pre className="md-pre"><code className={className} {...rest}>{children}</code></pre>
      )}
      {!open && (
        <div className="md-code-collapsed-hint" onClick={() => setOpen(true)}>
          {lines} lines — click to expand
        </div>
      )}
    </div>
  );
}

export default function Markdown({ children, workspaceFiles, onFileClick }: MarkdownProps) {
  /** Check if a string looks like a workspace file path */
  const resolveFile = useMemo(() => {
    if (!workspaceFiles || workspaceFiles.size === 0) return (_s: string) => null;

    // Build a name→path map so bare filenames like "package.json" match
    const nameMap = new Map<string, string | null>(); // null = ambiguous (multiple files share the name)
    // Build a suffix index for partial-path matching (e.g. "src/app.css" → "renderer/src/app.css")
    const suffixMap = new Map<string, string | null>();
    for (const p of workspaceFiles) {
      const name = p.split('/').pop()!;
      if (nameMap.has(name)) {
        nameMap.set(name, null); // ambiguous — mark it
      } else {
        nameMap.set(name, p);
      }
      // Build suffix entries for every sub-path of the full path
      const parts = p.split('/');
      for (let i = 1; i < parts.length; i++) {
        const suffix = parts.slice(i).join('/');
        if (suffix === name) continue; // already in nameMap
        if (suffixMap.has(suffix)) {
          suffixMap.set(suffix, null); // ambiguous
        } else {
          suffixMap.set(suffix, p);
        }
      }
    }

    return (text: string): string | null => {
      const t = text.replace(/^[`'"]+|[`'"]+$/g, '').replace(/^\.\//, '');
      // 1. Exact match on full relative path
      if (workspaceFiles.has(t)) return t;
      // 2. Partial / suffix match (e.g. "src/app.css" → "renderer/src/app.css")
      const sfx = suffixMap.get(t);
      if (sfx) return sfx;
      // 3. Bare filename match (unambiguous only)
      const byName = nameMap.get(t);
      if (byName) return byName;
      return null;
    };
  }, [workspaceFiles]);

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        /* Code blocks with language label + copy button */
        code({ className, children: codeChildren, ...rest }) {
          const match = /language-(\w+)/.exec(className ?? '');
          const codeStr = String(codeChildren).replace(/\n$/, '');

          // Inline code (no language class, short, no newlines)
          if (!match && !codeStr.includes('\n')) {
            // Check if this looks like a workspace file
            const resolved = resolveFile(codeStr);
            if (resolved && onFileClick) {
              const fileName = resolved.split('/').pop() ?? resolved;
              return (
                <button
                  className="md-file-link"
                  onClick={(e) => { e.preventDefault(); onFileClick(resolved); }}
                  title={`Open ${resolved}`}
                >
                  <span className="md-file-link-icon">{fileEmoji(fileName)}</span>
                  {codeStr}
                </button>
              );
            }
            return <code className="md-inline-code" {...rest}>{codeChildren}</code>;
          }

          // Detect full HTML documents — extract them, don't show raw code
          const lang = match?.[1]?.toLowerCase();
          const isHtmlDoc = lang === 'html' && isFullHtmlDocument(codeStr);

          // Full HTML document → hide it from markdown (rendered as sibling HtmlPreview)
          if (isHtmlDoc) {
            return null;
          }

          return (
            <CollapsibleCode
              lang={match?.[1] ?? 'code'}
              code={codeStr}
              className={className}
              rest={rest}
            >
              {codeChildren}
            </CollapsibleCode>
          );
        },
        /* Tables */
        table({ children: tChildren }: { children?: ReactNode }) {
          return <div className="md-table-wrap"><table className="md-table">{tChildren}</table></div>;
        },
        /* Links open externally */
        a({ href, children: linkChildren }: { href?: string; children?: ReactNode }) {
          return (
            <a href={href} target="_blank" rel="noopener noreferrer" className="md-link">
              {linkChildren}
            </a>
          );
        },
        /* Blockquote */
        blockquote({ children: bqChildren }: { children?: ReactNode }) {
          return <blockquote className="md-blockquote">{bqChildren}</blockquote>;
        },
      }}
    >
      {children}
    </ReactMarkdown>
  );
}
