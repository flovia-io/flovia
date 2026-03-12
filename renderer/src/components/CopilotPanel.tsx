/**
 * CopilotPanel — Sidebar panel showing GitHub Copilot CLI status.
 * Uses the standalone `copilot` binary (not gh extension).
 * Shows detection status, available models, plan mode info, and install guidance.
 */
import { useState, useEffect, useCallback } from 'react';
import { useBackend } from '../context/BackendContext';
import type { GhCliStatus } from '../types/ghCli.types';

const CopilotIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M9.75 14a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5a.75.75 0 0 1 .75-.75Zm4.5 0a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5a.75.75 0 0 1 .75-.75Z"/>
    <path d="M12 2c2.214 0 4.248.657 5.747 1.756.136.099.268.204.397.312.584.235 1.077.546 1.474.952.85.87 1.132 2.037 1.132 3.368 0 .368-.014.733-.052 1.086l.633 1.478.043.022A4.75 4.75 0 0 1 24 15.222v1.028c0 .529-.309.987-.565 1.293-.28.336-.636.653-.966.918-.654.528-1.449.98-2.119 1.211-.36.125-.757.228-1.143.303C18.137 21.303 15.895 22 12 22s-6.137-.697-7.207-2.025a6.126 6.126 0 0 1-1.143-.303c-.67-.23-1.465-.683-2.119-1.211-.33-.265-.686-.582-.966-.918C.309 17.237 0 16.779 0 16.25v-1.028a4.75 4.75 0 0 1 2.626-4.248l.043-.022.633-1.478a10.195 10.195 0 0 1-.052-1.086c0-1.331.282-2.498 1.132-3.368.397-.406.89-.717 1.474-.952.129-.108.261-.213.397-.312C7.752 2.657 9.786 2 12 2Z"/>
  </svg>
);

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
    <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z"/>
  </svg>
);

const XIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
    <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06z"/>
  </svg>
);

const RefreshIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
    <path d="M8 3a5 5 0 0 0-4.546 2.914.5.5 0 0 1-.908-.428A6 6 0 0 1 14 8a6 6 0 0 1-6 6 6 6 0 0 1-5.454-3.486.5.5 0 0 1 .908-.428A5 5 0 0 0 8 13a5 5 0 0 0 5-5 5 5 0 0 0-5-5z"/>
    <path d="M6.5 1a.5.5 0 0 1 .5.5V4h2.5a.5.5 0 0 1 0 1H6.5a.5.5 0 0 1-.5-.5V1.5a.5.5 0 0 1 .5-.5z"/>
  </svg>
);

/** Best-for descriptions for known Copilot CLI models */
function modelDescription(id: string): string {
  const lower = id.toLowerCase();
  if (lower.includes('opus')) return 'Complex architecture, difficult debugging, nuanced refactoring';
  if (lower.includes('sonnet')) return 'Day-to-day coding, routine tasks — fast & cost-effective';
  if (lower.includes('codex')) return 'Code generation, code review, straightforward implementations';
  if (lower.includes('gpt')) return 'General-purpose, great for code review';
  if (lower.includes('gemini')) return 'Multi-modal, good for broad tasks';
  return '';
}

