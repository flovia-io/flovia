/**
 * GeminiPanel - Gemini Image Generation sidebar panel
 *
 * Connect with an API key, generate images from text prompts,
 * and edit existing images using Gemini's native image generation.
 */
import { useState, useEffect, useCallback } from 'react';
import { useBackend } from '../context/BackendContext';
import { ChevronDownIcon, ChevronRightIcon, RefreshIcon } from './icons';

const GeminiIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.4 0 0 5.4 0 12c0 3.2 1.3 6.2 3.5 8.4l.1-.1C5.2 18.7 8.4 17.5 12 17.5s6.8 1.2 8.4 2.8l.1.1C22.7 18.2 24 15.2 24 12c0-6.6-5.4-12-12-12zm0 6c1.7 0 3 1.3 3 3s-1.3 3-3 3-3-1.3-3-3 1.3-3 3-3z" />
  </svg>
);

const MODELS = [
  { value: 'gemini-2.5-flash-image', label: 'Gemini 2.5 Flash Image' },
  { value: 'gemini-3.1-flash-image-preview', label: 'Gemini 3.1 Flash Image' },
  { value: 'gemini-3-pro-image-preview', label: 'Gemini 3 Pro Image' },
];

const ASPECT_RATIOS = ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3'];
const IMAGE_SIZES = ['512', '1K', '2K', '4K'];

interface GeneratedImage {
  id: string;
  prompt: string;
  imageBase64: string;
  mimeType: string;
  text?: string;
  timestamp: string;
}

