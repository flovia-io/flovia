/**
 * AtlassianPanel - Jira integration with token-based connection, projects and tickets
 */
import { useState, useEffect } from 'react';
import type { AtlassianConnection, AtlassianProject, AtlassianIssue } from '../types/atlassian.types';
import { useBackend } from '../context/BackendContext';
import { ChevronDownIcon, ChevronRightIcon, RefreshIcon } from './icons';

// Atlassian logo icon
const AtlassianIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M7.12 11.084c-.294-.375-.75-.349-1.001.074L.609 21.137c-.252.424-.053.768.44.768h6.96c.246 0 .56-.2.69-.442.892-1.632.628-5.145-1.579-10.379zM11.614 1.088c-2.886 5.14-2.479 9.122-.496 12.735.193.353.514.546.83.546H18.3c.493 0 .695-.346.44-.769L12.615 1.161c-.25-.422-.703-.447-1.001-.073z"/>
  </svg>
);

// Issue type icons
const IssueTypeIcon = ({ type }: { type: string }) => {
  const lower = type.toLowerCase();
  if (lower.includes('bug')) return <span className="at-issue-type bug">🐛</span>;
  if (lower.includes('story')) return <span className="at-issue-type story">📗</span>;
  if (lower.includes('epic')) return <span className="at-issue-type epic">⚡</span>;
  if (lower.includes('sub')) return <span className="at-issue-type subtask">📎</span>;
  return <span className="at-issue-type task">✅</span>;
};

// Status badge
const StatusBadge = ({ status, category }: { status: string; category: string }) => {
  let cls = 'at-status';
  if (category === 'done') cls += ' done';
  else if (category === 'new') cls += ' todo';
  else cls += ' inprogress';
  return <span className={cls}>{status}</span>;
};