export default function CopilotPanel() {
  const backend = useBackend();
  const [status, setStatus] = useState<GhCliStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const detect = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await backend.ghCliDetect();
      setStatus(result);
      if (result.error && !result.installed) {
        setError(result.error);
      }
    } catch (err: any) {
      setError(err.message || 'Detection failed');
    } finally {
      setLoading(false);
    }
  }, [backend]);

  useEffect(() => {
    detect();
  }, [detect]);

  const handleOpenInstallDocs = async () => {
    try {
      await backend.shellOpenExternal('https://docs.github.com/copilot/how-tos/copilot-cli');
    } catch {}
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-hdr">
        <h2><CopilotIcon size={16} /> Copilot CLI</h2>
      </div>

      <div className="copilot-panel-content">
        {loading ? (
          <div className="copilot-status-loading">
            <div className="copilot-spinner" />
            <span>Detecting Copilot CLI…</span>
          </div>
        ) : (
          <>
            {/* ── Detection status ── */}
            <div className="copilot-status-list">
              <div className={`copilot-status-item ${status?.installed ? 'ok' : 'error'}`}>
                <span className="copilot-status-icon">
                  {status?.installed ? <CheckIcon /> : <XIcon />}
                </span>
                <div className="copilot-status-info">
                  <span className="copilot-status-label">Copilot CLI</span>
                  <span className="copilot-status-detail">
                    {status?.installed
                      ? `v${status.version} installed`
                      : 'Not detected on PATH'}
                  </span>
                </div>
              </div>
            </div>

            {/* ── Available models ── */}
            {status?.installed && status.models.length > 0 && (
              <div className="copilot-models-section">
                <div className="copilot-section-title">Available Models</div>
                <div className="copilot-models-list">
                  {status.models.map(m => (
                    <div key={m} className="copilot-model-card">
                      <span className="copilot-model-name">{m}</span>
                      {modelDescription(m) && (
                        <span className="copilot-model-desc">{modelDescription(m)}</span>
                      )}
                    </div>
                  ))}
                </div>
                <p className="copilot-hint">
                  Select a Copilot model from the chat dropdown. Use <code>/model</code> in the CLI to switch mid-session.
                </p>
              </div>
            )}

            {/* ── Features info ── */}
            {status?.installed && (
              <div className="copilot-features-section">
                <div className="copilot-section-title">Capabilities</div>
                <div className="copilot-feature-list">
                  <div className="copilot-feature-item">
                    <span className="copilot-feature-icon">💬</span>
                    <span>Chat — ask questions about your code</span>
                  </div>
                  <div className="copilot-feature-item">
                    <span className="copilot-feature-icon">📋</span>
                    <span>Plan — structured implementation plans (<code>Shift+Tab</code> or <code>/plan</code>)</span>
                  </div>
                  <div className="copilot-feature-item">
                    <span className="copilot-feature-icon">🔧</span>
                    <span>Agentic — autonomous file edits &amp; Git</span>
                  </div>
                  <div className="copilot-feature-item">
                    <span className="copilot-feature-icon">☁️</span>
                    <span>Delegate — offload tasks via <code>/delegate</code></span>
                  </div>
                </div>
              </div>
            )}

            {/* ── Ready banner ── */}
            {status?.installed && (
              <div className="copilot-ready-banner">
                <CopilotIcon size={24} />
                <div>
                  <strong>Copilot CLI Ready</strong>
                  <p>Select <em>Copilot</em> mode in the chat panel and choose a model to start.</p>
                </div>
              </div>
            )}

            {/* ── Not installed guidance ── */}
            {!status?.installed && (
              <div className="copilot-install-guide">
                <div className="copilot-section-title">Install Copilot CLI</div>
                <p className="copilot-hint">
                  Install the standalone Copilot CLI to use GitHub Copilot directly from your terminal and this app.
                </p>
                <div className="copilot-install-commands">
                  <div className="copilot-install-cmd">
                    <span className="copilot-cmd-label">npm</span>
                    <code>npm install -g @githubnext/github-copilot-cli</code>
                  </div>
                  <div className="copilot-install-cmd">
                    <span className="copilot-cmd-label">brew</span>
                    <code>brew install github/gh/copilot</code>
                  </div>
                </div>
                <button className="copilot-action-btn primary" onClick={handleOpenInstallDocs}>
                  📖 View Install Docs
                </button>
              </div>
            )}

            {/* ── Refresh ── */}
            <div className="copilot-actions">
              <button className="copilot-action-btn secondary" onClick={detect} disabled={loading}>
                <RefreshIcon /> Refresh Status
              </button>
            </div>

            {error && <div className="copilot-error">{error}</div>}
          </>
        )}
      </div>
    </aside>
  );
}
