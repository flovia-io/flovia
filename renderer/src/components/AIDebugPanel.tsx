/**
 * AIDebugPanel — Inline AI debug tab that displays all agent/AI calls in real time.
 *
 * Shows:
 * - All traces (agent runs) with their steps
 * - Request/response for each LLM call
 * - Classification/structured outputs rendered as mini workflow nodes
 * - Allows editing classification results inline
 *
 * Always visible (no developer options gate), updates in real time via AgentExecutionContext.
 */
import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import MuiIconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Alert from '@mui/material/Alert';

import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import RefreshIcon from '@mui/icons-material/Refresh';
import EditIcon from '@mui/icons-material/Edit';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';

import { useAgentExecution } from '../context/AgentExecutionContext';
import type { AgentTrace, TraceStep, PhaseCategory } from '../types/agent.types';

/* ─── Category Colors ─── */
const categoryColors: Record<string, { bg: string; border: string; text: string }> = {
  entry:          { bg: '#e3f2fd', border: '#1976d2', text: '#0d47a1' },
  classification: { bg: '#fff8e1', border: '#f9a825', text: '#e65100' },
  research:       { bg: '#e8f5e9', border: '#43a047', text: '#1b5e20' },
  planning:       { bg: '#f3e5f5', border: '#8e24aa', text: '#4a148c' },
  execution:      { bg: '#ffebee', border: '#e53935', text: '#b71c1c' },
  verification:   { bg: '#e0f2f1', border: '#00897b', text: '#004d40' },
  output:         { bg: '#eceff1', border: '#546e7a', text: '#263238' },
};

const statusIcon = (status: string) => {
  switch (status) {
    case 'success':
    case 'completed':
      return <CheckCircleIcon sx={{ color: '#43a047', fontSize: 16 }} />;
    case 'error':
    case 'failed':
      return <ErrorIcon sx={{ color: '#e53935', fontSize: 16 }} />;
    case 'running':
      return <HourglassEmptyIcon sx={{ color: '#1976d2', fontSize: 16, animation: 'spin 1s linear infinite', '@keyframes spin': { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } } }} />;
    default:
      return <HourglassEmptyIcon sx={{ color: '#757575', fontSize: 16 }} />;
  }
};

/* Detect if output is a structured/classification result */
function isStructuredOutput(output: unknown): output is Record<string, unknown> {
  return typeof output === 'object' && output !== null && !Array.isArray(output);
}

function isClassification(step: TraceStep): boolean {
  return step.category === 'classification' || (
    isStructuredOutput(step.output) && (
      'needsFileChanges' in (step.output as Record<string, unknown>) ||
      'wantsTextSearch' in (step.output as Record<string, unknown>) ||
      'shouldContinue' in (step.output as Record<string, unknown>) ||
      'satisfied' in (step.output as Record<string, unknown>)
    )
  );
}

/* ─── Structured Output Node (mini workflow-style display) ─── */
function StructuredOutputNode({ data, onEdit }: { data: Record<string, unknown>; onEdit?: (key: string, value: unknown) => void }) {
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const entries = Object.entries(data).filter(([k]) => k !== 'undefined');

  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
      {entries.map(([key, value]) => {
        const isBoolean = typeof value === 'boolean';
        const isEditing = editingKey === key;

        return (
          <Paper
            key={key}
            variant="outlined"
            sx={{
              p: 1,
              minWidth: 120,
              borderRadius: 2,
              borderColor: isBoolean ? (value ? '#43a047' : '#e53935') : '#90a4ae',
              borderWidth: 2,
              bgcolor: isBoolean ? (value ? '#e8f5e9' : '#ffebee') : '#fafafa',
              cursor: onEdit ? 'pointer' : 'default',
              transition: 'all 0.15s ease',
              '&:hover': onEdit ? { boxShadow: 2 } : {},
            }}
            onClick={() => {
              if (onEdit && isBoolean) {
                onEdit(key, !value);
              } else if (onEdit && !isEditing) {
                setEditingKey(key);
                setEditValue(JSON.stringify(value));
              }
            }}
          >
            <Typography variant="caption" sx={{ fontWeight: 600, color: '#546e7a', display: 'block', mb: 0.25 }}>
              {key}
            </Typography>
            {isEditing ? (
              <TextField
                size="small"
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onBlur={() => {
                  try {
                    onEdit?.(key, JSON.parse(editValue));
                  } catch {
                    onEdit?.(key, editValue);
                  }
                  setEditingKey(null);
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    try {
                      onEdit?.(key, JSON.parse(editValue));
                    } catch {
                      onEdit?.(key, editValue);
                    }
                    setEditingKey(null);
                  }
                  if (e.key === 'Escape') setEditingKey(null);
                }}
                autoFocus
                sx={{ '& input': { fontSize: 12, py: 0.25 } }}
              />
            ) : (
              <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: 12 }}>
                {isBoolean ? (
                  <Chip
                    label={value ? 'TRUE' : 'FALSE'}
                    size="small"
                    sx={{
                      bgcolor: value ? '#43a047' : '#e53935',
                      color: '#fff',
                      fontWeight: 700,
                      fontSize: 11,
                      height: 22,
                    }}
                  />
                ) : typeof value === 'string' ? (
                  (value as string).length > 80 ? (value as string).slice(0, 80) + '…' : (value as string)
                ) : Array.isArray(value) ? (
                  `[${(value as unknown[]).length} items]`
                ) : (
                  JSON.stringify(value)
                )}
              </Typography>
            )}
            {onEdit && !isBoolean && (
              <EditIcon sx={{ fontSize: 10, color: '#90a4ae', position: 'absolute', top: 4, right: 4 }} />
            )}
          </Paper>
        );
      })}
    </Box>
  );
}

