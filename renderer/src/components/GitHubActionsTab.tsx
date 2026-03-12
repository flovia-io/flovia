/**
 * GitHubActionsTab - Professional expandable tree view for GitHub Actions and Issues
 */
import { useState, useEffect } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { useBackend } from '../context/BackendContext';
import type { 
  GitHubWorkflow, 
  GitHubWorkflowRun, 
  GitHubJob,
  GitHubIssue 
} from '../types/github.types';
import { 
  ChevronDownIcon, 
  ChevronRightIcon, 
  RefreshIcon 
} from './icons';

// Status icons
const StatusIcon = ({ status, conclusion }: { status: string; conclusion: string | null }) => {
  if (status === 'completed') {
    switch (conclusion) {
      case 'success': return <span className="gh-tree-status success">✓</span>;
      case 'failure': return <span className="gh-tree-status failure">✕</span>;
      case 'cancelled': return <span className="gh-tree-status cancelled">⊘</span>;
      case 'skipped': return <span className="gh-tree-status skipped">○</span>;
      default: return <span className="gh-tree-status neutral">○</span>;
    }
  }
  if (status === 'in_progress') return <span className="gh-tree-status running">●</span>;
  if (status === 'queued') return <span className="gh-tree-status queued">○</span>;
  return <span className="gh-tree-status neutral">○</span>;
};

// Globe/link icon
const GlobeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
    <path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0zM5.78 1.81a6.5 6.5 0 0 0-2.9 2.69h2.42c.23-.89.54-1.71.91-2.43-.14-.05-.29-.1-.43-.26zm-.43 4.19H2.07a6.52 6.52 0 0 0 0 4h3.28a19.8 19.8 0 0 1 0-4zM2.88 11.5a6.5 6.5 0 0 0 2.9 2.69c-.14-.05-.29-.1-.43-.26-.37-.72-.68-1.54-.91-2.43H2.88zm4.12 3a6.5 6.5 0 0 0 2 0c-.66.06-1.33.06-2 0zm2-14a6.5 6.5 0 0 0-2 0c.67-.06 1.33-.06 2 0zm.78.31c.14.05.29.1.43.26.37.72.68 1.54.91 2.43h2.42a6.5 6.5 0 0 0-2.9-2.69h-.86zm3.34 4.19h-3.28a19.8 19.8 0 0 1 0 4h3.28a6.52 6.52 0 0 0 0-4zm-3.28 6h2.42a6.5 6.5 0 0 1-2.9 2.69c.14-.05.29-.1.43-.26.37-.72.68-1.54.91-2.43h-.86zM7 2.31c-.37.72-.68 1.54-.91 2.43h1.82c-.23-.89-.54-1.71-.91-2.43zM6.09 6a17.7 17.7 0 0 0 0 4h3.82a17.7 17.7 0 0 0 0-4H6.09zm.91 5.69c.37.72.68 1.54.91 2.43h1.82c-.23-.89-.54-1.71-.91-2.43-.37.72-.68 1.54-.91 2.43-.37-.72-.68-1.54-.91-2.43z"/>
  </svg>
);

// Issue state icon
const IssueIcon = ({ state }: { state: string }) => {
  if (state === 'open') return <span className="gh-tree-status success">◉</span>;
  return <span className="gh-tree-status neutral">◉</span>;
};