export default function GeminiPanel() {
  const backend = useBackend();
  const [connected, setConnected] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formApiKey, setFormApiKey] = useState('');
  const [formModel, setFormModel] = useState('gemini-2.5-flash-image');
  const [formError, setFormError] = useState('');
  const [formTesting, setFormTesting] = useState(false);

  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('gemini-2.5-flash-image');

  // Generation state
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [imageSize, setImageSize] = useState('1K');
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);

  // Load saved config on mount
  useEffect(() => {
    (async () => {
      try {
        const config = await backend.connectorLoadConfig('gemini');
        if (config && (config as Record<string, string>).apiKey) {
          const c = config as { apiKey: string; model: string };
          setApiKey(c.apiKey);
          setModel(c.model || 'gemini-2.5-flash-image');
          setConnected(true);
        }
      } catch {
        // no saved config
      }
    })();
  }, []);

  const handleConnect = async () => {
    const key = formApiKey.trim();
    if (!key) {
      setFormError('API key is required');
      return;
    }

    setFormTesting(true);
    setFormError('');

    try {
      const result = await backend.connectorTest('gemini', { apiKey: key, model: formModel });
      if (!result.success) {
        setFormError(result.error || 'Connection failed. Check your API key.');
        setFormTesting(false);
        return;
      }
    } catch {
      setFormError('Connection failed. Check your API key.');
      setFormTesting(false);
      return;
    }

    await backend.connectorSaveConfig('gemini', { apiKey: key, model: formModel });
    setApiKey(key);
    setModel(formModel);
    setConnected(true);
    setShowForm(false);
    setFormApiKey('');
    setFormError('');
    setFormTesting(false);
  };

  const handleDisconnect = async () => {
    setConnected(false);
    setApiKey('');
    setModel('gemini-2.5-flash-image');
    setImages([]);
    setExpandedImage(null);
    await backend.connectorSaveConfig('gemini', {});
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    setGenerating(true);
    setGenError(null);

    try {
      const result = await backend.connectorExecute('gemini', 'generate-image', {
        prompt: prompt.trim(),
        aspectRatio,
        imageSize,
      });

      if (result.success && result.data) {
        const data = result.data as { imageBase64: string; mimeType: string; text?: string };
        const img: GeneratedImage = {
          id: `img-${Date.now()}`,
          prompt: prompt.trim(),
          imageBase64: data.imageBase64,
          mimeType: data.mimeType || 'image/png',
          text: data.text,
          timestamp: new Date().toLocaleTimeString(),
        };
        setImages(prev => [img, ...prev]);
        setExpandedImage(img.id);
      } else {
        setGenError(result.error || 'Failed to generate image');
      }
    } catch (err) {
      setGenError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = (img: GeneratedImage) => {
    const link = document.createElement('a');
    link.href = `data:${img.mimeType};base64,${img.imageBase64}`;
    const ext = img.mimeType.includes('png') ? 'png' : 'jpg';
    link.download = `gemini-${Date.now()}.${ext}`;
    link.click();
  };

  // ── Not connected state ──
  if (!connected && !showForm) {
    return (
      <div className="gm-panel">
        <div className="gm-panel-header">
          <GeminiIcon size={20} />
          <h2>Gemini Image Gen</h2>
        </div>
        <div className="gm-panel-empty">
          <p>No Gemini account connected.</p>
          <p className="gm-hint">Connect your Google AI API key to generate images with Gemini.</p>
          <button className="gm-add-btn" onClick={() => setShowForm(true)}>
            <span>+</span> Connect Gemini
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="gm-panel">
      <div className="gm-panel-header">
        <GeminiIcon size={20} />
        <h2>Gemini Image Gen</h2>
        <div className="gm-panel-header-actions">
          {connected ? (
            <button className="gm-disconnect-btn" onClick={handleDisconnect} title="Disconnect">
              x
            </button>
          ) : (
            <button className="gm-add-btn-small" onClick={() => setShowForm(v => !v)} title="Connect">
              +
            </button>
          )}
        </div>
      </div>

      {/* Connection form */}
      {showForm && !connected && (
        <div className="gm-form">
          <label className="gm-form-label">API Key</label>
          <input
            className="gm-form-input"
            type="password"
            value={formApiKey}
            onChange={e => setFormApiKey(e.target.value)}
            placeholder="AIza..."
          />
          <label className="gm-form-label">Model</label>
          <select
            className="gm-form-input"
            value={formModel}
            onChange={e => setFormModel(e.target.value)}
          >
            {MODELS.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
          <p className="gm-form-help">
            Get your API key from{' '}
            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
              aistudio.google.com/apikey
            </a>
          </p>
          {formError && <div className="gm-form-error">{formError}</div>}
          <div className="gm-form-actions">
            <button className="gm-form-cancel" onClick={() => { setShowForm(false); setFormError(''); }}>Cancel</button>
            <button className="gm-form-save" onClick={handleConnect} disabled={formTesting}>
              {formTesting ? 'Testing...' : 'Connect'}
            </button>
          </div>
        </div>
      )}

      {/* Connected status */}
      {connected && (
        <div className="gm-account">
          <span className="gm-account-dot">*</span>
          <span className="gm-account-email">{MODELS.find(m => m.value === model)?.label || model}</span>
        </div>
      )}

      {/* Generation form */}
      {connected && (
        <div style={{ padding: '8px 12px' }}>
          <textarea
            className="gm-form-input"
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="Describe the image you want to generate..."
            rows={3}
            style={{ resize: 'vertical', fontFamily: 'inherit' }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <div style={{ flex: 1 }}>
              <label className="gm-form-label" style={{ fontSize: 11 }}>Aspect Ratio</label>
              <select
                className="gm-form-input"
                value={aspectRatio}
                onChange={e => setAspectRatio(e.target.value)}
                style={{ padding: '3px 6px', fontSize: 12 }}
              >
                {ASPECT_RATIOS.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label className="gm-form-label" style={{ fontSize: 11 }}>Size</label>
              <select
                className="gm-form-input"
                value={imageSize}
                onChange={e => setImageSize(e.target.value)}
                style={{ padding: '3px 6px', fontSize: 12 }}
              >
                {IMAGE_SIZES.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
          <button
            className="gm-form-save"
            onClick={handleGenerate}
            disabled={generating || !prompt.trim()}
            style={{ width: '100%', marginTop: 8 }}
          >
            {generating ? 'Generating...' : 'Generate Image'}
          </button>
        </div>
      )}

      {/* Error */}
      {genError && (
        <div className="gm-error">
          <span>{genError}</span>
          <button className="gm-error-retry" onClick={() => setGenError(null)}>Dismiss</button>
        </div>
      )}

      {/* Generated images */}
      <div className="gm-messages" style={{ padding: '0 8px' }}>
        {images.map(img => {
          const isExpanded = expandedImage === img.id;
          return (
            <div key={img.id} className="gm-message-group" style={{ marginBottom: 8 }}>
              <div
                className="gm-message-item"
                onClick={() => setExpandedImage(isExpanded ? null : img.id)}
                style={{ cursor: 'pointer' }}
              >
                <span className="gm-chevron">
                  {isExpanded ? <ChevronDownIcon size={12} /> : <ChevronRightIcon size={12} />}
                </span>
                <span className="gm-message-subject" style={{ flex: 1 }}>
                  {img.prompt.length > 50 ? img.prompt.slice(0, 50) + '...' : img.prompt}
                </span>
                <span className="gm-message-date">{img.timestamp}</span>
              </div>
              {isExpanded && (
                <div style={{ padding: '8px 4px' }}>
                  <img
                    src={`data:${img.mimeType};base64,${img.imageBase64}`}
                    alt={img.prompt}
                    style={{
                      width: '100%',
                      borderRadius: 6,
                      border: '1px solid var(--border-color, #e0e0e0)',
                    }}
                  />
                  {img.text && (
                    <p style={{ fontSize: 11, color: 'var(--text-secondary, #666)', marginTop: 4 }}>
                      {img.text}
                    </p>
                  )}
                  <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                    <button
                      className="gm-form-cancel"
                      onClick={() => handleDownload(img)}
                      style={{ fontSize: 11, padding: '3px 8px' }}
                    >
                      Download
                    </button>
                    <button
                      className="gm-form-cancel"
                      onClick={() => {
                        navigator.clipboard.writeText(img.imageBase64);
                      }}
                      style={{ fontSize: 11, padding: '3px 8px' }}
                    >
                      Copy Base64
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
