/**
 * DigitalOceanPanel - DigitalOcean App Platform sidebar panel
 *
 * Connect with an API token, view apps, deployments, trigger deploys, and view logs.
 */
import { useState, useEffect, useCallback } from 'react';
import { useBackend } from '../context/BackendContext';
import { ChevronDownIcon, ChevronRightIcon, RefreshIcon } from './icons';

// DigitalOcean logo icon
const DOIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12.04 0C5.408-.02.005 5.37.005 11.992h4.638c0-4.923 4.963-8.74 10.237-6.762a6.624 6.624 0 0 1 4.126 4.126c1.978 5.274-1.84 10.237-6.762 10.237v-4.163h-4.16v4.163H4.16V23.5h3.924v-3.907h4.163V15.43h4.637c0 6.86-6.835 12.18-13.943 10.095A11.99 11.99 0 0 1 .005 12.04H.003C-.007 5.37 5.389-.015 12.04 0z" />
  </svg>
);

interface DOApp {
  id: string;
  spec: { name: string; region?: string };
  default_ingress?: string;
  live_url?: string;
  region?: { slug: string; label: string };
  active_deployment?: DODeployment;
  created_at: string;
}

interface DODeployment {
  id: string;
  cause: string;
  phase: string;
  created_at: string;
  updated_at?: string;
}

