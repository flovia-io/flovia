/**
 * WelcomeConnections - Right-side panel on the Welcome page
 * 
 * Shows all available connectors (from the connector registry) with
 * their connection status. Users can configure and connect each one.
 * Connectors are greyed out until they are added/connected.
 * 
 * Also includes the AI Provider connection card at the top.
 */
import { useState, useEffect, useCallback } from 'react';
import { useBackend } from '../../context/BackendContext';
import type { AISettings } from '../../types';

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

  // ── AI Provider state ──
  const [aiSettings, setAiSettings] = useState<AISettings | null>(null);
  const [aiConfiguring, setAiConfiguring] = useState(false);
  const [aiProvider, setAiProvider] = useState<'ollama' | 'openai' | 'anthropic'>('ollama');
  const [aiBaseUrl, setAiBaseUrl] = useState('http://localhost:11434/v1');
  const [aiApiKey, setAiApiKey] = useState('ollama');
  const [aiSelectedModel, setAiSelectedModel] = useState('');
  const [aiModels, setAiModels] = useState<string[]>([]);
  const [aiOllamaAvailable, setAiOllamaAvailable] = useState<boolean | null>(null);
  const [aiLoadingModels, setAiLoadingModels] = useState(false);
  const [aiSaving, setAiSaving] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiEnvKeys, setAiEnvKeys] = useState<Record<string, { apiKey: string; baseUrl: string }>>({});

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

  // ── AI Provider helpers ──
  const loadAiSettings = useCallback(async () => {
    try {
      const [settings, keys] = await Promise.all([
        backend.aiLoadSettings(),
        backend.aiGetEnvKeys(),
      ]);
      setAiSettings(settings);
      setAiEnvKeys(keys);
      setAiProvider(settings.provider);
      setAiBaseUrl(settings.baseUrl);
      setAiApiKey(settings.apiKey);
      setAiSelectedModel(settings.selectedModel);
      const available = await backend.aiCheckOllama();
      setAiOllamaAvailable(available);
    } catch { /* use defaults */ }
  }, [backend]);

  useEffect(() => { loadAiSettings(); }, [loadAiSettings]);

  const fetchAiModels = useCallback(async () => {
    setAiLoadingModels(true);
    setAiError('');
    try {
      const list = await backend.aiListModels(aiBaseUrl, aiApiKey);
      setAiModels(list);
      if (list.length > 0 && !list.includes(aiSelectedModel)) {
        setAiSelectedModel(list[0]);
      }
    } catch {
      setAiModels([]);
      setAiError('Failed to fetch models. Check your connection and credentials.');
    } finally {
      setAiLoadingModels(false);
    }
  }, [backend, aiBaseUrl, aiApiKey, aiSelectedModel]);

  useEffect(() => {
    if (aiConfiguring && aiBaseUrl) fetchAiModels();
  }, [aiConfiguring, aiProvider, aiBaseUrl, aiApiKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAiProviderChange = (p: 'ollama' | 'openai' | 'anthropic') => {
    setAiProvider(p);
    setAiModels([]);
    setAiError('');
    setAiSelectedModel('');
    if (aiSettings?.provider === p) {
      setAiBaseUrl(aiSettings.baseUrl);
      setAiApiKey(aiSettings.apiKey);
      return;
    }
    const env = aiEnvKeys[p];
    if (p === 'ollama') {
      setAiBaseUrl(env?.baseUrl || 'http://localhost:11434/v1');
      setAiApiKey(env?.apiKey || 'ollama');
    } else if (p === 'openai') {
      setAiBaseUrl(env?.baseUrl || 'https://api.openai.com/v1');
      setAiApiKey(env?.apiKey || '');
    } else if (p === 'anthropic') {
      setAiBaseUrl('anthropic');
      setAiApiKey(env?.apiKey || '');
    }
  };

  const handleAiSave = async () => {
    if (!aiSelectedModel) { setAiError('Please select a model.'); return; }
    setAiSaving(true);
    const settings: AISettings = { provider: aiProvider, baseUrl: aiBaseUrl, apiKey: aiApiKey, selectedModel: aiSelectedModel };
    await backend.aiSaveSettings(settings);
    setAiSettings(settings);
    setAiSaving(false);
    setAiConfiguring(false);
  };

  const aiConnected = !!(aiSettings?.selectedModel);
  const aiProviderLabel = aiSettings
    ? `${aiSettings.provider === 'ollama' ? '🦙' : aiSettings.provider === 'openai' ? '🤖' : '🟠'} ${aiSettings.provider.charAt(0).toUpperCase() + aiSettings.provider.slice(1)} — ${aiSettings.selectedModel}`
    : 'Not configured';

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

  // Removed the empty-connectors bail-out — we always show the AI provider card

  return (
    <div className="welcome-connections">
      <div className="welcome-connections-header">
        <span className="welcome-connections-icon">🔌</span>
        <span className="welcome-connections-title">Connections</span>
        <span className="welcome-connections-count">{connectors.filter(c => isConnected(c.status)).length + (aiConnected ? 1 : 0)}/{connectors.length + 1}</span>
      </div>
      <p className="welcome-connections-subtitle">
        Connect your tools to unlock integrations in workspaces
      </p>

      <div className="welcome-connections-list">
        {/* ── AI Provider Card ── */}
        <div className={`welcome-connector-card ${aiConnected ? 'connected' : 'disconnected'} ${aiConfiguring ? 'configuring' : ''}`}>
          <div className="welcome-connector-header">
            <div className="welcome-connector-icon-wrap">
              <span className="welcome-connector-emoji">🧠</span>
            </div>
            <div className="welcome-connector-info">
              <div className="welcome-connector-name-row">
                <span className="welcome-connector-name">AI Provider</span>
                <span className={`welcome-connector-status-dot ${aiConnected ? 'online' : 'offline'}`} />
              </div>
              <span className="welcome-connector-desc">
                {aiConnected ? aiProviderLabel : 'Configure your AI model provider (Ollama, OpenAI, Anthropic)'}
              </span>
            </div>
          </div>

          {!aiConfiguring && (
            <div className="welcome-connector-actions">
              {aiConnected ? (
                <>
                  <span className="welcome-connector-connected-label">✓ Connected</span>
                  <button className="welcome-connector-btn-connect" onClick={() => { setAiConfiguring(true); }}>
                    Configure
                  </button>
                </>
              ) : (
                <button className="welcome-connector-btn-connect" onClick={() => setAiConfiguring(true)}>
                  + Configure AI
                </button>
              )}
            </div>
          )}

          {aiConfiguring && (
            <div className="welcome-connector-config">
              {/* Provider tabs */}
              <label className="welcome-connector-field-label">Provider</label>
              <div className="provider-tabs" style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                <button
                  className={`provider-tab ${aiProvider === 'ollama' ? 'active' : ''}`}
                  onClick={() => handleAiProviderChange('ollama')}
                  style={{ flex: 1 }}
                >
                  🦙 Ollama
                  {aiOllamaAvailable === true && <span className="dot green" />}
                  {aiOllamaAvailable === false && <span className="dot red" />}
                </button>
                <button
                  className={`provider-tab ${aiProvider === 'openai' ? 'active' : ''}`}
                  onClick={() => handleAiProviderChange('openai')}
                  style={{ flex: 1 }}
                >
                  🤖 OpenAI
                </button>
                <button
                  className={`provider-tab ${aiProvider === 'anthropic' ? 'active' : ''}`}
                  onClick={() => handleAiProviderChange('anthropic')}
                  style={{ flex: 1 }}
                >
                  🟠 Anthropic
                </button>
              </div>

              {/* Ollama status */}
              {aiProvider === 'ollama' && aiOllamaAvailable === true && (
                <div className="welcome-connector-success" style={{ marginBottom: 8 }}>✅ Ollama detected and running.</div>
              )}
              {aiProvider === 'ollama' && aiOllamaAvailable === false && aiBaseUrl.includes('localhost') && (
                <div className="welcome-connector-error" style={{ marginBottom: 8 }}>
                  Ollama is not running locally.{' '}
                  <a href="https://ollama.com/download" target="_blank" rel="noreferrer">Download Ollama</a>
                </div>
              )}

              {/* Base URL */}
              {aiProvider !== 'anthropic' && (
                <div className="welcome-connector-field">
                  <label className="welcome-connector-field-label">Base URL</label>
                  <input
                    className="welcome-connector-field-input"
                    value={aiBaseUrl}
                    onChange={e => setAiBaseUrl(e.target.value)}
                    placeholder={aiProvider === 'ollama' ? 'http://localhost:11434/v1' : 'https://api.openai.com/v1'}
                  />
                </div>
              )}

              {/* API Key */}
              <div className="welcome-connector-field">
                <label className="welcome-connector-field-label">API Key</label>
                <input
                  className="welcome-connector-field-input"
                  type="password"
                  value={aiApiKey}
                  onChange={e => setAiApiKey(e.target.value)}
                  placeholder={aiProvider === 'ollama' ? 'ollama' : aiProvider === 'anthropic' ? 'sk-ant-...' : 'sk-...'}
                />
              </div>

              {/* Model selector */}
              <div className="welcome-connector-field">
                <label className="welcome-connector-field-label">
                  Model
                  <button className="btn-link" onClick={fetchAiModels} disabled={aiLoadingModels} style={{ marginLeft: 8, fontSize: '0.75rem' }}>
                    {aiLoadingModels ? '⟳ Loading…' : '↻ Refresh'}
                  </button>
                </label>
                {aiModels.length > 0 ? (
                  <select
                    className="welcome-connector-field-input"
                    value={aiSelectedModel}
                    onChange={e => setAiSelectedModel(e.target.value)}
                    style={{ height: 34 }}
                  >
                    {aiModels.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                ) : (
                  <div style={{ fontSize: '0.8rem', color: '#888', padding: '4px 0' }}>
                    {aiLoadingModels ? 'Fetching models…' : 'No models found. Check your connection.'}
                  </div>
                )}
              </div>

              {aiError && <div className="welcome-connector-error">{aiError}</div>}

              <div className="welcome-connector-config-actions">
                <button className="welcome-connector-btn-cancel" onClick={() => { setAiConfiguring(false); setAiError(''); }}>
                  Cancel
                </button>
                <button className="welcome-connector-btn-save" onClick={handleAiSave} disabled={aiSaving || !aiSelectedModel}>
                  {aiSaving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Regular connector cards ── */}
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
