/**
 * WelcomeConnections - Right-side panel on the Welcome page
 * 
 * Shows all available connectors (from the connector registry) with
 * their connection status. Users can configure and connect each one.
 * Connectors are greyed out until they are added/connected.
 */
import { useState, useEffect, useCallback } from 'react';
import { useBackend } from '../../context/BackendContext';

/** Shape of a connector as loaded from the backend */
interface ConnectorDetail {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  status: string;
  configFields: Array<{
    key: string;
    label: string;
    type: string;
    placeholder?: string;
    required: boolean;
    helpText?: string;
  }>;
  actions: Array<{ id: string; name: string; description: string }>;
}

// Category icons
const categoryEmoji: Record<string, string> = {
  'source-control': '🔀',
  'database': '🗄️',
  'cloud': '☁️',
  'project-management': '📋',
  'ci-cd': '⚙️',
  'communication': '💬',
  'monitoring': '📊',
  'ai': '🤖',
  'other': '🔌',
};

export default function WelcomeConnections() {
  const backend = useBackend();
  const [connectors, setConnectors] = useState<ConnectorDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [configuring, setConfiguring] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Load connectors from backend
  useEffect(() => {
    (async () => {
      try {
        const list = await backend.connectorList();
        // For each connector, load full details + saved config
        const details: ConnectorDetail[] = [];
        for (const meta of list) {
          const detail = await backend.connectorGet(meta.id);
          if (detail) {
            details.push({
              id: detail.metadata.id,
              name: detail.metadata.name,
              description: detail.metadata.description,
              icon: detail.metadata.icon,
              category: detail.metadata.category,
              status: detail.state.status,
              configFields: detail.configFields,
              actions: detail.actions,
            });
          }
        }
        setConnectors(details);
      } catch (err) {
        console.error('[WelcomeConnections] Failed to load connectors:', err);
        // Fallback: show nothing
      } finally {
        setLoading(false);
      }
    })();
  }, [backend]);

  const refreshState = useCallback(async (connectorId: string) => {
    try {
      const state = await backend.connectorGetState(connectorId);
      setConnectors(prev =>
        prev.map(c => c.id === connectorId ? { ...c, status: state.status } : c)
      );
    } catch {
      // best-effort
    }
  }, [backend]);

  const handleConfigure = useCallback(async (connectorId: string) => {
    setError(null);
    setSuccess(null);
    setConfiguring(connectorId);
    // Load existing config
    try {
      const saved = await backend.connectorLoadConfig(connectorId);
      if (saved) {
        const creds: Record<string, string> = {};
        for (const [k, v] of Object.entries(saved)) {
          creds[k] = String(v);
        }
        setCredentials(creds);
      } else {
        setCredentials({});
      }
    } catch {
      setCredentials({});
    }
  }, [backend]);

  const handleCancel = useCallback(() => {
    setConfiguring(null);
    setCredentials({});
    setError(null);
    setSuccess(null);
  }, []);

  const handleSaveAndConnect = useCallback(async () => {
    if (!configuring) return;
    setTesting(true);
    setError(null);
    setSuccess(null);

    try {
      // Save config
      await backend.connectorSaveConfig(configuring, credentials);
      // Test connection
      const result = await backend.connectorTest(configuring, credentials);
      if (result.success) {
        setSuccess('Connected successfully!');
        await refreshState(configuring);
        // Close config after a short delay
        setTimeout(() => {
          setConfiguring(null);
          setCredentials({});
          setSuccess(null);
        }, 1200);
      } else {
        setError(result.error || 'Connection failed');
      }
    } catch (err) {
      setError((err as Error).message || 'Failed to connect');
    } finally {
      setTesting(false);
    }
  }, [configuring, credentials, backend, refreshState]);

  const handleDisconnect = useCallback(async (connectorId: string) => {
    try {
      // Clear the saved config to "disconnect"
      await backend.connectorSaveConfig(connectorId, {});
      setConnectors(prev =>
        prev.map(c => c.id === connectorId ? { ...c, status: 'disconnected' } : c)
      );
    } catch (err) {
      console.error('[WelcomeConnections] Failed to disconnect:', err);
    }
  }, [backend]);

  const isConnected = (status: string) => status === 'connected';

  if (loading) {
    return (
      <div className="welcome-connections">
        <div className="welcome-connections-header">
          <span className="welcome-connections-icon">🔌</span>
          <span className="welcome-connections-title">Connections</span>
        </div>
        <div className="welcome-connections-loading">Loading connectors…</div>
      </div>
    );
  }

  if (connectors.length === 0) {
    return (
      <div className="welcome-connections">
        <div className="welcome-connections-header">
          <span className="welcome-connections-icon">🔌</span>
          <span className="welcome-connections-title">Connections</span>
        </div>
        <div className="welcome-connections-empty">
          No connectors available
        </div>
      </div>
    );
  }

  return (
    <div className="welcome-connections">
      <div className="welcome-connections-header">
        <span className="welcome-connections-icon">🔌</span>
        <span className="welcome-connections-title">Connections</span>
        <span className="welcome-connections-count">{connectors.filter(c => isConnected(c.status)).length}/{connectors.length}</span>
      </div>
      <p className="welcome-connections-subtitle">
        Connect your tools to unlock integrations in workspaces
      </p>

      <div className="welcome-connections-list">
        {connectors.map(connector => {
          const connected = isConnected(connector.status);
          const isBeingConfigured = configuring === connector.id;
          const emoji = categoryEmoji[connector.category] || '🔌';

          return (
            <div
              key={connector.id}
              className={`welcome-connector-card ${connected ? 'connected' : 'disconnected'} ${isBeingConfigured ? 'configuring' : ''}`}
            >
              {/* Card Header */}
              <div className="welcome-connector-header">
                <div className="welcome-connector-icon-wrap">
                  <span className="welcome-connector-emoji">{emoji}</span>
                </div>
                <div className="welcome-connector-info">
                  <div className="welcome-connector-name-row">
                    <span className="welcome-connector-name">{connector.name}</span>
                    <span className={`welcome-connector-status-dot ${connected ? 'online' : 'offline'}`} />
                  </div>
                  <span className="welcome-connector-desc">{connector.description}</span>
                </div>
              </div>

              {/* Status + Action */}
              {!isBeingConfigured && (
                <div className="welcome-connector-actions">
                  {connected ? (
                    <>
                      <span className="welcome-connector-connected-label">✓ Connected</span>
                      <button
                        className="welcome-connector-btn-disconnect"
                        onClick={() => handleDisconnect(connector.id)}
                      >
                        Disconnect
                      </button>
                    </>
                  ) : (
                    <button
                      className="welcome-connector-btn-connect"
                      onClick={() => handleConfigure(connector.id)}
                    >
                      + Add Connection
                    </button>
                  )}
                </div>
              )}

              {/* Config Form */}
              {isBeingConfigured && (
                <div className="welcome-connector-config">
                  {connector.configFields.map(field => (
                    <div key={field.key} className="welcome-connector-field">
                      <label className="welcome-connector-field-label">
                        {field.label}
                        {field.required && <span className="required-star">*</span>}
                      </label>
                      <input
                        className="welcome-connector-field-input"
                        type={field.type === 'password' ? 'password' : 'text'}
                        placeholder={field.placeholder || ''}
                        value={credentials[field.key] || ''}
                        onChange={(e) =>
                          setCredentials(prev => ({ ...prev, [field.key]: e.target.value }))
                        }
                      />
                      {field.helpText && (
                        <span className="welcome-connector-field-help">{field.helpText}</span>
                      )}
                    </div>
                  ))}

                  {error && <div className="welcome-connector-error">{error}</div>}
                  {success && <div className="welcome-connector-success">{success}</div>}

                  <div className="welcome-connector-config-actions">
                    <button
                      className="welcome-connector-btn-cancel"
                      onClick={handleCancel}
                      disabled={testing}
                    >
                      Cancel
                    </button>
                    <button
                      className="welcome-connector-btn-save"
                      onClick={handleSaveAndConnect}
                      disabled={testing}
                    >
                      {testing ? 'Testing…' : 'Save & Connect'}
                    </button>
                  </div>
                </div>
              )}

              {/* Actions count when connected */}
              {connected && !isBeingConfigured && connector.actions.length > 0 && (
                <div className="welcome-connector-actions-count">
                  {connector.actions.length} action{connector.actions.length !== 1 ? 's' : ''} available
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
