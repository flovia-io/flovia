/**
 * ExecutionsPanel — Past runs list + step-by-step run detail view.
 * Shows item counts per step, duration, expandable input/output, and status timeline.
 */
import { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Paper from '@mui/material/Paper';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import LinearProgress from '@mui/material/LinearProgress';
import HistoryIcon from '@mui/icons-material/History';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ReplayIcon from '@mui/icons-material/Replay';
import DeleteIcon from '@mui/icons-material/Delete';
import AccessTimeIcon from '@mui/icons-material/AccessTime';

import { STATUS_COLORS } from './workflow.constants';
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
  const totalDuration = run.finishedAt
    ? (new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime())
    : undefined;
  const completedCount = run.steps?.filter(s => s.status === 'completed').length || 0;
  const failedCount = run.steps?.filter(s => s.status === 'failed').length || 0;
  const totalItems = run.steps?.reduce((sum, s) => sum + ((s as any).itemCount || 0), 0) || 0;

  return (
    <Box sx={{ p: 2.5 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <Box sx={{
          width: 40, height: 40, borderRadius: 2,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          bgcolor: STATUS_COLORS[run.status] + '15',
        }}>
          <StatusIcon status={run.status} size={24} />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 800, fontSize: 16, lineHeight: 1.2 }}>
            Run #{runIndex}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {new Date(run.startedAt).toLocaleString()}
          </Typography>
        </Box>
        <Chip
          label={run.status}
          size="small"
          sx={{
            fontWeight: 700,
            bgcolor: STATUS_COLORS[run.status] + '18',
            color: STATUS_COLORS[run.status],
            textTransform: 'capitalize',
          }}
        />
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
      </Box>

      {/* Stats row */}
      <Box sx={{
        display: 'flex', gap: 2, mb: 2, p: 1.5,
        bgcolor: '#f8f9fa', borderRadius: 2, border: '1px solid #e9ecef',
      }}>
        <StatBadge label="Steps" value={run.steps?.length || 0} color="#3b82f6" />
        <StatBadge label="Completed" value={completedCount} color="#22c55e" />
        {failedCount > 0 && <StatBadge label="Failed" value={failedCount} color="#ef4444" />}
        {totalItems > 0 && <StatBadge label="Total items" value={totalItems} color="#8b5cf6" />}
        {totalDuration != null && <StatBadge label="Duration" value={formatDuration(totalDuration)} color="#64748b" />}
      </Box>

      {/* Progress bar */}
      {run.status === 'running' && (
        <LinearProgress sx={{ mb: 2, borderRadius: 1 }} />
      )}

      <Divider sx={{ mb: 2 }} />

      {/* Steps timeline */}
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5, fontSize: 13 }}>
        Step Timeline
      </Typography>

      <Stack spacing={0}>
        {run.steps?.map((step, idx) => (
          <StepCard key={idx} step={step} index={idx} isLast={idx === (run.steps?.length || 0) - 1} />
        ))}
      </Stack>
    </Box>
  );
}

// ─── Step Card (expandable) ─────────────────────────────────────────────────

