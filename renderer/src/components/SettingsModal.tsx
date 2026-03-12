import { useState, useEffect, useCallback } from 'react';
import type { AISettings } from '../types';
import { useBackend } from '../context/BackendContext';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: (settings: AISettings) => void;
}

export default function SettingsModal({ open, onClose, onSaved }: Props) {
  const backend = useBackend();
  const [provider, setProvider] = useState<'ollama' | 'openai' | 'anthropic'>('ollama');
  const [baseUrl, setBaseUrl] = useState('http://localhost:11434/v1');
  const [apiKey, setApiKey] = useState('ollama');
  const [selectedModel, setSelectedModel] = useState('');
  const [models, setModels] = useState<string[]>([]);
  const [ollamaAvailable, setOllamaAvailable] = useState<boolean | null>(null);
  const [loadingModels, setLoadingModels] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Track the original loaded settings so provider switches can restore env-based keys
  const [loadedSettings, setLoadedSettings] = useState<AISettings | null>(null);
  // Cache of env-based API keys per provider (fetched once on open)
  const [envKeys, setEnvKeys] = useState<Record<string, { apiKey: string; baseUrl: string }>>({});

  // Load saved settings on open
  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const [settings, keys] = await Promise.all([
          backend.aiLoadSettings(),
          backend.aiGetEnvKeys(),
        ]);
        setLoadedSettings(settings);
        setEnvKeys(keys);
        setProvider(settings.provider);
        setBaseUrl(settings.baseUrl);
        setApiKey(settings.apiKey);
        setSelectedModel(settings.selectedModel);
      } catch { /* use defaults */ }

      const available = await backend.aiCheckOllama();
      setOllamaAvailable(available);
    })();
  }, [open]);

  // Fetch models when provider/url/key changes
  const fetchModels = useCallback(async () => {
    setLoadingModels(true);
    setError('');
    try {
      const list = await backend.aiListModels(baseUrl, apiKey);
      setModels(list);
      if (list.length > 0 && !list.includes(selectedModel)) {
        setSelectedModel(list[0]);
      }
    } catch {
      setModels([]);
      setError('Failed to fetch models. Check your connection and credentials.');
    } finally {
      setLoadingModels(false);
    }
  }, [baseUrl, apiKey, selectedModel]);

  useEffect(() => {
    if (!open) return;
    if (!baseUrl) return;
    fetchModels();
  }, [open, provider, baseUrl, apiKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleProviderChange = (p: 'ollama' | 'openai' | 'anthropic') => {
    setProvider(p);
    setModels([]);
    setError('');
    setSelectedModel('');

    // If the loaded/saved settings are for this provider, restore them.
    if (loadedSettings?.provider === p) {
      setBaseUrl(loadedSettings.baseUrl);
      setApiKey(loadedSettings.apiKey);
      return;
    }

    // Otherwise, use env-based keys if available; fall back to sensible defaults.
    const env = envKeys[p];
    if (p === 'ollama') {
      setBaseUrl(env?.baseUrl || 'http://localhost:11434/v1');
      setApiKey(env?.apiKey || 'ollama');
    } else if (p === 'openai') {
      setBaseUrl(env?.baseUrl || 'https://api.openai.com/v1');
      setApiKey(env?.apiKey || '');
    } else if (p === 'anthropic') {
      setBaseUrl('anthropic');
      setApiKey(env?.apiKey || '');
    }
  };

  const handleSave = async () => {
    if (!selectedModel) {
      setError('Please select a model.');
      return;
    }
    setSaving(true);
    const settings: AISettings = { provider, baseUrl, apiKey, selectedModel };
    await backend.aiSaveSettings(settings);
    setSaving(false);
    onSaved(settings);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>⚙️ AI Settings</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {/* Provider selector */}
          <label className="modal-label">Provider</label>
          <div className="provider-tabs">
            <button
              className={`provider-tab ${provider === 'ollama' ? 'active' : ''}`}
              onClick={() => handleProviderChange('ollama')}
            >
              🦙 Ollama
              {ollamaAvailable === true && <span className="dot green" />}
              {ollamaAvailable === false && <span className="dot red" />}
            </button>
            <button
              className={`provider-tab ${provider === 'openai' ? 'active' : ''}`}
              onClick={() => handleProviderChange('openai')}
            >
              🤖 OpenAI
            </button>
            <button
              className={`provider-tab ${provider === 'anthropic' ? 'active' : ''}`}
              onClick={() => handleProviderChange('anthropic')}
            >
              🟠 Anthropic
            </button>
          </div>

          {/* Ollama status notice */}
          {(() => {
            let isCloudUrl = false;
            try { isCloudUrl = new URL(baseUrl).hostname === 'ollama.com'; } catch { /* ignore */ }
            const isLocalUrl = baseUrl.includes('localhost') && !isCloudUrl;
            const showLocalWarning = provider === 'ollama' && ollamaAvailable === false && isLocalUrl;
            if (showLocalWarning) return (
              <div className="modal-notice warn">
                Ollama is not running locally.{' '}
                <a href="https://ollama.com/download" target="_blank" rel="noreferrer">
                  Download Ollama
                </a>{' '}
                and start it, or use{' '}
                <a href="https://ollama.com/blog/cloud" target="_blank" rel="noreferrer">
                  Ollama Cloud
                </a>{' '}
                by setting the base URL to <code>https://ollama.com/v1</code> with your API key.
                <button className="btn-link" onClick={fetchModels}>Refresh</button>
              </div>
            );
            return null;
          })()}
          {provider === 'ollama' && ollamaAvailable === true && (
            <div className="modal-notice ok">✅ Ollama detected and running.</div>
          )}

          {/* Base URL */}
          {provider !== 'anthropic' && (
            <>
              <label className="modal-label">Base URL</label>
              <input
                className="modal-input"
                value={baseUrl}
                onChange={e => setBaseUrl(e.target.value)}
                placeholder={provider === 'ollama' ? 'http://localhost:11434/v1' : 'https://api.openai.com/v1'}
              />
            </>
          )}

          {/* API Key */}
          <label className="modal-label">API Key</label>
          <input
            className="modal-input"
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder={provider === 'ollama' ? 'ollama' : provider === 'anthropic' ? 'sk-ant-...' : 'sk-...'}
          />
          {provider === 'openai' && !apiKey && (
            <div className="modal-notice warn">
              Enter your OpenAI API key to use OpenAI models.
            </div>
          )}
          {provider === 'anthropic' && !apiKey && (
            <div className="modal-notice warn">
              Enter your Anthropic API key to use Claude models.{' '}
              <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">
                Get an API key →
              </a>
            </div>
          )}

          {/* Model selector */}
          <label className="modal-label">
            Model
            <button className="btn-link" onClick={fetchModels} disabled={loadingModels}>
              {loadingModels ? '⟳ Loading…' : '↻ Refresh'}
            </button>
          </label>
          {models.length > 0 ? (
            <select
              className="modal-select"
              value={selectedModel}
              onChange={e => setSelectedModel(e.target.value)}
            >
              {models.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          ) : (
            <div className="modal-notice muted">
              {loadingModels ? 'Fetching models…' : 'No models found. Check your connection.'}
            </div>
          )}

          {error && <div className="modal-notice warn">{error}</div>}
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary modal-save" onClick={handleSave} disabled={saving || !selectedModel}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
