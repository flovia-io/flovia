import { useEffect, useState, useMemo, useCallback } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { useBackend } from '../context/BackendContext';
import { getFileIcon } from '../utils/fileIcons';
import type { AISettings } from '../types';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  M: { label: 'M', color: '#e5c07b' },
  A: { label: 'A', color: '#50fa7b' },
  D: { label: 'D', color: '#e05555' },
  '??': { label: 'U', color: '#50fa7b' },
  R: { label: 'R', color: '#7c8cf8' },
  C: { label: 'C', color: '#7c8cf8' },
  T: { label: 'T', color: '#7c8cf8' },
};

const STATUS_WORD: Record<string, string> = {
  M: 'Modified', A: 'Added', D: 'Deleted', '??': 'Untracked', R: 'Renamed', C: 'Copied', T: 'Type-changed',
};

/** Build a minimal unified diff string from old/new content to send to the AI model */
function buildUnifiedDiff(oldContent: string, newContent: string): string {
  if (!oldContent && !newContent) return '(empty)';
  if (!oldContent) return newContent.split('\n').map(l => `+ ${l}`).join('\n');
  if (!newContent) return oldContent.split('\n').map(l => `- ${l}`).join('\n');

  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');
  const lines: string[] = [];
  const max = Math.max(oldLines.length, newLines.length);

  for (let i = 0; i < max; i++) {
    const o = oldLines[i];
    const n = newLines[i];
    if (o === undefined) {
      lines.push(`+ ${n}`);
    } else if (n === undefined) {
      lines.push(`- ${o}`);
    } else if (o !== n) {
      lines.push(`- ${o}`);
      lines.push(`+ ${n}`);
    }
    // skip identical lines to keep payload small
  }

  // Cap at ~200 lines to avoid token overflow
  if (lines.length > 200) {
    return lines.slice(0, 200).join('\n') + '\n... (truncated)';
  }
  return lines.join('\n');
}