export default function DigitalOceanPanel() {
  const backend = useBackend();
  const [connected, setConnected] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formToken, setFormToken] = useState('');
  const [formError, setFormError] = useState('');
  const [formTesting, setFormTesting] = useState(false);
  const [token, setToken] = useState('');
  const [apps, setApps] = useState<DOApp[]>([]);
  const [expandedApp, setExpandedApp] = useState<string | null>(null);
  const [deployments, setDeployments] = useState<Record<string, DODeployment[]>>({});
  const [loadingApps, setLoadingApps] = useState(false);
  const [loadingDeploys, setLoadingDeploys] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Try to load saved config on mount
  useEffect(() => {
    (async () => {
      try {
        const config = await backend.connectorLoadConfig('digitalocean');
        if (config && (config as Record<string, string>).token) {
          const c = config as { token: string };
          setToken(c.token);
          setConnected(true);
        }
      } catch {
        // no saved config
      }
    })();
  }, []);

  // Load apps when connected
  const loadApps = useCallback(async () => {
    setLoadingApps(true);
    setError(null);
    try {
      const result = await backend.connectorExecute('digitalocean', 'list-apps');
      if (result.success) {
        const data = result as any;
        setApps(data.apps || data.data?.apps || []);
      } else {
        setError(result.error || 'Failed to load apps');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load apps');
    } finally {
      setLoadingApps(false);
    }
  }, [backend]);

  useEffect(() => {
    if (connected && token) {
      loadApps();
    }
  }, [connected, token, loadApps]);

  const loadDeployments = async (appId: string) => {
    setLoadingDeploys(appId);
    try {
      const result = await backend.connectorExecute('digitalocean', 'list-deployments', {
        appId,
        perPage: 5,
      });
      if (result.success) {
        const data = result as any;
        setDeployments(prev => ({
          ...prev,
          [appId]: data.deployments || data.data?.deployments || [],
        }));
      }
    } catch (err) {
      console.error('Failed to load deployments:', err);
    } finally {
      setLoadingDeploys(null);
    }
  };

  const triggerDeploy = async (appId: string) => {
    try {
      const result = await backend.connectorExecute('digitalocean', 'create-deployment', {
        appId,
        forceBuild: true,
      });
      if (result.success) {
        // Refresh deployments
        await loadDeployments(appId);
      }
    } catch (err) {
      console.error('Failed to trigger deployment:', err);
    }
  };

  const handleConnect = async () => {
    const tokenVal = formToken.trim();
    if (!tokenVal) {
      setFormError('API token is required');
      return;
    }

    setFormTesting(true);
    setFormError('');

    try {
      const result = await backend.connectorTest('digitalocean', { token: tokenVal });
      if (!result.success) {
        setFormError(result.error || 'Connection failed. Check your token.');
        setFormTesting(false);
        return;
      }
    } catch {
      setFormError('Connection failed. Check your token.');
      setFormTesting(false);
      return;
    }

    await backend.connectorSaveConfig('digitalocean', { token: tokenVal });
    setToken(tokenVal);
    setConnected(true);
    setShowForm(false);
    setFormToken('');
    setFormError('');
    setFormTesting(false);
  };

  const handleDisconnect = async () => {
    setConnected(false);
    setToken('');
    setApps([]);
    setDeployments({});
    setExpandedApp(null);
    await backend.connectorSaveConfig('digitalocean', {});
  };

  const toggleApp = (appId: string) => {
    if (expandedApp === appId) {
      setExpandedApp(null);
    } else {
      setExpandedApp(appId);
      if (!deployments[appId]) {
        loadDeployments(appId);
      }
    }
  };

  const phaseColor = (phase: string) => {
    switch (phase) {
      case 'ACTIVE': return '#22c55e';
      case 'ERROR': return '#ef4444';
      case 'BUILDING': case 'DEPLOYING': case 'PENDING_BUILD': case 'PENDING_DEPLOY': return '#3b82f6';
      case 'CANCELED': case 'SUPERSEDED': return '#94a3b8';
      default: return '#a1a1aa';
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      const now = new Date();
      if (d.toDateString() === now.toDateString()) {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  // ── Not connected state ──
  if (!connected && !showForm) {
    return (
      <div className="gm-panel">
        <div className="gm-panel-header">
          <DOIcon size={20} />
          <h2>DigitalOcean</h2>
        </div>
        <div className="gm-panel-empty">
          <p>No DigitalOcean account connected.</p>
          <p className="gm-hint">Connect your DigitalOcean account to view and manage apps.</p>
          <button className="gm-add-btn" onClick={() => setShowForm(true)}>
            <span>＋</span> Connect DigitalOcean
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="gm-panel">
      <div className="gm-panel-header">
        <DOIcon size={20} />
        <h2>DigitalOcean</h2>
        <div className="gm-panel-header-actions">
          {connected && (
            <button
              className="gm-refresh-btn"
              onClick={loadApps}
              disabled={loadingApps}
              title="Refresh"
            >
              <RefreshIcon size={14} className={loadingApps ? 'spinning' : ''} />
            </button>
          )}
          {connected ? (
            <button
              className="gm-disconnect-btn"
              onClick={handleDisconnect}
              title="Disconnect"
            >
              ×
            </button>
          ) : (
            <button
              className="gm-add-btn-small"
              onClick={() => setShowForm(v => !v)}
              title="Connect account"
            >
              ＋
            </button>
          )}
        </div>
      </div>

      {/* Connection form */}
      {showForm && !connected && (
        <div className="gm-form">
          <label className="gm-form-label">API Token</label>
          <input
            className="gm-form-input"
            type="password"
            value={formToken}
            onChange={e => setFormToken(e.target.value)}
            placeholder="dop_v1_..."
          />
          <p className="gm-form-help">
            Generate a token at{' '}
            <a href="https://cloud.digitalocean.com/account/api/tokens" target="_blank" rel="noreferrer">
              cloud.digitalocean.com
            </a>
            . Needs read+write scope.
          </p>
          {formError && <div className="gm-form-error">{formError}</div>}
          <div className="gm-form-actions">
            <button className="gm-form-cancel" onClick={() => { setShowForm(false); setFormError(''); }}>Cancel</button>
            <button className="gm-form-save" onClick={handleConnect} disabled={formTesting}>
              {formTesting ? 'Testing…' : 'Connect'}
            </button>
          </div>
        </div>
      )}

      {/* Connected indicator */}
      {connected && (
        <div className="gm-account">
          <span className="gm-account-dot">●</span>
          <span className="gm-account-email">Connected</span>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="gm-error">
          <span>{error}</span>
          <button className="gm-error-retry" onClick={loadApps}>Retry</button>
        </div>
      )}

      {/* Loading state */}
      {loadingApps && apps.length === 0 && (
        <div className="gm-loading">
          <span className="gh-tree-spinner"></span>
          <span>Loading apps…</span>
        </div>
      )}

      {/* Empty state */}
      {!loadingApps && apps.length === 0 && connected && !error && (
        <div className="gm-empty-messages">No apps found on App Platform.</div>
      )}

      {/* Apps list */}
      <div className="gm-messages">
        {apps.map(app => {
          const isExpanded = expandedApp === app.id;
          const appDeploys = deployments[app.id] || [];
          const activeDeploy = app.active_deployment;

          return (
            <div key={app.id} className="gm-message-group">
              <div
                className="gm-message-item"
                onClick={() => toggleApp(app.id)}
              >
                <span className="gm-chevron">
                  {isExpanded ? <ChevronDownIcon size={12} /> : <ChevronRightIcon size={12} />}
                </span>
                <span className="gm-message-indicator" style={{ color: phaseColor(activeDeploy?.phase || 'UNKNOWN') }}>
                  ●
                </span>
                <span className="gm-message-from">{app.spec.name}</span>
                <span className="gm-message-subject" style={{ opacity: 0.6 }}>
                  {app.region?.slug || app.spec.region || ''}
                </span>
                <span className="gm-message-date">{formatDate(app.created_at)}</span>
              </div>

              {isExpanded && (
                <div className="gm-message-detail">
                  {app.live_url && (
                    <div className="gm-detail-row">
                      <span className="gm-detail-label">URL:</span>
                      <span className="gm-detail-value">
                        <a href={app.live_url} target="_blank" rel="noreferrer" style={{ color: '#3b82f6' }}>
                          {app.live_url}
                        </a>
                      </span>
                    </div>
                  )}
                  {activeDeploy && (
                    <div className="gm-detail-row">
                      <span className="gm-detail-label">Status:</span>
                      <span className="gm-detail-value" style={{ color: phaseColor(activeDeploy.phase) }}>
                        {activeDeploy.phase}
                      </span>
                    </div>
                  )}

                  <div style={{ marginTop: 8, marginBottom: 4 }}>
                    <button
                      className="gm-form-save"
                      style={{ fontSize: 11, padding: '3px 10px', marginRight: 6 }}
                      onClick={(e) => { e.stopPropagation(); triggerDeploy(app.id); }}
                    >
                      🚀 Deploy
                    </button>
                    <button
                      className="gm-form-cancel"
                      style={{ fontSize: 11, padding: '3px 10px' }}
                      onClick={(e) => { e.stopPropagation(); loadDeployments(app.id); }}
                    >
                      Refresh
                    </button>
                  </div>

                  {/* Deployments */}
                  {loadingDeploys === app.id && appDeploys.length === 0 && (
                    <div className="gm-loading" style={{ padding: '4px 0' }}>
                      <span className="gh-tree-spinner"></span>
                      <span>Loading deployments…</span>
                    </div>
                  )}
                  {appDeploys.length > 0 && (
                    <div style={{ marginTop: 6 }}>
                      <span className="gm-detail-label">Recent Deployments:</span>
                      {appDeploys.map(dep => (
                        <div key={dep.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', fontSize: 11 }}>
                          <span style={{ color: phaseColor(dep.phase) }}>●</span>
                          <span style={{ flex: 1, opacity: 0.8 }}>{dep.cause?.slice(0, 40) || dep.id.slice(0, 8)}</span>
                          <span style={{ color: phaseColor(dep.phase), fontWeight: 500 }}>{dep.phase}</span>
                          <span style={{ opacity: 0.5 }}>{formatDate(dep.created_at)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
