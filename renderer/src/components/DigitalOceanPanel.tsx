/**
 * DigitalOceanPanel - DigitalOcean App Platform sidebar panel
 *
 * Refactored to use ConnectorPanelShell, ExpandableListItem, and shared utilities.
 */
import { useState, useEffect, useCallback } from 'react';
import { useBackend } from '../context/BackendContext';
import { ConnectorPanelShell } from './shared';
import type { ConnectorField } from './shared/ConnectorPanelShell';
import ExpandableListItem from './shared/ExpandableListItem';
import DetailRow from './shared/DetailRow';
import { formatRelativeDate } from '../utils/formatters';

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

const FORM_FIELDS: ConnectorField[] = [
  { key: 'token', label: 'API Token', type: 'password', placeholder: 'dop_v1_...' },
];

const PHASE_COLORS: Record<string, string> = {
  ACTIVE: '#22c55e',
  ERROR: '#ef4444',
  BUILDING: '#3b82f6',
  DEPLOYING: '#3b82f6',
  PENDING_BUILD: '#3b82f6',
  PENDING_DEPLOY: '#3b82f6',
  CANCELED: '#94a3b8',
  SUPERSEDED: '#94a3b8',
};

function phaseColor(phase: string): string {
  return PHASE_COLORS[phase] ?? '#a1a1aa';
}

export default function DigitalOceanPanel() {
  const backend = useBackend();
  const [connected, setConnected] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formValues, setFormValues] = useState<Record<string, string>>({ token: '' });
  const [formError, setFormError] = useState('');
  const [formTesting, setFormTesting] = useState(false);
  const [token, setToken] = useState('');
  const [apps, setApps] = useState<DOApp[]>([]);
  const [expandedApp, setExpandedApp] = useState<string | null>(null);
  const [deployments, setDeployments] = useState<Record<string, DODeployment[]>>({});
  const [loadingApps, setLoadingApps] = useState(false);
  const [loadingDeploys, setLoadingDeploys] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load saved config on mount
  useEffect(() => {
    (async () => {
      try {
        const config = await backend.connectorLoadConfig('digitalocean');
        if (config && (config as Record<string, string>).token) {
          setToken((config as { token: string }).token);
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
    if (connected && token) loadApps();
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
      if (result.success) await loadDeployments(appId);
    } catch (err) {
      console.error('Failed to trigger deployment:', err);
    }
  };

  const handleConnect = async () => {
    const tokenVal = formValues.token?.trim();
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
    setFormValues({ token: '' });
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
      if (!deployments[appId]) loadDeployments(appId);
    }
  };

  return (
    <ConnectorPanelShell
      title="DigitalOcean"
      icon={<DOIcon size={20} />}
      connected={connected}
      connectedLabel="Connected"
      showForm={showForm}
      onToggleForm={setShowForm}
      formFields={FORM_FIELDS}
      formValues={formValues}
      onFormChange={(key, val) => setFormValues(prev => ({ ...prev, [key]: val }))}
      formError={formError}
      formBusy={formTesting}
      onFormSubmit={handleConnect}
      onFormCancel={() => { setShowForm(false); setFormError(''); }}
      formHelp={
        <>
          Generate a token at{' '}
          <a href="https://cloud.digitalocean.com/account/api/tokens" target="_blank" rel="noreferrer">
            cloud.digitalocean.com
          </a>
          . Needs read+write scope.
        </>
      }
      onRefresh={loadApps}
      refreshing={loadingApps}
      onDisconnect={handleDisconnect}
      error={error}
      onRetry={loadApps}
      loading={loadingApps && apps.length === 0}
      loadingLabel="Loading apps…"
      empty={!loadingApps && apps.length === 0 && connected && !error}
      emptyLabel="No apps found on App Platform."
    >
      {/* Apps list */}
      <div className="gm-messages">
        {apps.map(app => {
          const isExpanded = expandedApp === app.id;
          const appDeploys = deployments[app.id] || [];
          const activeDeploy = app.active_deployment;

          return (
            <ExpandableListItem
              key={app.id}
              id={app.id}
              expanded={isExpanded}
              onToggle={toggleApp}
              indicatorColor={phaseColor(activeDeploy?.phase || 'UNKNOWN')}
              primary={app.spec.name}
              secondary={app.region?.slug || app.spec.region || ''}
              date={formatRelativeDate(app.created_at)}
            >
              {app.live_url && (
                <DetailRow
                  label="URL"
                  value={
                    <a href={app.live_url} target="_blank" rel="noreferrer" style={{ color: '#3b82f6' }}>
                      {app.live_url}
                    </a>
                  }
                />
              )}
              {activeDeploy && (
                <DetailRow
                  label="Status"
                  value={<span style={{ color: phaseColor(activeDeploy.phase) }}>{activeDeploy.phase}</span>}
                />
              )}

              <div style={{ marginTop: 8, marginBottom: 4 }}>
                <button
                  className="gm-form-save"
                  style={{ fontSize: 11, padding: '3px 10px', marginRight: 6 }}
                  onClick={e => { e.stopPropagation(); triggerDeploy(app.id); }}
                >
                  🚀 Deploy
                </button>
                <button
                  className="gm-form-cancel"
                  style={{ fontSize: 11, padding: '3px 10px' }}
                  onClick={e => { e.stopPropagation(); loadDeployments(app.id); }}
                >
                  Refresh
                </button>
              </div>

              {/* Deployments */}
              {loadingDeploys === app.id && appDeploys.length === 0 && (
                <div className="gm-loading" style={{ padding: '4px 0' }}>
                  <span className="gh-tree-spinner" />
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
                      <span style={{ opacity: 0.5 }}>{formatRelativeDate(dep.created_at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </ExpandableListItem>
          );
        })}
      </div>
    </ConnectorPanelShell>
  );
}
