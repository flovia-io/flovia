/**
 * HtmlPreview - Compact action card for full HTML documents detected in chat.
 * No inline iframe — just a one-line bar with Open Preview / Copy / Save buttons
 * and a collapsible source code view.
 *
 * Supports two contexts:
 * - Inside workspace: Preview opens in editor tab
 * - Start page: Preview opens workspace + preview tab
 *
 * Shows real-time line count that updates as HTML streams in.
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { useBackend } from '../context/BackendContext';
import { useWorkspace } from '../context/WorkspaceContext';

interface HtmlPreviewProps {
  html: string;
  /** Optional: session folder path (used on start page to open workspace) */
  sessionFolderPath?: string | null;
  /** Whether content is still being streamed */
  isStreaming?: boolean;
}

/** Detect whether a code string is a full HTML document (not just a fragment) */
export function isFullHtmlDocument(code: string): boolean {
  const lower = code.trim().toLowerCase();
  const hasDoctype = lower.startsWith('<!doctype html');
  const hasHtmlTag = lower.includes('<html');
  const hasBody = lower.includes('<body');
  const hasHead = lower.includes('<head');
  return hasDoctype || (hasHtmlTag && (hasBody || hasHead));
}

/** Generate a short name from the HTML content (title tag or fallback) */
export function extractPreviewName(html: string): string {
  const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/is);
  if (titleMatch?.[1]) {
    const title = titleMatch[1].trim().slice(0, 40);
    if (title) return title;
  }
  return 'Preview';
}

/** Extract the first full HTML document from markdown text (inside ```html blocks or raw) */
export function extractHtmlFromMarkdown(text: string): string | null {
  const codeBlockRegex = /```html\s*\n([\s\S]*?)```/gi;
  let match;
  while ((match = codeBlockRegex.exec(text)) !== null) {
    const code = match[1].trim();
    if (isFullHtmlDocument(code)) return code;
  }
  if (isFullHtmlDocument(text.trim())) return text.trim();
  return null;
}

export default function HtmlPreview({ html, sessionFolderPath, isStreaming }: HtmlPreviewProps) {
  const backend = useBackend();
  const { folderPath, openFile, refreshTree } = useWorkspace();
  const [codeOpen, setCodeOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const prevLinesRef = useRef(0);

  const name = extractPreviewName(html);
  const lines = html.split('\n').length;

  // Track line count changes for streaming animation
  const linesChanged = lines !== prevLinesRef.current;
  useEffect(() => { prevLinesRef.current = lines; }, [lines]);

  // In-workspace preview: open in editor tab
  // Start page preview: open workspace with preview tab
  const handleOpenPreview = useCallback(() => {
    if (folderPath) {
      // Already in a workspace — just open preview tab
      window.dispatchEvent(new CustomEvent('open-html-preview-tab', {
        detail: { name, tabKey: `html-preview:${Date.now()}`, html }
      }));
    } else if (sessionFolderPath) {
      // On start page — open workspace with preview (does NOT interrupt streaming)
      window.dispatchEvent(new CustomEvent('open-workspace', {
        detail: {
          folderPath: sessionFolderPath,
          openPreview: true,
          previewHtml: html,
          previewName: name,
        }
      }));
    }
  }, [html, name, folderPath, sessionFolderPath]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(html);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [html]);

  const handleSave = useCallback(async () => {
    if (!folderPath) return;
    setSaving(true);
    try {
      const fileName = `preview-${Date.now()}.html`;
      const filePath = `${folderPath}/${fileName}`;
      const result = await backend.createFile(filePath, html);
      if (result.success) {
        setSaved(fileName);
        await refreshTree();
        openFile(fileName, filePath);
        setTimeout(() => setSaved(null), 3000);
      }
    } catch (err) {
      console.error('[HtmlPreview] Save failed:', err);
    } finally {
      setSaving(false);
    }
  }, [folderPath, html, backend, openFile, refreshTree]);

  return (
    <div className={`html-extract${isStreaming ? ' streaming' : ''}`}>
      <div className="html-extract-header">
        <span className="html-extract-icon">🌐</span>
        <span className="html-extract-name" title={name}>{name}</span>
        <span className={`html-extract-meta${isStreaming ? ' pulse' : ''}${linesChanged ? ' bump' : ''}`}>
          {isStreaming && <span className="streaming-dot" />}
          {lines} ln
        </span>
        <div className="html-extract-actions">
          <button className="html-extract-btn" onClick={handleCopy} title="Copy HTML">
            {copied ? '✓' : '⎘'}
          </button>
          <button className="html-extract-btn primary" onClick={handleOpenPreview} title={folderPath ? 'Open preview in editor' : 'Open workspace with preview'}>
            ▶ Preview
          </button>
          {folderPath && (
            <button className="html-extract-btn" onClick={handleSave} disabled={saving} title="Save to workspace">
              {saved ? '✓' : saving ? '…' : '💾'}
            </button>
          )}
        </div>
      </div>

      {/* Collapsible source */}
      <button
        className={`html-extract-toggle ${codeOpen ? 'open' : ''}`}
        onClick={() => setCodeOpen(v => !v)}
      >
        <span className="html-extract-chevron">{codeOpen ? '▾' : '▸'}</span>
        Source
        <span className={`html-extract-line-count${isStreaming ? ' pulse' : ''}`}>{lines} ln</span>
      </button>
      {codeOpen && (
        <div className="html-extract-code">
          <pre className="html-extract-pre"><code>{html}</code></pre>
        </div>
      )}
    </div>
  );
}
