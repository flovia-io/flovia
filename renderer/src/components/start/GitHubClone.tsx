/**
 * GitHubClone - GitHub repository clone component for the start page
 * Allows users to clone a GitHub repository into a new session folder.
 * Automatically uses the token from the connected GitHub plugin when available.
 */
import { useState, useCallback, type ChangeEvent, type FormEvent } from 'react';
import { useBackend } from '../../context/BackendContext';
import { GitHubIcon } from '../icons';

interface GitHubCloneProps {
  onWorkspaceCreated?: (folderPath: string) => void;
}

export default function GitHubClone({ onWorkspaceCreated }: GitHubCloneProps) {
  const backend = useBackend();
  const [expanded, setExpanded] = useState(false);
  const [repoUrl, setRepoUrl] = useState('');
  const [token, setToken] = useState('');
  const [connectorConnected, setConnectorConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  // Load saved token on expand — prefer the connected GitHub plugin token
  const handleExpand = useCallback(async () => {
    setExpanded(true);
    try {
      // First, try to get token from the connected GitHub connector (plugin)
      const state = await backend.connectorGetState('github');
      if (state.status === 'connected') {
        const config = await backend.connectorLoadConfig('github');
        if (config?.token) {
          setToken(config.token as string);
          setConnectorConnected(true);
          return;
        }
      }
    } catch {
      // connector not available — fall through
    }
    try {
      // Fallback: try environment keys
      const envKeys = await backend.aiGetEnvKeys();
      if (envKeys.github?.apiKey) {
        setToken(envKeys.github.apiKey);
      }
    } catch {
      // Ignore - no saved token
    }
  }, [backend]);

  // Handle clone
  const handleClone = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    if (!repoUrl.trim() || loading) return;

    setLoading(true);
    setError(null);
    setStatus('Cloning repository...');

    try {
      const result = await backend.sessionCloneGitHub(repoUrl.trim(), token || undefined);
      
      if (result.success && result.folderPath) {
        setStatus('Clone successful! Opening workspace...');
        
        // Open the cloned folder as a workspace
        const clonedPath = result.folderPath;
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('open-workspace', { detail: { folderPath: clonedPath } }));
          onWorkspaceCreated?.(clonedPath);
          setExpanded(false);
          setRepoUrl('');
          setStatus(null);
        }, 500);
      } else {
        setError(result.error || 'Failed to clone repository');
        setStatus(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [repoUrl, token, loading, backend, onWorkspaceCreated]);

  // Handle URL input
  const handleUrlChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setRepoUrl(e.target.value);
    setError(null);
  }, []);

  // Collapsed state
  if (!expanded) {
    return (
      <button 
        className="github-clone-btn"
        onClick={handleExpand}
        title="Clone from GitHub"
      >
        <GitHubIcon />
        Clone from GitHub
      </button>
    );
  }

  return (
    <div className="github-clone-panel">
      <div className="github-clone-header">
        <div className="github-clone-title">
          <GitHubIcon />
          <span>Clone from GitHub</span>
        </div>
        <button 
          className="github-clone-close"
          onClick={() => setExpanded(false)}
          title="Cancel"
        >
          ×
        </button>
      </div>

      <form onSubmit={handleClone} className="github-clone-form">
        <div className="github-clone-field">
          <label htmlFor="repo-url">Repository URL</label>
          <input
            id="repo-url"
            type="text"
            placeholder="https://github.com/owner/repo"
            value={repoUrl}
            onChange={handleUrlChange}
            disabled={loading}
          />
        </div>

        {connectorConnected ? (
          <div className="github-clone-connected">
            <span className="github-clone-connected-dot" />
            Using connected GitHub account
          </div>
        ) : (
          <div className="github-clone-field">
            <label htmlFor="github-token">
              GitHub Token <span className="optional">(optional, for private repos)</span>
            </label>
            <input
              id="github-token"
              type="password"
              placeholder="ghp_..."
              value={token}
              onChange={(e) => setToken(e.target.value)}
              disabled={loading}
            />
          </div>
        )}

        {error && (
          <div className="github-clone-error">{error}</div>
        )}

        {status && (
          <div className="github-clone-status">{status}</div>
        )}

        <div className="github-clone-actions">
          <button 
            type="button" 
            className="github-clone-cancel"
            onClick={() => setExpanded(false)}
            disabled={loading}
          >
            Cancel
          </button>
          <button 
            type="submit" 
            className="github-clone-submit"
            disabled={loading || !repoUrl.trim()}
          >
            {loading ? 'Cloning...' : 'Clone Repository'}
          </button>
        </div>
      </form>
    </div>
  );
}
