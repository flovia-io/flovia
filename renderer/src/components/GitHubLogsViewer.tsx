/**
 * GitHubLogsViewer - Displays GitHub Actions job logs
 */
import { useWorkspace } from '../context/WorkspaceContext';

// GitHub Icon component
const GitHubIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
  </svg>
);

interface GitHubLogsViewerProps {
  logs: string;
  jobName: string;
}

export default function GitHubLogsViewer({ logs, jobName }: GitHubLogsViewerProps) {
  const { setTabData, activeTabPath } = useWorkspace();

  // Parse logs to add syntax highlighting
  const formatLogs = (rawLogs: string) => {
    return rawLogs
      .split('\n')
      .map((line, index) => {
        let className = 'gh-log-line';
        
        // Highlight different types of lines
        if (line.includes('##[error]') || line.toLowerCase().includes('error')) {
          className += ' gh-log-error';
        } else if (line.includes('##[warning]') || line.toLowerCase().includes('warning')) {
          className += ' gh-log-warning';
        } else if (line.includes('##[group]') || line.startsWith('Run ')) {
          className += ' gh-log-group';
        } else if (line.includes('##[endgroup]')) {
          className += ' gh-log-endgroup';
        } else if (line.match(/^\d{4}-\d{2}-\d{2}T/)) {
          className += ' gh-log-timestamp';
        }
        
        return (
          <div key={index} className={className}>
            <span className="gh-log-number">{index + 1}</span>
            <span className="gh-log-content">{line}</span>
          </div>
        );
      });
  };

  const downloadLogs = () => {
    const blob = new Blob([logs], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${jobName.replace(/[^a-zA-Z0-9]/g, '_')}_logs.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(logs);
      // Could show a toast notification here
    } catch (err) {
      console.error('Failed to copy logs:', err);
    }
  };

  return (
    <div className="gh-logs-viewer">
      <div className="gh-logs-header">
        <div className="gh-logs-title">
          <GitHubIcon size={18} />
          <h2>{jobName}</h2>
          <span className="gh-logs-badge">Logs</span>
        </div>
        <div className="gh-logs-actions">
          <button className="gh-logs-action-btn" onClick={copyToClipboard} title="Copy to clipboard">
            📋 Copy
          </button>
          <button className="gh-logs-action-btn" onClick={downloadLogs} title="Download logs">
            ⬇️ Download
          </button>
        </div>
      </div>
      
      <div className="gh-logs-content">
        {logs ? (
          <div className="gh-logs-lines">
            {formatLogs(logs)}
          </div>
        ) : (
          <div className="gh-logs-empty">
            <span>📭</span>
            <p>No logs available</p>
          </div>
        )}
      </div>
    </div>
  );
}
