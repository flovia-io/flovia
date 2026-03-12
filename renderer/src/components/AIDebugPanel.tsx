/**
 * AIDebugPanel — Agent trace / execution view.
 *
 * Renders agent runs in the same visual style as the workflow execution panel:
 * - Multiple runs listed in a sidebar (newest first)
 * - Per-step timeline with status dots, expandable input/output
 * - Phase-category color coding and token usage badges
 * - Run header with stats, duration, and clear/stop actions
 * - Stops reflecting when agent work is complete (no infinite running)
 *
 * Shares step cards, data blocks, status icons, and layout primitives
 * with the workflow ExecutionsPanel via ../shared/ExecutionViewParts.
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
import HistoryIcon from '@mui/icons-material/History';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import StopCircleIcon from '@mui/icons-material/StopCircle';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import BugReportIcon from '@mui/icons-material/BugReport';

import { useAgentExecution } from '../context/AgentExecutionContext';
import type { AgentTrace, TraceStep } from '../types/agent.types';

import {
  StatusIcon,
  StatBadge,
  RunHeader,
  StepTimeline,
  formatDuration,
  STATUS_COLORS,
} from './shared/ExecutionViewParts';
import type { StepCardData } from './shared/ExecutionViewParts';

// ─── Trace → StepCardData adapter (keeps conversion in the renderer) ────────

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

// ─── Run list item status normalization ─────────────────────────────────────

function traceStatusToRunStatus(status: string): string {
  if (status === 'success') return 'completed';
  if (status === 'error') return 'failed';
  return status; // 'running'
}

// ─── Main Panel ─────────────────────────────────────────────────────────────

export default function AIDebugPanel() {
  const { traces, activeTraceId, setActiveTraceId, finishTrace, clearTraces } = useAgentExecution();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoSelect, setAutoSelect] = useState(true);

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
        <Typography variant="subtitle1" sx={{ fontWeight: 700, flex: 1 }}>
          Agent Traces
        </Typography>
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

      {/* ── Body: runs list + detail (matching workflow ExecutionsPanel layout) ── */}
      {traces.length === 0 ? (
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
          <BugReportIcon sx={{ fontSize: 48, color: '#e0e0e0' }} />
          <Typography variant="h6" sx={{ color: '#bdbdbd' }}>No agent traces yet</Typography>
          <Typography variant="body2" sx={{ color: '#9e9e9e', textAlign: 'center', maxWidth: 320 }}>
            Send a message in the chat to see AI agent calls here in real time.
            Every step — research, classification, planning, execution, verification — will be logged.
          </Typography>
        </Box>
      ) : (
        <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* ── Runs sidebar ── */}
          <Box
            ref={scrollRef}
            sx={{
              width: 280,
              borderRight: 1,
              borderColor: 'divider',
              overflow: 'auto',
              bgcolor: '#fafafa',
              flexShrink: 0,
            }}
          >
            <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <HistoryIcon sx={{ fontSize: 20, color: 'primary.main' }} />
              <Typography variant="subtitle2" fontWeight={700}>Runs</Typography>
              <Chip label={traces.length} size="small" sx={{ ml: 'auto', height: 22, fontSize: 11, fontWeight: 700 }} />
            </Box>
            <Divider />
            <List dense sx={{ py: 0.5 }}>
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
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      <StatusIcon status={normStatus} size={18} />
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <span style={{ fontWeight: 700, fontSize: 12 }}>{trace.agentName}</span>
                          {failedCount > 0 && (
                            <Chip label={`${failedCount} err`} size="small" color="error" variant="outlined" sx={{ height: 16, fontSize: 9 }} />
                          )}
                        </Box>
                      }
                      secondary={
                        <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <AccessTimeIcon sx={{ fontSize: 10 }} />
                          <span style={{ fontSize: 10 }}>{new Date(trace.startedAt).toLocaleTimeString()}</span>
                          {trace.totalDurationMs != null && <span style={{ fontSize: 10 }}> · {formatDuration(trace.totalDurationMs)}</span>}
                        </Box>
                      }
                      secondaryTypographyProps={{ fontSize: 10 }}
                    />
                    <Chip
                      label={`${trace.steps.length} steps`}
                      size="small"
                      sx={{ height: 20, fontSize: 10, fontWeight: 600 }}
                    />
                  </ListItemButton>
                );
              })}
            </List>
          </Box>

          {/* ── Run detail ── */}
          <Box sx={{ flex: 1, overflow: 'auto', p: 0 }}>
            {activeTrace ? (
              <TraceDetail trace={activeTrace} traceIndex={traces.indexOf(activeTrace) + 1} />
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'text.secondary', gap: 1 }}>
                <HistoryIcon sx={{ fontSize: 48, opacity: 0.2 }} />
                <Typography sx={{ fontSize: 14 }}>Select a trace to view execution details</Typography>
              </Box>
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
}

// ─── Trace Detail (uses shared RunHeader + StepTimeline) ────────────────────

function TraceDetail({ trace, traceIndex }: { trace: AgentTrace; traceIndex: number }) {
  const normStatus = traceStatusToRunStatus(trace.status);
  const completedCount = trace.steps.filter(s => s.status === 'success').length;
  const failedCount = trace.steps.filter(s => s.status === 'error').length;
  const totalTokens = trace.steps.reduce(
    (sum, s) => sum + (s.tokens?.total || 0),
    0,
  );

  const stepCards: StepCardData[] = trace.steps.map(traceStepToCardData);

  return (
    <Box sx={{ p: 2.5 }}>
      <RunHeader
        status={normStatus}
        label={`${trace.agentName} — Run #${traceIndex}`}
        startedAt={trace.startedAt}
        finishedAt={trace.finishedAt}
        stepCount={trace.steps.length}
        completedCount={completedCount}
        failedCount={failedCount}
        durationMs={trace.totalDurationMs}
        extra={
          totalTokens > 0 ? (
            <StatBadge label="Tokens" value={totalTokens.toLocaleString()} color="#8b5cf6" />
          ) : undefined
        }
      />

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
    </Box>
  );
}
