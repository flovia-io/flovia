/**
 * ExecutionsPanel — Past runs list + step-by-step run detail view.
 *
 * Refactored to use shared execution view components from ../shared/ExecutionViewParts
 * so the same step cards, data blocks, and status icons are reused across
 * both workflow execution and agent debug panels.
 */
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import Chip from '@mui/material/Chip';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import HistoryIcon from '@mui/icons-material/History';
import ReplayIcon from '@mui/icons-material/Replay';
import DeleteIcon from '@mui/icons-material/Delete';
import AccessTimeIcon from '@mui/icons-material/AccessTime';

import {
  StatusIcon,
  RunHeader,
  StepTimeline,
  formatDuration,
} from '../shared/ExecutionViewParts';
import type { RunLog } from './workflow.types';

interface Props {
  runs: RunLog[];
  activeRunId: string | null;
  onSelectRun: (id: string) => void;
  onDeleteRun?: (id: string) => void;
  onReplayRun?: (id: string) => void;
}

export function ExecutionsPanel({ runs, activeRunId, onSelectRun, onDeleteRun, onReplayRun }: Props) {
  const activeRun = runs.find(r => r.id === activeRunId);
  const sortedRuns = [...runs].reverse(); // newest first

  return (
    <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      {/* Runs list */}
      <Box sx={{
        width: 280,
        borderRight: 1,
        borderColor: 'divider',
        overflow: 'auto',
        bgcolor: '#fafafa',
      }}>
        <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <HistoryIcon sx={{ fontSize: 20, color: 'primary.main' }} />
          <Typography variant="subtitle1" fontWeight={700}>Executions</Typography>
          <Chip label={runs.length} size="small" sx={{ ml: 'auto', height: 22, fontSize: 11, fontWeight: 700 }} />
        </Box>
        <Divider />
        {runs.length === 0 && (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography sx={{ color: 'text.secondary', fontSize: 13, mb: 1 }}>
              No executions yet
            </Typography>
            <Typography sx={{ color: 'text.disabled', fontSize: 11 }}>
              Run the workflow to see results here
            </Typography>
          </Box>
        )}
        <List dense sx={{ py: 0.5 }}>
          {sortedRuns.map((run, idx) => {
            const totalDuration = run.finishedAt
              ? (new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime())
              : undefined;
            const stepCount = run.steps?.length || 0;
            const failedCount = run.steps?.filter(s => s.status === 'failed').length || 0;

            return (
              <ListItemButton
                key={run.id}
                selected={run.id === activeRunId}
                onClick={() => onSelectRun(run.id)}
                sx={{
                  mx: 0.5,
                  borderRadius: 1.5,
                  mb: 0.25,
                  transition: 'all 0.15s',
                  ...(run.id === activeRunId && {
                    bgcolor: 'primary.main',
                    color: '#fff',
                    '&:hover': { bgcolor: 'primary.dark' },
                    '& .MuiTypography-root': { color: '#fff' },
                    '& .MuiChip-root': { bgcolor: 'rgba(255,255,255,0.2)', color: '#fff' },
                    '& .MuiSvgIcon-root': { color: '#fff !important' },
                  }),
                }}
              >
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <StatusIcon status={run.status} size={18} />
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <span>Run #{runs.length - idx}</span>
                      {failedCount > 0 && (
                        <Chip label={`${failedCount} failed`} size="small" color="error" variant="outlined" sx={{ height: 16, fontSize: 9 }} />
                      )}
                    </Box>
                  }
                  secondary={
                    <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <AccessTimeIcon sx={{ fontSize: 10 }} />
                      <span>{new Date(run.startedAt).toLocaleString()}</span>
                      {totalDuration != null && <span> · {formatDuration(totalDuration)}</span>}
                    </Box>
                  }
                  primaryTypographyProps={{ fontSize: 12, fontWeight: 700 }}
                  secondaryTypographyProps={{ fontSize: 10 }}
                />
                <Chip
                  label={`${stepCount} steps`}
                  size="small"
                  sx={{ height: 20, fontSize: 10, fontWeight: 600 }}
                />
              </ListItemButton>
            );
          })}
        </List>
      </Box>

      {/* Run detail */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 0 }}>
        {activeRun ? (
          <RunDetail
            run={activeRun}
            runIndex={runs.indexOf(activeRun) + 1}
            onDelete={onDeleteRun ? () => onDeleteRun(activeRun.id) : undefined}
            onReplay={onReplayRun ? () => onReplayRun(activeRun.id) : undefined}
          />
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'text.secondary', gap: 1 }}>
            <HistoryIcon sx={{ fontSize: 48, opacity: 0.2 }} />
            <Typography sx={{ fontSize: 14 }}>Select a run to view execution details</Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}

// ─── Run Detail ──────────────────────────────────────────────────────────────

function RunDetail({ run, runIndex, onDelete, onReplay }: {
  run: RunLog;
  runIndex: number;
  onDelete?: () => void;
  onReplay?: () => void;
}) {
  const completedCount = run.steps?.filter(s => s.status === 'completed').length || 0;
  const failedCount = run.steps?.filter(s => s.status === 'failed').length || 0;

  const steps = (run.steps || []).map(s => ({
    nodeId: s.nodeId,
    label: s.label,
    status: s.status,
    durationMs: s.durationMs,
    itemCount: s.itemCount,
    input: s.input,
    output: s.output,
    error: s.error,
  }));

  return (
    <Box sx={{ p: 2.5 }}>
      <RunHeader
        status={run.status}
        label={`Run #${runIndex}`}
        startedAt={run.startedAt}
        finishedAt={run.finishedAt}
        stepCount={run.steps?.length || 0}
        completedCount={completedCount}
        failedCount={failedCount}
        actions={
          <>
            {onReplay && (
              <Tooltip title="Replay this run">
                <IconButton size="small" onClick={onReplay}><ReplayIcon fontSize="small" /></IconButton>
              </Tooltip>
            )}
            {onDelete && (
              <Tooltip title="Delete this run">
                <IconButton size="small" color="error" onClick={onDelete}><DeleteIcon fontSize="small" /></IconButton>
              </Tooltip>
            )}
          </>
        }
      />

      <StepTimeline steps={steps} />
    </Box>
  );
}