export default function GitHubActionsTab() {
  const { folderPath } = useWorkspace();
  const backend = useBackend();
  const [repoInfo, setRepoInfo] = useState<{ owner: string; repo: string } | null>(null);
  const [workflows, setWorkflows] = useState<GitHubWorkflow[]>([]);
  const [runs, setRuns] = useState<GitHubWorkflowRun[]>([]);
  const [currentBranchRun, setCurrentBranchRun] = useState<GitHubWorkflowRun | null>(null);
  const [expandedRuns, setExpandedRuns] = useState<Set<number>>(new Set());
  const [expandedJobs, setExpandedJobs] = useState<Set<number>>(new Set());
  const [jobsCache, setJobsCache] = useState<Record<number, GitHubJob[]>>({});
  const [issues, setIssues] = useState<GitHubIssue[]>([]);
  const [issuesLoading, setIssuesLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [topSections, setTopSections] = useState({
    actions: true,
    issues: true
  });
  const [sectionsExpanded, setSectionsExpanded] = useState({
    currentBranch: true,
    workflows: false
  });

  // Extract repo info from git remote
  useEffect(() => {
    const detectRepo = async () => {
      if (!folderPath) {
        setError('No folder open');
        setLoading(false);
        return;
      }
      
      try {
        const result = await backend.readFile(`${folderPath}/.git/config`);
        if (result.success && result.content) {
          const remoteMatch = result.content.match(/\[remote "origin"\][\s\S]*?url = (.+)/);
          if (remoteMatch) {
            const info = await backend.githubExtractRepoInfo(remoteMatch[1].trim());
            if (info) {
              setRepoInfo(info);
              return;
            }
          }
        }
        setError('Not a GitHub repository');
        setLoading(false);
      } catch {
        setError('Could not detect repository');
        setLoading(false);
      }
    };
    
    detectRepo();
  }, [folderPath]);

  // Load workflows and runs when repo info is available
  useEffect(() => {
    if (!repoInfo) return;
    loadData();
  }, [repoInfo]);

  const loadData = async () => {
    if (!repoInfo) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const workflowsResult = await backend.githubListWorkflows(repoInfo.owner, repoInfo.repo);
      if (workflowsResult.success) {
        setWorkflows(workflowsResult.workflows);
      }
      
      const runsResult = await backend.githubListWorkflowRuns(repoInfo.owner, repoInfo.repo, undefined, 20);
      if (runsResult.success) {
        setRuns(runsResult.runs);
        if (runsResult.runs.length > 0) {
          setCurrentBranchRun(runsResult.runs[0]);
        }
      }

      loadIssues();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  const loadIssues = async () => {
    if (!repoInfo) return;
    
    setIssuesLoading(true);
    try {
      const result = await backend.githubListIssues(repoInfo.owner, repoInfo.repo, 'open', 20);
      if (result.success) {
        setIssues(result.issues);
      }
    } catch (err) {
      console.error('[GitHub] Failed to load issues:', err instanceof Error ? err.message : err);
    } finally {
      setIssuesLoading(false);
    }
  };

  const loadJobsForRun = async (runId: number) => {
    if (!repoInfo || jobsCache[runId]) return;
    
    try {
      const result = await backend.githubListRunJobs(repoInfo.owner, repoInfo.repo, runId);
      if (result.success) {
        setJobsCache(prev => ({ ...prev, [runId]: result.jobs }));
      }
    } catch (err) {
      console.error('[GitHub] Failed to load jobs for run', runId, ':', err instanceof Error ? err.message : err);
    }
  };

  const toggleRun = (runId: number) => {
    setExpandedRuns(prev => {
      const next = new Set(prev);
      if (next.has(runId)) {
        next.delete(runId);
      } else {
        next.add(runId);
        loadJobsForRun(runId);
      }
      return next;
    });
  };

  const toggleJob = (jobId: number) => {
    setExpandedJobs(prev => {
      const next = new Set(prev);
      if (next.has(jobId)) {
        next.delete(jobId);
      } else {
        next.add(jobId);
      }
      return next;
    });
  };

  const toggleSection = (section: 'currentBranch' | 'workflows') => {
    setSectionsExpanded(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const toggleTopSection = (section: 'actions' | 'issues') => {
    setTopSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const openInBrowser = (url: string) => {
    backend.shellOpenExternal(url);
  };

  const viewLogs = async (job: GitHubJob) => {
    if (!repoInfo) return;
    
    try {
      const result = await backend.githubGetJobLogs(repoInfo.owner, repoInfo.repo, job.id);
      if (result.success) {
        const event = new CustomEvent('open-github-logs-tab', {
          detail: { jobName: job.name, jobId: job.id, logs: result.logs }
        });
        window.dispatchEvent(event);
      } else {
        alert(result.error || 'Failed to fetch logs');
      }
    } catch {
      alert('Failed to fetch logs');
    }
  };

  const renderRun = (run: GitHubWorkflowRun, depth: number = 0) => {
    const isExpanded = expandedRuns.has(run.id);
    const jobs = jobsCache[run.id] || [];
    const hasJobs = isExpanded && jobs.length > 0;
    
    return (
      <div key={run.id} className="gh-tree-item-group">
        <div 
          className={`gh-tree-item depth-${depth}`}
          onClick={() => toggleRun(run.id)}
        >
          <span className="gh-tree-chevron">
            {isExpanded ? <ChevronDownIcon size={12} /> : <ChevronRightIcon size={12} />}
          </span>
          <StatusIcon status={run.status} conclusion={run.conclusion} />
          <span className="gh-tree-label">{run.name} #{run.run_number}</span>
          <button 
            className="gh-tree-action" 
            onClick={(e) => { e.stopPropagation(); openInBrowser(run.html_url); }}
            title="Open in browser"
          >
            <GlobeIcon />
          </button>
        </div>
        
        {hasJobs && (
          <div className="gh-tree-children">
            {jobs.map(job => renderJob(job, depth + 1))}
          </div>
        )}
        
        {isExpanded && jobs.length === 0 && !jobsCache[run.id] && (
          <div className="gh-tree-item depth-1 gh-tree-loading">
            <span className="gh-tree-spinner"></span>
            <span className="gh-tree-label">Loading jobs...</span>
          </div>
        )}
      </div>
    );
  };

  const renderJob = (job: GitHubJob, depth: number = 1) => {
    const isExpanded = expandedJobs.has(job.id);
    const hasSteps = job.steps && job.steps.length > 0;
    
    return (
      <div key={job.id} className="gh-tree-item-group">
        <div 
          className={`gh-tree-item depth-${depth}`}
          onClick={() => hasSteps && toggleJob(job.id)}
        >
          <span className="gh-tree-chevron">
            {hasSteps ? (
              isExpanded ? <ChevronDownIcon size={12} /> : <ChevronRightIcon size={12} />
            ) : <span style={{ width: 12 }} />}
          </span>
          <StatusIcon status={job.status} conclusion={job.conclusion} />
          <span className="gh-tree-label">{job.name}</span>
          <button 
            className="gh-tree-action"
            onClick={(e) => { e.stopPropagation(); viewLogs(job); }}
            title="View logs"
          >
            ≡
          </button>
        </div>
        
        {isExpanded && hasSteps && (
          <div className="gh-tree-children">
            {job.steps.map(step => (
              <div key={step.number} className={`gh-tree-item depth-${depth + 1}`}>
                <span className="gh-tree-chevron" style={{ width: 12 }} />
                <StatusIcon status={step.status} conclusion={step.conclusion} />
                <span className="gh-tree-label">{step.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderIssue = (issue: GitHubIssue) => (
    <div key={issue.id} className="gh-tree-item-group">
      <div 
        className="gh-tree-item depth-0"
        onClick={() => openInBrowser(issue.html_url)}
      >
        <span className="gh-tree-chevron" style={{ width: 12 }} />
        <IssueIcon state={issue.state} />
        <span className="gh-tree-label">#{issue.number} {issue.title}</span>
        {issue.labels.length > 0 && (
          <span className="gh-tree-issue-labels">
            {issue.labels.slice(0, 2).map(label => (
              <span 
                key={label.id} 
                className="gh-tree-issue-label"
                style={{ backgroundColor: `#${label.color}` }}
              />
            ))}
          </span>
        )}
        <button 
          className="gh-tree-action"
          onClick={(e) => { e.stopPropagation(); openInBrowser(issue.html_url); }}
          title="Open in browser"
        >
          <GlobeIcon />
        </button>
      </div>
    </div>
  );

  if (loading && !workflows.length) {
    return (
      <div className="gh-tree-panel">
        <div className="gh-tree-header">
          <span className="gh-tree-title">GITHUB</span>
          <button className="gh-tree-refresh" disabled>
            <RefreshIcon size={14} className="spinning" />
          </button>
        </div>
        <div className="gh-tree-loading-state">
          <span className="gh-tree-spinner"></span>
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="gh-tree-panel">
        <div className="gh-tree-header">
          <span className="gh-tree-title">GITHUB</span>
        </div>
        <div className="gh-tree-empty">
          <span>{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="gh-tree-panel">
      <div className="gh-tree-header">
        <span className="gh-tree-title">GITHUB</span>
        <button 
          className="gh-tree-refresh" 
          onClick={loadData}
          disabled={loading}
          title="Refresh"
        >
          <RefreshIcon size={14} className={loading ? 'spinning' : ''} />
        </button>
      </div>

      <div className="gh-tree-content">
        {/* ACTIONS collapsible section */}
        <div className="gh-tree-top-section">
          <div 
            className="gh-tree-top-section-header"
            onClick={() => toggleTopSection('actions')}
          >
            <span className="gh-tree-chevron">
              {topSections.actions ? <ChevronDownIcon size={12} /> : <ChevronRightIcon size={12} />}
            </span>
            <span className="gh-tree-section-title">ACTIONS</span>
          </div>
          
          {topSections.actions && (
            <div className="gh-tree-top-section-content">
              {currentBranchRun && (
                <div className="gh-tree-section">
                  <div 
                    className="gh-tree-section-header"
                    onClick={() => toggleSection('currentBranch')}
                  >
                    <span className="gh-tree-chevron">
                      {sectionsExpanded.currentBranch ? <ChevronDownIcon size={12} /> : <ChevronRightIcon size={12} />}
                    </span>
                    <span className="gh-tree-section-title">CURRENT BRANCH</span>
                  </div>
                  
                  {sectionsExpanded.currentBranch && (
                    <div className="gh-tree-section-content">
                      {renderRun(currentBranchRun, 0)}
                    </div>
                  )}
                </div>
              )}

              <div className="gh-tree-section">
                <div className="gh-tree-section-header">
                  <span className="gh-tree-section-title" style={{ marginLeft: 0 }}>RECENT RUNS</span>
                </div>
                <div className="gh-tree-section-content">
                  {runs.map(run => renderRun(run, 0))}
                </div>
              </div>

              <div className="gh-tree-section">
                <div 
                  className="gh-tree-section-header"
                  onClick={() => toggleSection('workflows')}
                >
                  <span className="gh-tree-chevron">
                    {sectionsExpanded.workflows ? <ChevronDownIcon size={12} /> : <ChevronRightIcon size={12} />}
                  </span>
                  <span className="gh-tree-section-title">WORKFLOWS</span>
                </div>
                
                {sectionsExpanded.workflows && (
                  <div className="gh-tree-section-content">
                    {workflows.map(workflow => (
                      <div 
                        key={workflow.id} 
                        className="gh-tree-item depth-0"
                        onClick={() => openInBrowser(workflow.html_url)}
                      >
                        <span className="gh-tree-chevron" style={{ width: 12 }} />
                        <span className={`gh-tree-workflow-dot ${workflow.state}`}>●</span>
                        <span className="gh-tree-label">{workflow.name}</span>
                        <button 
                          className="gh-tree-action"
                          onClick={(e) => { e.stopPropagation(); openInBrowser(workflow.html_url); }}
                          title="Open in browser"
                        >
                          <GlobeIcon />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ISSUES collapsible section */}
        <div className="gh-tree-top-section">
          <div 
            className="gh-tree-top-section-header"
            onClick={() => toggleTopSection('issues')}
          >
            <span className="gh-tree-chevron">
              {topSections.issues ? <ChevronDownIcon size={12} /> : <ChevronRightIcon size={12} />}
            </span>
            <span className="gh-tree-section-title">ISSUES</span>
          </div>
          
          {topSections.issues && (
            <div className="gh-tree-top-section-content">
              {issuesLoading && issues.length === 0 ? (
                <div className="gh-tree-loading-state">
                  <span className="gh-tree-spinner"></span>
                  <span>Loading issues...</span>
                </div>
              ) : issues.length === 0 ? (
                <div className="gh-tree-empty">
                  <span>No open issues</span>
                </div>
              ) : (
                issues.map(issue => renderIssue(issue))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