/* ─── Step Detail Card ─── */
function StepCard({ step, isLast }: { step: TraceStep; isLast: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const colors = categoryColors[step.category] ?? categoryColors.output;
  const isClassified = isClassification(step);

  return (
    <Paper
      variant="outlined"
      sx={{
        mb: isLast ? 0 : 1,
        borderColor: colors.border,
        borderLeft: `4px solid ${colors.border}`,
        borderRadius: 1.5,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 1.5,
          py: 0.75,
          bgcolor: colors.bg,
          cursor: 'pointer',
          '&:hover': { filter: 'brightness(0.97)' },
        }}
        onClick={() => setExpanded(!expanded)}
      >
        {statusIcon(step.status)}
        <Chip label={step.category} size="small" sx={{ bgcolor: colors.border, color: '#fff', fontWeight: 600, fontSize: 10, height: 20 }} />
        <Typography variant="body2" sx={{ fontWeight: 600, color: colors.text, flex: 1 }}>
          {step.nodeLabel}
        </Typography>
        <Typography variant="caption" sx={{ color: '#78909c', mr: 1 }}>
          {step.type}
        </Typography>
        {step.durationMs != null && (
          <Typography variant="caption" sx={{ color: '#78909c', mr: 1, fontFamily: 'monospace' }}>
            {step.durationMs}ms
          </Typography>
        )}
        {expanded ? <ExpandLessIcon sx={{ fontSize: 18, color: '#90a4ae' }} /> : <ExpandMoreIcon sx={{ fontSize: 18, color: '#90a4ae' }} />}
      </Box>

      {/* Expanded Content */}
      <Collapse in={expanded}>
        <Box sx={{ px: 1.5, py: 1, bgcolor: '#fafafa' }}>
          <Typography variant="caption" sx={{ color: '#546e7a', fontWeight: 600 }}>
            Summary:
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            {String(step.summary)}
          </Typography>

          {/* Input */}
          {step.input != null ? (
            <>
              <Typography variant="caption" sx={{ color: '#546e7a', fontWeight: 600, mt: 1, display: 'block' }}>
                Request / Input:
              </Typography>
              <Paper
                sx={{
                  p: 1,
                  bgcolor: '#263238',
                  color: '#a5d6a7',
                  fontFamily: 'monospace',
                  fontSize: 11,
                  borderRadius: 1,
                  maxHeight: 200,
                  overflow: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  mb: 1,
                  position: 'relative',
                }}
              >
                <Tooltip title="Copy">
                  <MuiIconButton
                    size="small"
                    sx={{ position: 'absolute', top: 2, right: 2, color: '#78909c' }}
                    onClick={() => navigator.clipboard.writeText(JSON.stringify(step.input, null, 2))}
                  >
                    <ContentCopyIcon sx={{ fontSize: 14 }} />
                  </MuiIconButton>
                </Tooltip>
                {JSON.stringify(step.input, null, 2)}
              </Paper>
            </>
          ) : null}

          {/* Output — with structured display for classification results */}
          {step.output != null ? (
            <>
              <Typography variant="caption" sx={{ color: '#546e7a', fontWeight: 600, mt: 1, display: 'block' }}>
                Response / Output:
              </Typography>
              {isClassified && isStructuredOutput(step.output) ? (
                <StructuredOutputNode data={step.output as Record<string, unknown>} />
              ) : (
                <Paper
                  sx={{
                    p: 1,
                    bgcolor: '#263238',
                    color: '#80cbc4',
                    fontFamily: 'monospace',
                    fontSize: 11,
                    borderRadius: 1,
                    maxHeight: 200,
                    overflow: 'auto',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    position: 'relative',
                  }}
                >
                  <Tooltip title="Copy">
                    <MuiIconButton
                      size="small"
                      sx={{ position: 'absolute', top: 2, right: 2, color: '#78909c' }}
                      onClick={() => navigator.clipboard.writeText(JSON.stringify(step.output, null, 2))}
                    >
                      <ContentCopyIcon sx={{ fontSize: 14 }} />
                    </MuiIconButton>
                  </Tooltip>
                  {JSON.stringify(step.output, null, 2)}
                </Paper>
              )}
            </>
          ) : null}

          {/* Error */}
          {step.error && (
            <Alert severity="error" sx={{ mt: 1, fontSize: 12 }}>
              {step.error}
            </Alert>
          )}
        </Box>
      </Collapse>
    </Paper>
  );
}

/* ─── Trace Card ─── */
function TraceCard({ trace, isActive, onSelect }: { trace: AgentTrace; isActive: boolean; onSelect: () => void }) {
  const [expanded, setExpanded] = useState(isActive || trace.status === 'running');

  // Auto-expand running traces
  useEffect(() => {
    if (trace.status === 'running') setExpanded(true);
  }, [trace.status]);

  return (
    <Paper
      variant="outlined"
      sx={{
        mb: 1.5,
        borderRadius: 2,
        borderColor: isActive ? '#1976d2' : '#e0e0e0',
        borderWidth: isActive ? 2 : 1,
        overflow: 'hidden',
      }}
    >
      {/* Trace Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 2,
          py: 1,
          bgcolor: isActive ? '#e3f2fd' : '#f5f5f5',
          cursor: 'pointer',
          '&:hover': { bgcolor: isActive ? '#bbdefb' : '#eeeeee' },
        }}
        onClick={() => { setExpanded(!expanded); onSelect(); }}
      >
        {statusIcon(trace.status)}
        <Typography variant="subtitle2" sx={{ fontWeight: 700, flex: 1 }}>
          {trace.agentName}
        </Typography>
        <Typography variant="caption" sx={{ color: '#78909c', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {trace.userRequest.slice(0, 60)}{trace.userRequest.length > 60 ? '…' : ''}
        </Typography>
        <Chip
          label={`${trace.steps.length} steps`}
          size="small"
          sx={{ fontSize: 10, height: 20, bgcolor: '#e0e0e0' }}
        />
        {trace.totalDurationMs != null && (
          <Typography variant="caption" sx={{ color: '#78909c', fontFamily: 'monospace' }}>
            {(trace.totalDurationMs / 1000).toFixed(1)}s
          </Typography>
        )}
        <Typography variant="caption" sx={{ color: '#9e9e9e' }}>
          {new Date(trace.startedAt).toLocaleTimeString()}
        </Typography>
        {expanded ? <ExpandLessIcon sx={{ fontSize: 18, color: '#90a4ae' }} /> : <ExpandMoreIcon sx={{ fontSize: 18, color: '#90a4ae' }} />}
      </Box>

      {/* Steps */}
      <Collapse in={expanded}>
        <Box sx={{ px: 2, py: 1.5 }}>
          {trace.steps.length === 0 ? (
            <Typography variant="body2" sx={{ color: '#9e9e9e', fontStyle: 'italic' }}>
              Waiting for steps…
            </Typography>
          ) : (
            trace.steps.map((step, i) => (
              <StepCard key={step.id} step={step} isLast={i === trace.steps.length - 1} />
            ))
          )}
        </Box>
      </Collapse>
    </Paper>
  );
}

/* ─── Main Debug Panel ─── */
export default function AIDebugPanel() {
  const agentExec = useAgentExecution();
  const { traces, activeTraceId, setActiveTraceId } = agentExec;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Auto-scroll to latest running trace
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [traces, autoScroll]);

  // Count running traces
  const runningCount = traces.filter(t => t.status === 'running').length;
  const totalSteps = traces.reduce((s, t) => s + t.steps.length, 0);

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#fafafa' }}>
      {/* Toolbar */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 2,
          py: 1,
          borderBottom: '1px solid #e0e0e0',
          bgcolor: '#fff',
        }}
      >
        <Typography variant="subtitle1" sx={{ fontWeight: 700, flex: 1 }}>
          🐛 AI Debug — All Agent Calls
        </Typography>
        {runningCount > 0 && (
          <Chip
            label={`${runningCount} running`}
            size="small"
            sx={{ bgcolor: '#1976d2', color: '#fff', fontWeight: 600, fontSize: 10, height: 22, animation: 'pulse 1.5s infinite', '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.6 } } }}
          />
        )}
        <Chip label={`${traces.length} traces`} size="small" sx={{ fontSize: 10, height: 20 }} />
        <Chip label={`${totalSteps} steps`} size="small" sx={{ fontSize: 10, height: 20 }} />
        <Tooltip title={autoScroll ? 'Auto-scroll ON' : 'Auto-scroll OFF'}>
          <MuiIconButton size="small" onClick={() => setAutoScroll(!autoScroll)} sx={{ color: autoScroll ? '#1976d2' : '#9e9e9e' }}>
            <RefreshIcon sx={{ fontSize: 18 }} />
          </MuiIconButton>
        </Tooltip>
      </Box>

      {/* Traces List */}
      <Box ref={scrollRef} sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        {traces.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Typography variant="h6" sx={{ color: '#bdbdbd', mb: 1 }}>No agent traces yet</Typography>
            <Typography variant="body2" sx={{ color: '#9e9e9e' }}>
              Send a message in the chat to see AI calls here in real time.
              <br />
              Every agent step — research, classification, planning, execution, verification — will be logged.
            </Typography>
          </Box>
        ) : (
          traces.map(trace => (
            <TraceCard
              key={trace.id}
              trace={trace}
              isActive={trace.id === activeTraceId}
              onSelect={() => setActiveTraceId(trace.id)}
            />
          ))
        )}
      </Box>
    </Box>
  );
}
