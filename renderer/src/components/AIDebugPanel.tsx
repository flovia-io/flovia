/**
 * AIDebugPanel — Unified agent debug view using the same workflow canvas.
 *
 * Renders agent runs on the actual agent pipeline canvas with:
 *  - Run list sidebar (newest first)
 *  - The agent's pipeline graph with execution data overlaid on each node
 *  - If a node is hit multiple times (loops), shows "Run 1", "Run 2", etc.
 *  - Expandable data table below each node with structured input/output per run
 *  - Toggle between canvas debug view and classic timeline view
 *
 * Shares components with the workflow editor for a unified experience.
 */
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
import Button from '@mui/material/Button';
import LinearProgress from '@mui/material/LinearProgress';
import HistoryIcon from '@mui/icons-material/History';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import StopCircleIcon from '@mui/icons-material/StopCircle';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import BugReportIcon from '@mui/icons-material/BugReport';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import ViewListIcon from '@mui/icons-material/ViewList';

import { useAgentExecution } from '../context/AgentExecutionContext';
import type { AgentTrace, TraceStep } from '../types/agent.types';

import {
  StatusIcon,
  StatBadge,
  RunHeader,
  StepTimeline,
  formatDuration,
} from './shared/ExecutionViewParts';
import type { StepCardData } from './shared/ExecutionViewParts';

import { WorkflowDebugView } from './workflow/WorkflowDebugView';

// ─── Trace → StepCardData adapter ──────────────────────────────────────────

function traceStepToCardData(step: TraceStep): StepCardData {
  return {
    nodeId: step.id,
    label: step.nodeLabel,
    status: step.status === 'success' ? 'completed' : step.status === 'error' ? 'failed' : step.status,
    durationMs: step.durationMs,
    input: step.input,
    output: step.output,
    error: step.error,
    category: step.category,
    type: step.type,
    tokens: step.tokens,
    timestamp: step.timestamp,
  };
}

// ─── Status normalization ───────────────────────────────────────────────────

function traceStatusToRunStatus(status: string): string {
  if (status === 'success') return 'completed';
  if (status === 'error') return 'failed';
  return status;
}

// ─── View modes ─────────────────────────────────────────────────────────────

type DebugViewMode = 'canvas' | 'timeline';

// ─── Main Panel ─────────────────────────────────────────────────────────────