function StepCard({ step, index, isLast }: { step: any; index: number; isLast: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const hasData = step.input != null || step.output != null || step.error;

  return (
    <Box sx={{ display: 'flex', gap: 1.5 }}>
      {/* Timeline line + dot */}
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 24, flexShrink: 0 }}>
        <Box sx={{
          width: 12, height: 12, borderRadius: '50%',
          bgcolor: STATUS_COLORS[step.status] || '#94a3b8',
          border: '2px solid #fff',
          boxShadow: `0 0 0 2px ${STATUS_COLORS[step.status] || '#94a3b8'}40`,
          zIndex: 1,
        }} />
        {!isLast && (
          <Box sx={{ width: 2, flex: 1, bgcolor: '#e2e8f0', mt: -0.5, mb: -0.5 }} />
        )}
      </Box>

      {/* Card content */}
      <Paper
        variant="outlined"
        sx={{
          flex: 1,
          mb: 1.5,
          borderRadius: 2,
          borderLeft: 3,
          borderColor: STATUS_COLORS[step.status] || '#94a3b8',
          overflow: 'hidden',
          transition: 'all 0.15s',
          '&:hover': { boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
        }}
      >
        <Box
          sx={{
            px: 2, py: 1.25,
            display: 'flex', alignItems: 'center', gap: 1,
            cursor: hasData ? 'pointer' : 'default',
          }}
          onClick={() => hasData && setExpanded(!expanded)}
        >
          <StatusIcon status={step.status} size={16} />
          <Typography variant="subtitle2" sx={{ fontSize: 12, fontWeight: 700, flex: 1 }}>
            {step.label}
          </Typography>

          {step.itemCount != null && (
            <Chip
              label={`${step.itemCount} item${step.itemCount !== 1 ? 's' : ''}`}
              size="small"
              color={step.status === 'completed' ? 'success' : 'default'}
              variant="outlined"
              sx={{ height: 20, fontSize: 10, fontWeight: 600 }}
            />
          )}

          {step.durationMs !== undefined && (
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 10, fontWeight: 600 }}>
              {formatDuration(step.durationMs)}
            </Typography>
          )}

          {hasData && (
            <IconButton size="small" sx={{ ml: -0.5 }}>
              {expanded ? <ExpandLessIcon sx={{ fontSize: 16 }} /> : <ExpandMoreIcon sx={{ fontSize: 16 }} />}
            </IconButton>
          )}
        </Box>

        {step.error && !expanded && (
          <Box sx={{ px: 2, pb: 1 }}>
            <Typography variant="caption" sx={{ color: 'error.main', fontSize: 11 }}>
              {step.error}
            </Typography>
          </Box>
        )}

        <Collapse in={expanded}>
          <Divider />
          <Box sx={{ px: 2, py: 1.5 }}>
            {step.error && (
              <DataBlock label="ERROR" data={step.error} color="#ef4444" />
            )}
            {step.input != null && (
              <DataBlock label="INPUT" data={step.input} color="#3b82f6" />
            )}
            {step.output != null && (
              <DataBlock label="OUTPUT" data={step.output} color="#22c55e" />
            )}
          </Box>
        </Collapse>
      </Paper>
    </Box>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function StatBadge({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <Box sx={{ textAlign: 'center', flex: 1 }}>
      <Typography sx={{ fontSize: 16, fontWeight: 800, color, lineHeight: 1.2 }}>{value}</Typography>
      <Typography sx={{ fontSize: 10, color: 'text.secondary', fontWeight: 600 }}>{label}</Typography>
    </Box>
  );
}

function StatusIcon({ status, size }: { status: string; size: number }) {
  if (status === 'completed') return <CheckCircleIcon sx={{ fontSize: size, color: '#22c55e' }} />;
  if (status === 'failed') return <ErrorIcon sx={{ fontSize: size, color: '#ef4444' }} />;
  if (status === 'running') return <HourglassEmptyIcon sx={{ fontSize: size, color: '#3b82f6' }} />;
  return <HourglassEmptyIcon sx={{ fontSize: size, color: '#94a3b8' }} />;
}

function DataBlock({ label, data, color }: { label: string; data: unknown; color?: string }) {
  const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  return (
    <Box sx={{ mb: 1 }}>
      <Typography variant="caption" sx={{ color: color || 'text.secondary', fontWeight: 700, fontSize: 10, letterSpacing: 0.5 }}>
        {label}
      </Typography>
      <Box sx={{
        bgcolor: '#f5f5f5',
        borderRadius: 1.5,
        p: 1,
        mt: 0.5,
        maxHeight: 200,
        overflow: 'auto',
        border: '1px solid #e8e8e8',
      }}>
        <Typography sx={{ fontSize: 11, fontFamily: '"JetBrains Mono", monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.5 }}>
          {text}
        </Typography>
      </Box>
    </Box>
  );
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}