export default function SourceControlPanel() {
  const backend = useBackend();
  const {
    gitSplitChanges, folderPath, refreshGitStatus, openDiff,
    stageFile, unstageFile, stageAll, unstageAll, discardFile, gitCommit,
    gitCreateBranch, gitBranchInfo,
  } = useWorkspace();

  const [commitMsg, setCommitMsg] = useState('');
  const [committing, setCommitting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stagedCollapsed, setStagedCollapsed] = useState(false);
  const [unstagedCollapsed, setUnstagedCollapsed] = useState(false);
  const [showCreateBranch, setShowCreateBranch] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');

  // Only refresh on initial mount, not on every refreshGitStatus reference change
  useEffect(() => { refreshGitStatus(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const staged = useMemo(() => {
    const result = gitSplitChanges.filter(c => c.staged);
    console.log('[SourceControl] Staged files:', result.map(c => ({ file: c.file, status: c.status })));
    return result;
  }, [gitSplitChanges]);

  const unstaged = useMemo(() => {
    const result = gitSplitChanges.filter(c => !c.staged);
    console.log('[SourceControl] Unstaged files:', result.map(c => ({ file: c.file, status: c.status })));
    return result;
  }, [gitSplitChanges]);

  const allChanges = useMemo(() => {
    // Deduplicate by file name (a file can appear in both staged + unstaged)
    const map = new Map<string, { file: string; status: string }>();
    for (const c of gitSplitChanges) {
      if (!map.has(c.file)) map.set(c.file, { file: c.file, status: c.status });
    }
    return [...map.values()];
  }, [gitSplitChanges]);

  const handleDiscard = async (filePath: string) => {
    if (!confirm(`Discard changes to "${filePath.split('/').pop()}"? This cannot be undone.`)) return;
    await discardFile(filePath);
  };

  const handleCreateBranch = async () => {
    if (!newBranchName.trim()) return;
    const result = await gitCreateBranch(newBranchName.trim());
    if (result.success) {
      setNewBranchName('');
      setShowCreateBranch(false);
    } else {
      setError(result.error ?? 'Failed to create branch');
    }
  };

  const handleCommit = async () => {
    if (!commitMsg.trim() || staged.length === 0) return;
    setCommitting(true);
    setError(null);
    const result = await gitCommit(commitMsg.trim());
    setCommitting(false);
    if (result.success) {
      setCommitMsg('');
    } else {
      setError(result.error ?? 'Commit failed');
    }
  };

  const handleGenerateCommitMsg = useCallback(async () => {
    if (!folderPath || allChanges.length === 0) return;
    setGenerating(true);
    setError(null);
    try {
      // Load AI settings
      const settings: AISettings = await backend.aiLoadSettings();

      // Resolve the model — fall back to first available if none saved
      let model = settings.selectedModel;
      if (!model) {
        const list = await backend.aiListModels(settings.baseUrl, settings.apiKey);
        if (list.length === 0) {
          setError('Configure an AI model in Settings first');
          setGenerating(false);
          return;
        }
        model = list[0];
      }

      // Gather diffs for every changed file (in parallel, capped)
      const diffEntries = await Promise.all(
        allChanges.map(async (c) => {
          const fullPath = c.file.startsWith('/') ? c.file : `${folderPath}/${c.file}`;
          try {
            const diff = await backend.gitDiff(folderPath, fullPath);
            return {
              file: c.file,
              status: STATUS_WORD[c.status] ?? c.status,
              diff: buildUnifiedDiff(diff.oldContent, diff.newContent),
            };
          } catch {
            return { file: c.file, status: STATUS_WORD[c.status] ?? c.status, diff: '' };
          }
        })
      );

      const payload = JSON.stringify(diffEntries, null, 2);

      const prompt = `You are a helpful assistant that writes concise, conventional git commit messages.
Based on the following changed files and their diffs, generate a single commit message.
Follow the Conventional Commits format: type(scope): description
Keep it under 72 characters for the subject line. If needed, add a blank line then a short body (2-3 bullet points max).
Return ONLY the commit message text, nothing else — no markdown fences, no explanation.

Changed files and diffs:
${payload}`;

      const result = await backend.aiChat(
        settings.baseUrl, settings.apiKey, model,
        [{ role: 'user', content: prompt }],
      );

      if (result.success && result.reply) {
        setCommitMsg(result.reply.trim());
      } else {
        setError(result.error ?? 'AI failed to generate a message');
      }
    } catch (err: unknown) {
      setError((err as Error).message ?? 'Failed to generate commit message');
    }
    setGenerating(false);
  }, [folderPath, allChanges]);

  const handleClick = (filePath: string) => {
    if (!folderPath) return;
    const full = filePath.startsWith('/') ? filePath : `${folderPath}/${filePath}`;
    openDiff(full);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleCommit();
    }
  };

  return (
    <div className="sc-panel">
      <div className="sidebar-hdr">
        <h2>🔀 Source Control</h2>
        <button
          className="sc-refresh-icon"
          onClick={refreshGitStatus}
          title="Refresh"
        >
          <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M13.987 6.2A6 6 0 0 0 2.68 4.81L1.5 3.63v4.37h4.37L4.31 6.44a4.5 4.5 0 0 1 8.48 1.06l1.197-1.3zM2.013 9.8A6 6 0 0 0 13.32 11.19l1.18 1.18V8h-4.37l1.56 1.56a4.5 4.5 0 0 1-8.48-1.06L2.013 9.8z"/></svg>
        </button>
      </div>

      {/* Commit area */}
      <div className="sc-commit-area">
        <div className="sc-commit-input-wrap">
          <textarea
            className="sc-commit-input"
            placeholder="Commit message"
            value={commitMsg}
            onChange={e => setCommitMsg(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={commitMsg.includes('\n') ? 3 : 1}
          />
          <button
            className="sc-generate-btn-inline"
            disabled={generating || allChanges.length === 0}
            onClick={handleGenerateCommitMsg}
            title="Generate commit message with AI"
          >
            {generating ? '⏳' : '✨'}
          </button>
        </div>
        <button
          className="sc-commit-btn"
          disabled={!commitMsg.trim() || staged.length === 0 || committing}
          onClick={handleCommit}
          title={staged.length === 0 ? 'Stage files before committing' : 'Commit staged changes (⌘Enter)'}
        >
          {committing ? '⏳ Committing…' : '✓ Commit'}
        </button>
        {error && <div className="sc-commit-error">{error}</div>}
      </div>

      {staged.length === 0 && unstaged.length === 0 ? (
        <div className="sc-empty">No changes detected</div>
      ) : (
        <div className="file-tree">
          {/* Staged changes */}
          <div className="sc-section-hdr sc-section-clickable" onClick={() => setStagedCollapsed(v => !v)}>
            <span className="sc-section-arrow">{stagedCollapsed ? '▸' : '▾'}</span>
            <span>Staged Changes ({staged.length})</span>
            {staged.length > 0 && (
              <button
                className="sc-section-action"
                onClick={e => { e.stopPropagation(); unstageAll(); }}
                title="Unstage All"
              >−</button>
            )}
          </div>
          {!stagedCollapsed && staged.map(c => {
            const name = c.file.split('/').pop() ?? c.file;
            const s = STATUS_LABELS[c.status] ?? { label: c.status, color: '#bbb' };
            return (
              <div key={`staged-${c.file}`} className="tree-item file sc-item" onClick={() => handleClick(c.file)}>
                <span className="tree-icon">{getFileIcon(name)}</span>
                <span className="tree-label sc-file">{c.file}</span>
                <span className="sc-status" style={{ color: s.color }}>{s.label}</span>
                <button
                  className="sc-item-action"
                  onClick={e => { e.stopPropagation(); unstageFile(c.file); }}
                  title="Unstage"
                >−</button>
              </div>
            );
          })}

          {/* Unstaged changes */}
          <div className="sc-section-hdr sc-section-clickable" onClick={() => setUnstagedCollapsed(v => !v)}>
            <span className="sc-section-arrow">{unstagedCollapsed ? '▸' : '▾'}</span>
            <span>Changes ({unstaged.length})</span>
            {unstaged.length > 0 && (
              <button
                className="sc-section-action"
                onClick={e => { e.stopPropagation(); stageAll(); }}
                title="Stage All"
              >+</button>
            )}
          </div>
          {!unstagedCollapsed && unstaged.map(c => {
            const name = c.file.split('/').pop() ?? c.file;
            const s = STATUS_LABELS[c.status] ?? { label: c.status, color: '#bbb' };
            return (
              <div key={`unstaged-${c.file}`} className="tree-item file sc-item" onClick={() => handleClick(c.file)}>
                <span className="tree-icon">{getFileIcon(name)}</span>
                <span className="tree-label sc-file">{c.file}</span>
                <span className="sc-status" style={{ color: s.color }}>{s.label}</span>
                <button
                  className="sc-item-action sc-item-discard"
                  onClick={e => { e.stopPropagation(); handleDiscard(c.file); }}
                  title="Discard Changes"
                >↩</button>
                <button
                  className="sc-item-action"
                  onClick={e => { e.stopPropagation(); stageFile(c.file); }}
                  title="Stage"
                >+</button>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Branch Section */}
      <div className="sc-branch-section">
        {showCreateBranch ? (
          <div className="sc-create-branch-form">
            <input
              type="text"
              className="sc-branch-input"
              placeholder="New branch name..."
              value={newBranchName}
              onChange={e => setNewBranchName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleCreateBranch();
                if (e.key === 'Escape') { setShowCreateBranch(false); setNewBranchName(''); }
              }}
              autoFocus
            />
            <button className="sc-branch-confirm" onClick={handleCreateBranch} title="Create Branch">✓</button>
            <button className="sc-branch-cancel" onClick={() => { setShowCreateBranch(false); setNewBranchName(''); }} title="Cancel">✕</button>
          </div>
        ) : (
          <button className="sc-create-branch-btn" onClick={() => setShowCreateBranch(true)}>
            + Create Branch {gitBranchInfo?.current ? `from ${gitBranchInfo.current}` : ''}
          </button>
        )}
      </div>
    </div>
  );
}