export default function AIDebugPanel() {
  const {
    traces, activeTraceId, setActiveTraceId, finishTrace, clearTraces,
    activeAgent,
  } = useAgentExecution();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoSelect, setAutoSelect] = useState(true);
  const [viewMode, setViewMode] = useState<DebugViewMode>('canvas');

  // Auto-select newest running trace
  useEffect(() => {
    if (!autoSelect) return;
    const running = traces.find(t => t.status === 'running');
    if (running && running.id !== activeTraceId) {
      setActiveTraceId(running.id);
    }
  }, [traces, autoSelect, activeTraceId, setActiveTraceId]);

  const activeTrace = useMemo(
    () => traces.find(t => t.id === activeTraceId) || null,
    [traces, activeTraceId],
  );

  const handleClearAll = useCallback(() => {
    clearTraces();
  }, [clearTraces]);

  const handleStopRunning = useCallback(() => {
    const running = traces.find(t => t.status === 'running');
    if (running) finishTrace('success');
  }, [traces, finishTrace]);

  const runningCount = traces.filter(t => t.status === 'running').length;

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#fafafa' }}>
      {/* ── Toolbar ── */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 2,
          py: 1,
          borderBottom: '1px solid #e0e0e0',
          bgcolor: '#fff',
          flexShrink: 0,
        }}
      >
        <BugReportIcon sx={{ fontSize: 20, color: 'primary.main' }} />
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          Agent Debug
        </Typography>
        {activeAgent && (
          <Chip
            label={activeAgent.name}
            size="small"
            sx={{ fontSize: 10, height: 20, bgcolor: '#e3f2fd', color: '#1976d2', fontWeight: 600 }}
          />
        )}
        <Box sx={{ flex: 1 }} />
        {runningCount > 0 && (
          <Chip
            label={`${runningCount} running`}
            size="small"
            sx={{
              bgcolor: '#3b82f6',
              color: '#fff',
              fontWeight: 600,
              fontSize: 10,
              height: 22,
              animation: 'pulse 1.5s infinite',
              '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.6 } },
            }}
          />
        )}
        <Chip label={`${traces.length} runs`} size="small" sx={{ fontSize: 10, height: 20 }} />

        {/* View mode toggle */}
        <Box sx={{ display: 'flex', gap: 0, border: '1px solid #e0e0e0', borderRadius: 1.5, overflow: 'hidden', ml: 0.5 }}>
          <Tooltip title="Canvas view (workflow)">
            <Button
              size="small"
              onClick={() => setViewMode('canvas')}
              sx={{
                minWidth: 32, px: 1, py: 0.25, borderRadius: 0, fontSize: 10,
                bgcolor: viewMode === 'canvas' ? '#e3f2fd' : 'transparent',
                color: viewMode === 'canvas' ? '#1976d2' : '#9e9e9e',
                '&:hover': { bgcolor: viewMode === 'canvas' ? '#bbdefb' : '#f5f5f5' },
              }}
            >
              <AccountTreeIcon sx={{ fontSize: 16 }} />
            </Button>
          </Tooltip>
          <Tooltip title="Timeline view (list)">
            <Button
              size="small"
              onClick={() => setViewMode('timeline')}
              sx={{
                minWidth: 32, px: 1, py: 0.25, borderRadius: 0, fontSize: 10,
                borderLeft: '1px solid #e0e0e0',
                bgcolor: viewMode === 'timeline' ? '#e3f2fd' : 'transparent',
                color: viewMode === 'timeline' ? '#1976d2' : '#9e9e9e',
                '&:hover': { bgcolor: viewMode === 'timeline' ? '#bbdefb' : '#f5f5f5' },
              }}
            >
              <ViewListIcon sx={{ fontSize: 16 }} />
            </Button>
          </Tooltip>
        </Box>

        {runningCount > 0 && (
          <Tooltip title="Stop running agent">
            <IconButton size="small" onClick={handleStopRunning} sx={{ color: '#ef4444' }}>
              <StopCircleIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        )}
        <Tooltip title="Clear all traces">
          <span>
            <IconButton size="small" onClick={handleClearAll} disabled={traces.length === 0} sx={{ color: '#78909c' }}>
              <DeleteSweepIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      {/* Running progress */}
      {runningCount > 0 && <LinearProgress sx={{ height: 2 }} />}

      {/* ── Body ── */}
      {traces.length === 0 ? (
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
          <BugReportIcon sx={{ fontSize: 48, color: '#e0e0e0' }} />
          <Typography variant="h6" sx={{ color: '#bdbdbd' }}>No agent traces yet</Typography>
          <Typography variant="body2" sx={{ color: '#9e9e9e', textAlign: 'center', maxWidth: 320 }}>
            Send a message in the chat to see the agent pipeline execute here in real time.
            Every step — research, classification, planning, execution, verification — is logged with inputs and outputs.
          </Typography>
        </Box>
      ) : (
        <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* ── Runs sidebar ── */}
          <Box
            ref={scrollRef}
            sx={{
              width: 260,
              borderRight: 1,
              borderColor: 'divider',
              overflow: 'auto',
              bgcolor: '#fafafa',
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <Box sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
              <HistoryIcon sx={{ fontSize: 18, color: 'primary.main' }} />
              <Typography variant="subtitle2" fontWeight={700} sx={{ fontSize: 12 }}>Runs</Typography>
              <Chip label={traces.length} size="small" sx={{ ml: 'auto', height: 20, fontSize: 10, fontWeight: 700 }} />
            </Box>
            <Divider />
            <List dense sx={{ py: 0.25, flex: 1, overflowY: 'auto' }}>
              {traces.map((trace, idx) => {
                const normStatus = traceStatusToRunStatus(trace.status);
                const failedCount = trace.steps.filter(s => s.status === 'error').length;

                return (
                  <ListItemButton
                    key={trace.id}
                    selected={trace.id === activeTraceId}
                    onClick={() => { setActiveTraceId(trace.id); setAutoSelect(false); }}
                    sx={{
                      mx: 0.5,
                      borderRadius: 1.5,
                      mb: 0.25,
                      transition: 'all 0.15s',
                      ...(trace.id === activeTraceId && {
                        bgcolor: 'primary.main',
                        color: '#fff',
                        '&:hover': { bgcolor: 'primary.dark' },
                        '& .MuiTypography-root': { color: '#fff' },
                        '& .MuiChip-root': { bgcolor: 'rgba(255,255,255,0.2)', color: '#fff' },
                        '& .MuiSvgIcon-root': { color: '#fff !important' },
                      }),
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 28 }}>
                      <StatusIcon status={normStatus} size={16} />
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <span style={{ fontWeight: 700, fontSize: 11 }}>{trace.agentName}</span>
                          {failedCount > 0 && (
                            <Chip label={`${failedCount} err`} size="small" color="error" variant="outlined" sx={{ height: 14, fontSize: 8 }} />
                          )}
                        </Box>
                      }
                      secondary={
                        <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <AccessTimeIcon sx={{ fontSize: 9 }} />
                          <span style={{ fontSize: 9 }}>{new Date(trace.startedAt).toLocaleTimeString()}</span>
                          {trace.totalDurationMs != null && <span style={{ fontSize: 9 }}> · {formatDuration(trace.totalDurationMs)}</span>}
                        </Box>
                      }
                      secondaryTypographyProps={{ fontSize: 9 }}
                    />
                    <Chip
                      label={`${trace.steps.length}`}
                      size="small"
                      sx={{ height: 18, fontSize: 9, fontWeight: 600, minWidth: 28 }}
                    />
                  </ListItemButton>
                );
              })}
            </List>

            {/* Request preview for selected trace */}
            {activeTrace && (
              <Box sx={{ px: 1.5, py: 1, borderTop: '1px solid #e0e0e0', bgcolor: '#e3f2fd' }}>
                <Typography sx={{ fontSize: 9, fontWeight: 700, color: '#1565c0', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Request
                </Typography>
                <Typography sx={{ fontSize: 11, color: '#0d47a1', mt: 0.25 }}>
                  {activeTrace.userRequest.length > 100 ? activeTrace.userRequest.slice(0, 100) + '…' : activeTrace.userRequest}
                </Typography>
              </Box>
            )}
          </Box>

          {/* ── Main content area ── */}
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {activeTrace ? (
              <>
                {/* Stats bar */}
                <DebugStatsBar trace={activeTrace} traceIndex={traces.indexOf(activeTrace) + 1} />

                {/* View content */}
                {viewMode === 'canvas' ? (
                  <WorkflowDebugView
                    trace={activeTrace}
                    pipelineNodes={activeAgent.nodes}
                    pipelineEdges={activeAgent.edges}
                  />
                ) : (
                  <Box sx={{ flex: 1, overflow: 'auto', p: 2.5 }}>
                    <TraceTimeline trace={activeTrace} />
                  </Box>
                )}
              </>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'text.secondary', gap: 1 }}>
                <HistoryIcon sx={{ fontSize: 48, opacity: 0.2 }} />
                <Typography sx={{ fontSize: 14 }}>Select a run to debug</Typography>
              </Box>
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
}

// ─── Debug Stats Bar ────────────────────────────────────────────────────────

function DebugStatsBar({ trace, traceIndex }: { trace: AgentTrace; traceIndex: number }) {
  const normStatus = traceStatusToRunStatus(trace.status);
  const completedCount = trace.steps.filter(s => s.status === 'success').length;
  const failedCount = trace.steps.filter(s => s.status === 'error').length;
  const totalTokens = trace.steps.reduce((sum, s) => sum + (s.tokens?.total || 0), 0);
  const totalDuration = trace.totalDurationMs ?? (trace.finishedAt ? new Date(trace.finishedAt).getTime() - new Date(trace.startedAt).getTime() : undefined);

  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', gap: 2,
      px: 2, py: 1,
      bgcolor: '#f8f9fa', borderBottom: '1px solid #e9ecef',
      flexShrink: 0,
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <StatusIcon status={normStatus} size={20} />
        <Typography sx={{ fontWeight: 800, fontSize: 13 }}>
          {trace.agentName} — Run #{traceIndex}
        </Typography>
        <Chip
          label={normStatus}
          size="small"
          sx={{
            fontWeight: 700, fontSize: 10, height: 20,
            bgcolor: normStatus === 'completed' ? '#dcfce7' : normStatus === 'failed' ? '#fef2f2' : '#dbeafe',
            color: normStatus === 'completed' ? '#166534' : normStatus === 'failed' ? '#991b1b' : '#1e40af',
            textTransform: 'capitalize',
          }}
        />
      </Box>
      <Box sx={{ flex: 1 }} />
      <StatBadge label="Steps" value={trace.steps.length} color="#3b82f6" />
      <StatBadge label="Completed" value={completedCount} color="#22c55e" />
      {failedCount > 0 && <StatBadge label="Failed" value={failedCount} color="#ef4444" />}
      {totalDuration != null && <StatBadge label="Duration" value={formatDuration(totalDuration)} color="#64748b" />}
      {totalTokens > 0 && <StatBadge label="Tokens" value={totalTokens.toLocaleString()} color="#8b5cf6" />}
    </Box>
  );
}

// ─── Trace Timeline (fallback list view) ────────────────────────────────────

function TraceTimeline({ trace }: { trace: AgentTrace }) {
  const stepCards: StepCardData[] = trace.steps.map(traceStepToCardData);

  return (
    <>
      {/* User request banner */}
      <Box
        sx={{
          mb: 2,
          p: 1.5,
          bgcolor: '#e3f2fd',
          borderRadius: 2,
          border: '1px solid #bbdefb',
        }}
      >
        <Typography variant="caption" sx={{ color: '#1565c0', fontWeight: 700, fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase' }}>
          User Request
        </Typography>
        <Typography variant="body2" sx={{ mt: 0.5, color: '#0d47a1' }}>
          {trace.userRequest}
        </Typography>
      </Box>

      <StepTimeline steps={stepCards} showCategory />
    </>
  );
}
