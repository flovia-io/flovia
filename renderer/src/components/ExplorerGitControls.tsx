/**
 * ExplorerGitControls — Git branch selector, pull/push buttons for the explorer sidebar.
 * Extracted from Sidebar to keep it focused on layout.
 */
import { useState, useEffect, useRef } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';

export default function ExplorerGitControls() {
  const {
    hasGit, gitBranchInfo, gitPush, gitPull, gitCheckout, gitCreateBranch,
  } = useWorkspace();

  const [branchMenuOpen, setBranchMenuOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [pushing, setPushing] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [opMsg, setOpMsg] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!branchMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setBranchMenuOpen(false);
        setCreating(false);
        setNewBranchName('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [branchMenuOpen]);

  // Focus input when entering create mode
  useEffect(() => {
    if (creating && inputRef.current) inputRef.current.focus();
  }, [creating]);

  // Auto-clear op message
  useEffect(() => {
    if (!opMsg) return;
    const t = setTimeout(() => setOpMsg(null), 4000);
    return () => clearTimeout(t);
  }, [opMsg]);

  if (!hasGit || !gitBranchInfo) return null;

  const bi = gitBranchInfo;

  const handleCheckout = async (branch: string) => {
    setBranchMenuOpen(false);
    const r = await gitCheckout(branch);
    if (!r.success) setOpMsg(`✗ ${r.error ?? 'Checkout failed'}`);
  };

  const handleCreate = async () => {
    const name = newBranchName.trim();
    if (!name) return;
    const r = await gitCreateBranch(name);
    if (r.success) {
      setOpMsg(`✓ Created & switched to ${name}`);
    } else {
      setOpMsg(`✗ ${r.error ?? 'Create failed'}`);
    }
    setCreating(false);
    setNewBranchName('');
    setBranchMenuOpen(false);
  };

  const handlePush = async () => {
    setPushing(true);
    const r = await gitPush();
    setPushing(false);
    setOpMsg(r.success ? '✓ Pushed' : `✗ ${r.error ?? 'Push failed'}`);
  };

  const handlePull = async () => {
    setPulling(true);
    const r = await gitPull();
    setPulling(false);
    setOpMsg(r.success ? '✓ Pulled' : `✗ ${r.error ?? 'Pull failed'}`);
  };

  return (
    <div className="explorer-git-bar">
      {/* Branch selector */}
      <div className="explorer-git-branch-wrap" ref={menuRef}>
        <button
          className="explorer-git-branch-btn"
          onClick={() => setBranchMenuOpen(v => !v)}
          title="Switch branch"
        >
          <span className="explorer-git-branch-icon">⑂</span>
          <span className="explorer-git-branch-name">{bi.current || 'HEAD'}</span>
          <span className="explorer-git-branch-chevron">{branchMenuOpen ? '▲' : '▼'}</span>
        </button>

        {branchMenuOpen && (
          <div className="explorer-git-branch-menu">
            <div className="explorer-git-branch-menu-hdr">Branches</div>
            {bi.branches.map(b => (
              <button
                key={b}
                className={`explorer-git-branch-menu-item${b === bi.current ? ' active' : ''}`}
                onClick={() => handleCheckout(b)}
              >
                {b === bi.current && <span className="explorer-git-check">✓</span>}
                {b}
              </button>
            ))}
            <div className="explorer-git-branch-menu-divider" />
            {creating ? (
              <div className="explorer-git-create-input-wrap">
                <input
                  ref={inputRef}
                  className="explorer-git-create-input"
                  placeholder="new-branch-name"
                  value={newBranchName}
                  onChange={e => setNewBranchName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleCreate();
                    if (e.key === 'Escape') { setCreating(false); setNewBranchName(''); }
                  }}
                />
                <button className="explorer-git-create-confirm" onClick={handleCreate} title="Create branch">✓</button>
              </div>
            ) : (
              <button className="explorer-git-branch-menu-item create" onClick={() => setCreating(true)}>
                <span>＋</span> New branch…
              </button>
            )}
          </div>
        )}
      </div>

      {/* Pull & Push */}
      {bi.hasRemote && (
        <div className="explorer-git-actions">
          {(bi.behind > 0 || bi.ahead > 0) && (
            <span className="explorer-git-sync-counts" title={`${bi.ahead}↑ ${bi.behind}↓`}>
              {bi.behind > 0 && <span>↓{bi.behind}</span>}
              {bi.ahead > 0 && <span>↑{bi.ahead}</span>}
            </span>
          )}
          <button className="explorer-git-action-btn" onClick={handlePull} disabled={pulling} title="Pull">
            {pulling ? '⏳' : '↓'}
          </button>
          <button className="explorer-git-action-btn" onClick={handlePush} disabled={pushing} title="Push">
            {pushing ? '⏳' : '↑'}
          </button>
        </div>
      )}

      {/* Feedback */}
      {opMsg && <span className={`explorer-git-op-msg${opMsg.startsWith('✗') ? ' error' : ''}`}>{opMsg}</span>}
    </div>
  );
}
