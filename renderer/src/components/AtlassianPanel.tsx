/**
 * AtlassianPanel - Jira integration with token-based connection, projects and tickets
 *
 * Refactored to use ConnectorPanelShell, ExpandableListItem, and shared utilities.
 */
import { useState, useEffect } from 'react';
import type { AtlassianConnection, AtlassianProject, AtlassianIssue } from '../types/atlassian.types';
import { useBackend } from '../context/BackendContext';
import { ChevronDownIcon, ChevronRightIcon } from './icons';
import { ConnectorPanelShell } from './shared';
import type { ConnectorField } from './shared/ConnectorPanelShell';

// Atlassian logo icon
const AtlassianIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M7.12 11.084c-.294-.375-.75-.349-1.001.074L.609 21.137c-.252.424-.053.768.44.768h6.96c.246 0 .56-.2.69-.442.892-1.632.628-5.145-1.579-10.379zM11.614 1.088c-2.886 5.14-2.479 9.122-.496 12.735.193.353.514.546.83.546H18.3c.493 0 .695-.346.44-.769L12.615 1.161c-.25-.422-.703-.447-1.001-.073z"/>
  </svg>
);

// Issue type icons
const ISSUE_TYPE_ICONS: Record<string, string> = {
  bug: '🐛',
  story: '📗',
  epic: '⚡',
  sub: '📎',
};

function getIssueTypeIcon(type: string): string {
  const lower = type.toLowerCase();
  for (const [key, icon] of Object.entries(ISSUE_TYPE_ICONS)) {
    if (lower.includes(key)) return icon;
  }
  return '✅';
}

// Status badge
function StatusBadge({ status, category }: { status: string; category: string }) {
  let cls = 'at-status';
  if (category === 'done') cls += ' done';
  else if (category === 'new') cls += ' todo';
  else cls += ' inprogress';
  return <span className={cls}>{status}</span>;
}

const FORM_FIELDS: ConnectorField[] = [
  { key: 'domain', label: 'Domain', placeholder: 'mycompany.atlassian.net' },
  { key: 'email', label: 'Email', type: 'email', placeholder: 'you@company.com' },
  { key: 'token', label: 'API Token', type: 'password', placeholder: 'Atlassian API token' },
];

export default function AtlassianPanel() {
  const backend = useBackend();
  const [connections, setConnections] = useState<AtlassianConnection[]>([]);
  const [activeConnection, setActiveConnection] = useState<AtlassianConnection | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formValues, setFormValues] = useState<Record<string, string>>({ domain: '', email: '', token: '' });
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
      if (saved.length > 0) setActiveConnection(saved[0]);
    })();
  }, []);

  // Load projects when active connection changes
  useEffect(() => {
    if (activeConnection) loadProjects();
    else { setProjects([]); }
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
    const domain = formValues.domain?.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
    const email = formValues.email?.trim();
    const token = formValues.token?.trim();

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
    setFormValues({ domain: '', email: '', token: '' });
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

  const connected = connections.length > 0;

  return (
    <ConnectorPanelShell
      title="Atlassian"
      icon={<AtlassianIcon size={20} />}
      classPrefix="at"
      connected={connected}
      showForm={showAddForm}
      onToggleForm={setShowAddForm}
      formFields={FORM_FIELDS}
      formValues={formValues}
      onFormChange={(key, val) => setFormValues(prev => ({ ...prev, [key]: val }))}
      formError={formError}
      formBusy={formTesting}
      formSubmitLabel="Connect"
      onFormSubmit={handleAddConnection}
      onFormCancel={() => { setShowAddForm(false); setFormError(''); }}
      onRefresh={activeConnection ? refreshAll : undefined}
      refreshing={loadingProjects}
      error={error}
      onRetry={loadProjects}
      loading={loadingProjects && projects.length === 0}
      loadingLabel="Loading projects…"
      empty={!loadingProjects && projects.length === 0 && !!activeConnection && !error}
      emptyLabel="No projects found."
    >
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
                onClick={e => { e.stopPropagation(); removeConnection(idx); }}
                title="Remove connection"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Projects & Tickets */}
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
                      <span className="gh-tree-spinner" />
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
                      <span className={`at-issue-type ${issue.issueType.toLowerCase()}`}>
                        {getIssueTypeIcon(issue.issueType)}
                      </span>
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
    </ConnectorPanelShell>
  );
}