export default function AtlassianPanel() {
  const backend = useBackend();
  const [connections, setConnections] = useState<AtlassianConnection[]>([]);
  const [activeConnection, setActiveConnection] = useState<AtlassianConnection | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formDomain, setFormDomain] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formToken, setFormToken] = useState('');
  const [formError, setFormError] = useState('');
  const [formTesting, setFormTesting] = useState(false);
  const [projects, setProjects] = useState<AtlassianProject[]>([]);
  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  const [issuesCache, setIssuesCache] = useState<Record<string, AtlassianIssue[]>>({});
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingIssues, setLoadingIssues] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load saved connections on mount
  useEffect(() => {
    (async () => {
      const saved = await backend.atlassianLoadConnections();
      setConnections(saved);
      if (saved.length > 0) {
        setActiveConnection(saved[0]);
      }
    })();
  }, []);

  // Load projects when active connection changes
  useEffect(() => {
    if (activeConnection) {
      loadProjects();
    } else {
      setProjects([]);
    }
  }, [activeConnection]);

  const loadProjects = async () => {
    if (!activeConnection) return;
    setLoadingProjects(true);
    setError(null);
    try {
      const result = await backend.atlassianFetchProjects(activeConnection);
      if (result.success) {
        setProjects(result.projects);
      } else {
        setError(result.error || 'Failed to load projects');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load projects');
    } finally {
      setLoadingProjects(false);
    }
  };

  const loadIssues = async (projectKey: string) => {
    if (!activeConnection || issuesCache[projectKey]) return;
    setLoadingIssues(projectKey);
    try {
      const result = await backend.atlassianFetchIssues(activeConnection, projectKey);
      if (result.success) {
        setIssuesCache(prev => ({ ...prev, [projectKey]: result.issues }));
      }
    } catch (err) {
      console.error('Failed to load issues:', err);
    } finally {
      setLoadingIssues(null);
    }
  };

  const toggleProject = (projectKey: string) => {
    if (expandedProject === projectKey) {
      setExpandedProject(null);
    } else {
      setExpandedProject(projectKey);
      loadIssues(projectKey);
    }
  };

  const handleAddConnection = async () => {
    const domain = formDomain.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
    const email = formEmail.trim();
    const token = formToken.trim();

    if (!domain || !email || !token) {
      setFormError('All fields are required');
      return;
    }

    setFormTesting(true);
    setFormError('');

    const connection: AtlassianConnection = { domain, email, apiToken: token };

    try {
      const result = await backend.atlassianTestConnection(connection);
      if (!result.success) {
        setFormError(result.error || 'Connection failed. Check your credentials.');
        setFormTesting(false);
        return;
      }
    } catch {
      setFormError('Connection failed. Check your domain and credentials.');
      setFormTesting(false);
      return;
    }

    const updated = [...connections, connection];
    setConnections(updated);
    await backend.atlassianSaveConnections(updated);
    setActiveConnection(connection);
    setShowAddForm(false);
    setFormDomain('');
    setFormEmail('');
    setFormToken('');
    setFormError('');
    setFormTesting(false);
  };

  const removeConnection = async (index: number) => {
    const updated = connections.filter((_, i) => i !== index);
    setConnections(updated);
    await backend.atlassianSaveConnections(updated);
    if (activeConnection === connections[index]) {
      setActiveConnection(updated.length > 0 ? updated[0] : null);
      setProjects([]);
      setIssuesCache({});
      setExpandedProject(null);
    }
  };

  const openIssueInBrowser = (issueKey: string) => {
    if (!activeConnection) return;
    backend.shellOpenExternal(`https://${activeConnection.domain}/browse/${issueKey}`);
  };

  const refreshAll = () => {
    setIssuesCache({});
    setExpandedProject(null);
    loadProjects();
  };

  // ── No connections state ──
  if (connections.length === 0 && !showAddForm) {
    return (
      <div className="at-panel">
        <div className="at-panel-header">
          <AtlassianIcon size={20} />
          <h2>Atlassian</h2>
        </div>
        <div className="at-panel-empty">
          <p>No Atlassian connections configured.</p>
          <p className="at-hint">Connect your Jira instance to view projects and tickets.</p>
          <button className="at-add-btn" onClick={() => setShowAddForm(true)}>
            <span>＋</span> Add Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="at-panel">
      <div className="at-panel-header">
        <AtlassianIcon size={20} />
        <h2>Atlassian</h2>
        <div className="at-panel-header-actions">
          {activeConnection && (
            <button
              className="at-refresh-btn"
              onClick={refreshAll}
              disabled={loadingProjects}
              title="Refresh"
            >
              <RefreshIcon size={14} className={loadingProjects ? 'spinning' : ''} />
            </button>
          )}
          <button
            className="at-add-btn-small"
            onClick={() => setShowAddForm(v => !v)}
            title="Add connection"
          >
            ＋
          </button>
        </div>
      </div>

      {/* Connection form */}
      {showAddForm && (
        <div className="at-form">
          <label className="at-form-label">Domain</label>
          <input
            className="at-form-input"
            value={formDomain}
            onChange={e => setFormDomain(e.target.value)}
            placeholder="mycompany.atlassian.net"
          />
          <label className="at-form-label">Email</label>
          <input
            className="at-form-input"
            value={formEmail}
            onChange={e => setFormEmail(e.target.value)}
            placeholder="you@company.com"
          />
          <label className="at-form-label">API Token</label>
          <input
            className="at-form-input"
            type="password"
            value={formToken}
            onChange={e => setFormToken(e.target.value)}
            placeholder="Atlassian API token"
          />
          {formError && <div className="at-form-error">{formError}</div>}
          <div className="at-form-actions">
            <button className="at-form-cancel" onClick={() => { setShowAddForm(false); setFormError(''); }}>Cancel</button>
            <button className="at-form-save" onClick={handleAddConnection} disabled={formTesting}>
              {formTesting ? 'Testing…' : 'Connect'}
            </button>
          </div>
        </div>
      )}

      {/* Connection selector */}
      {connections.length > 0 && (
        <div className="at-connections">
          {connections.map((conn, idx) => (
            <div
              key={idx}
              className={`at-connection-item${activeConnection === conn ? ' active' : ''}`}
              onClick={() => setActiveConnection(conn)}
            >
              <span className="at-connection-dot">●</span>
              <span className="at-connection-domain">{conn.domain}</span>
              <button
                className="at-connection-remove"
                onClick={(e) => { e.stopPropagation(); removeConnection(idx); }}
                title="Remove connection"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="at-error">
          <span>{error}</span>
          <button className="at-error-retry" onClick={loadProjects}>Retry</button>
        </div>
      )}

      {/* Projects & Tickets */}
      {loadingProjects && projects.length === 0 && (
        <div className="at-loading">
          <span className="gh-tree-spinner"></span>
          <span>Loading projects…</span>
        </div>
      )}

      {!loadingProjects && projects.length === 0 && activeConnection && !error && (
        <div className="at-empty-projects">No projects found.</div>
      )}

      <div className="at-projects">
        {projects.map(project => {
          const isExpanded = expandedProject === project.key;
          const issues = issuesCache[project.key] || [];
          const isLoadingIssues = loadingIssues === project.key;

          return (
            <div key={project.id} className="at-project-group">
              <div
                className="at-project-item"
                onClick={() => toggleProject(project.key)}
              >
                <span className="at-chevron">
                  {isExpanded ? <ChevronDownIcon size={12} /> : <ChevronRightIcon size={12} />}
                </span>
                <span className="at-project-key">{project.key}</span>
                <span className="at-project-name">{project.name}</span>
              </div>

              {isExpanded && (
                <div className="at-issues">
                  {isLoadingIssues && issues.length === 0 && (
                    <div className="at-loading-issues">
                      <span className="gh-tree-spinner"></span>
                      <span>Loading tickets…</span>
                    </div>
                  )}
                  {issues.map(issue => (
                    <div
                      key={issue.id}
                      className="at-issue-item"
                      onClick={() => openIssueInBrowser(issue.key)}
                      title={`${issue.key}: ${issue.summary}`}
                    >
                      <IssueTypeIcon type={issue.issueType} />
                      <span className="at-issue-key">{issue.key}</span>
                      <span className="at-issue-summary">{issue.summary}</span>
                      <StatusBadge status={issue.status} category={issue.statusCategory} />
                    </div>
                  ))}
                  {!isLoadingIssues && issues.length === 0 && (
                    <div className="at-no-issues">No tickets found</div>
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
