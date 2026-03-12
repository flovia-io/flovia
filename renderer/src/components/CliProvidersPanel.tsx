/**
 * CliProvidersPanel — Sidebar panel showing status of all CLI providers.
 * Dynamically renders detection status, models, features, and install
 * guidance for every provider in the CLI_PROVIDERS registry.
 *
 * Replaces the old CopilotPanel (which was Copilot-specific).
 */
import { useState, useEffect, useCallback } from 'react';
import { useBackend } from '../context/BackendContext';
import type { CliProviderId, CliProviderStatus, CliProviderMeta } from '../types/cliProvider.types';
import { CLI_PROVIDERS } from '../types/cliProvider.types';

// ── Shared icons ────────────────────────────────────────────────────────────

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

// ── Model description heuristic ─────────────────────────────────────────────

/** Best-for descriptions for known model names */
function modelDescription(id: string): string {
  const lower = id.toLowerCase();
  if (lower.includes('opus')) return 'Complex architecture, difficult debugging, nuanced refactoring';
  if (lower.includes('sonnet')) return 'Day-to-day coding, routine tasks — fast & cost-effective';
  if (lower.includes('codex')) return 'Code generation, code review, straightforward implementations';
  if (lower.includes('gpt')) return 'General-purpose, great for code review';
  if (lower.includes('gemini')) return 'Multi-modal, good for broad tasks';
  return '';
}

// ── Per-provider card ───────────────────────────────────────────────────────

interface ProviderCardProps {
  meta: CliProviderMeta;
  status: CliProviderStatus | null;
  onOpenDocs: (url: string) => void;
}

function ProviderCard({ meta, status, onOpenDocs }: ProviderCardProps) {
  return (
    <div className="copilot-panel-content" style={{ marginBottom: 16 }}>
      {/* ── Detection status ── */}
      <div className="copilot-status-list">
        <div className={`copilot-status-item ${status?.installed ? 'ok' : 'error'}`}>
          <span className="copilot-status-icon">
            {status?.installed ? <CheckIcon /> : <XIcon />}
          </span>
          <div className="copilot-status-info">
            <span className="copilot-status-label">{meta.icon} {meta.name}</span>
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
            Select a {meta.shortName} model from the chat dropdown.
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
          </div>
        </div>
      )}

      {/* ── Ready banner ── */}
      {status?.installed && (
        <div className="copilot-ready-banner">
          <span style={{ fontSize: 24 }}>{meta.icon}</span>
          <div>
            <strong>{meta.shortName} Ready</strong>
            <p>Select <em>{meta.shortName}</em> mode in the chat panel and choose a model to start.</p>
          </div>
        </div>
      )}

      {/* ── Not installed guidance ── */}
      {!status?.installed && (
        <div className="copilot-install-guide">
          <div className="copilot-section-title">Install {meta.shortName}</div>
          <p className="copilot-hint">
            Install the {meta.name} to use it in this app.
          </p>
          <div className="copilot-install-commands">
            {meta.installCommands.map(cmd => (
              <div key={cmd.manager} className="copilot-install-cmd">
                <span className="copilot-cmd-label">{cmd.manager}</span>
                <code>{cmd.command}</code>
              </div>
            ))}
          </div>
          <button className="copilot-action-btn primary" onClick={() => onOpenDocs(meta.docsUrl)}>
            📖 View Install Docs
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main panel ──────────────────────────────────────────────────────────────

export default function CliProvidersPanel() {
  const backend = useBackend();
  const [statuses, setStatuses] = useState<CliProviderStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const detect = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const results = await backend.cliProviderDetectAll();
      setStatuses(results);
    } catch (err: any) {
      setError(err.message || 'Detection failed');
    } finally {
      setLoading(false);
    }
  }, [backend]);

  useEffect(() => {
    detect();
  }, [detect]);

  const handleOpenDocs = async (url: string) => {
    try {
      await backend.shellOpenExternal(url);
    } catch {}
  };

  const providerIds = Object.keys(CLI_PROVIDERS) as CliProviderId[];

  return (
    <aside className="sidebar">
      <div className="sidebar-hdr">
        <h2>🔌 CLI Providers</h2>
      </div>

      {loading ? (
        <div className="copilot-panel-content">
          <div className="copilot-status-loading">
            <div className="copilot-spinner" />
            <span>Detecting CLI providers…</span>
          </div>
        </div>
      ) : (
        <>
          {providerIds.map(id => {
            const meta = CLI_PROVIDERS[id];
            const status = statuses.find(s => s.providerId === id) ?? null;
            return <ProviderCard key={id} meta={meta} status={status} onOpenDocs={handleOpenDocs} />;
          })}

          {/* ── Refresh ── */}
          <div className="copilot-panel-content">
            <div className="copilot-actions">
              <button className="copilot-action-btn secondary" onClick={detect} disabled={loading}>
                <RefreshIcon /> Refresh Status
              </button>
            </div>
            {error && <div className="copilot-error">{error}</div>}
          </div>
        </>
      )}
    </aside>
  );
}
