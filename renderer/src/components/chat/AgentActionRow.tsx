import { useState } from 'react';
import { computeSimpleDiff, isDiffTruncated } from '../../utils/diffUtils';
import { getFileIcon } from '../../utils/fileIcons';
import type { FileActionProgress } from '../../types';

interface AgentActionRowProps {
  action: FileActionProgress;
  onFileClick: (file: string) => void;
}

const statusIcons: Record<string, string> = {
  pending: '⏳',
  reading: '📖',
  updating: '✏️',
  done: '✅',
  error: '❌',
};

const statusLabels: Record<string, string> = {
  pending: 'Pending',
  reading: 'Reading…',
  updating: 'Updating…',
  done: 'Done',
  error: 'Error',
};

/**
 * Single file action progress row with collapsible diff
 */
export default function AgentActionRow({ action, onFileClick }: AgentActionRowProps) {
  const [expanded, setExpanded] = useState(false);

  const statusIcon = statusIcons[action.status] ?? '⏳';
  const statusLabel = statusLabels[action.status] ?? '';

  const hasDiff = action.status === 'done' && action.diff;
  const diff = hasDiff
    ? computeSimpleDiff(action.diff!.before, action.diff!.after)
    : null;

  const truncated = hasDiff
    ? isDiffTruncated(action.diff!.before, action.diff!.after)
    : false;

  return (
    <div className={`agent-action-row status-${action.status}`}>
      <div
        className="agent-action-header"
        onClick={() => hasDiff && setExpanded(!expanded)}
      >
        <span className="agent-action-icon">{statusIcon}</span>
        <span
          className="agent-action-file"
          onClick={(e) => {
            e.stopPropagation();
            onFileClick(action.plan.file);
          }}
          title={`Open ${action.plan.file}`}
        >
          {getFileIcon(action.plan.file)} {action.plan.file}
        </span>
        <span className="agent-action-badge">{action.plan.action}</span>
        <span className="agent-action-status">{statusLabel}</span>
        {(action.status === 'reading' || action.status === 'updating') && (
          <span className="agent-spinner" />
        )}
        {hasDiff && (
          <span className="agent-action-toggle">{expanded ? '▾' : '▸'}</span>
        )}
      </div>
      {action.error && <div className="agent-action-error">{action.error}</div>}
      {expanded && diff && (
        <div className="agent-diff">
          {diff.removed.map((line, k) => (
            <div key={`r${k}`} className="diff-removed">
              - {line}
            </div>
          ))}
          {diff.added.map((line, k) => (
            <div key={`a${k}`} className="diff-added">
              + {line}
            </div>
          ))}
          {truncated && <div className="diff-truncated">… (diff truncated)</div>}
        </div>
      )}
      <div className="agent-action-desc">{action.plan.description}</div>
    </div>
  );
}
