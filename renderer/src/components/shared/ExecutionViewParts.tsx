/**
 * Shared Execution View Components
 *
 * Reusable UI primitives for rendering execution runs, step timelines,
 * input/output data blocks, and status indicators. Used by both the
 * workflow ExecutionsPanel and the AI Debug (Agent Trace) panel.
 */
import { useState, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import LinearProgress from '@mui/material/LinearProgress';

import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import PauseCircleIcon from '@mui/icons-material/PauseCircle';
import SkipNextIcon from '@mui/icons-material/SkipNext';

// ─── Status Colors (unified palette) ────────────────────────────────────────

export const STATUS_COLORS: Record<string, string> = {
  pending: '#94a3b8',
  running: '#3b82f6',
  completed: '#22c55e',
  failed: '#ef4444',
  skipped: '#a1a1aa',
  cancelled: '#f59e0b',
};

/** Phase category → color mapping (for agent step color coding) */
export const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  entry:          { bg: '#e3f2fd', border: '#1976d2', text: '#0d47a1' },
  classification: { bg: '#fff8e1', border: '#f9a825', text: '#e65100' },
  research:       { bg: '#e8f5e9', border: '#43a047', text: '#1b5e20' },
  planning:       { bg: '#f3e5f5', border: '#8e24aa', text: '#4a148c' },
  execution:      { bg: '#ffebee', border: '#e53935', text: '#b71c1c' },
  verification:   { bg: '#e0f2f1', border: '#00897b', text: '#004d40' },
  output:         { bg: '#eceff1', border: '#546e7a', text: '#263238' },
};

// ─── Format Helpers ─────────────────────────────────────────────────────────

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

// ─── Status Icon ────────────────────────────────────────────────────────────

export function StatusIcon({ status, size = 16 }: { status: string; size?: number }) {
  switch (status) {
    case 'completed':
    case 'success':
      return <CheckCircleIcon sx={{ fontSize: size, color: STATUS_COLORS.completed }} />;
    case 'failed':
    case 'error':
      return <ErrorIcon sx={{ fontSize: size, color: STATUS_COLORS.failed }} />;
    case 'running':
      return (
        <HourglassEmptyIcon
          sx={{
            fontSize: size,
            color: STATUS_COLORS.running,
            animation: 'exec-spin 1s linear infinite',
            '@keyframes exec-spin': {
              from: { transform: 'rotate(0deg)' },
              to: { transform: 'rotate(360deg)' },
            },
          }}
        />
      );
    case 'skipped':
      return <SkipNextIcon sx={{ fontSize: size, color: STATUS_COLORS.skipped }} />;
    case 'cancelled':
      return <PauseCircleIcon sx={{ fontSize: size, color: STATUS_COLORS.cancelled }} />;
    default:
      return <HourglassEmptyIcon sx={{ fontSize: size, color: STATUS_COLORS.pending }} />;
  }
}

// ─── Data Helpers ───────────────────────────────────────────────────────────

/** Count top-level items in data (for the "N items" badge) */
export function countDataItems(data: unknown): number {
  if (data == null) return 0;
  if (Array.isArray(data)) return data.length;
  if (typeof data === 'object') return Object.keys(data as object).length;
  return 1;
}

/** Detect the JSON type tag for a value (like n8n: T for text, # for number, etc.) */
function typeTag(value: unknown): { label: string; color: string } {
  if (value === null || value === undefined) return { label: '∅', color: '#94a3b8' };
  if (typeof value === 'string') return { label: 'T', color: '#22c55e' };
  if (typeof value === 'number') return { label: '#', color: '#3b82f6' };
  if (typeof value === 'boolean') return { label: '☑', color: '#f59e0b' };
  if (Array.isArray(value)) return { label: '≡', color: '#8b5cf6' };
  if (typeof value === 'object') return { label: '⊙', color: '#06b6d4' };
  return { label: '?', color: '#94a3b8' };
}

/** Format a value for inline display */
function formatValue(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return value.length > 120 ? value.slice(0, 120) + '…' : value;
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) return `[${value.length} items]`;
  if (typeof value === 'object') return `{${Object.keys(value as object).length} fields}`;
  return String(value);
}

// ─── Structured Data View (n8n-style key-value list with type badges) ───────

function StructuredDataView({ data, maxHeight = 280 }: { data: Record<string, unknown>; maxHeight?: number }) {
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  const toggle = (key: string) => {
    setExpandedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const entries = Object.entries(data);

  return (
    <Box sx={{ maxHeight, overflow: 'auto' }}>
      {entries.map(([key, value]) => {
        const tag = typeTag(value);
        const isComplex = (typeof value === 'object' && value !== null);
        const isExpanded = expandedKeys.has(key);

        return (
          <Box key={key}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                py: 0.75,
                px: 1,
                borderBottom: '1px solid #f0f0f0',
                cursor: isComplex ? 'pointer' : 'default',
                '&:hover': { bgcolor: '#fafafa' },
                transition: 'background 0.1s',
              }}
              onClick={() => isComplex && toggle(key)}
            >
              {/* Type badge */}
              <Box
                sx={{
                  width: 22,
                  height: 22,
                  borderRadius: 1,
                  bgcolor: tag.color + '15',
                  color: tag.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 800,
                  flexShrink: 0,
                  border: `1px solid ${tag.color}30`,
                }}
              >
                {tag.label}
              </Box>

              {/* Key */}
              <Typography
                sx={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#374151',
                  fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                  minWidth: 80,
                  flexShrink: 0,
                }}
              >
                {key}
              </Typography>

              {/* Value */}
              <Typography
                sx={{
                  fontSize: 12,
                  color: '#6b7280',
                  fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {formatValue(value)}
              </Typography>

              {/* Expand indicator for complex values */}
              {isComplex && (
                <Box sx={{ flexShrink: 0, color: '#9ca3af', fontSize: 14 }}>
                  {isExpanded ? <ExpandLessIcon sx={{ fontSize: 16 }} /> : <ExpandMoreIcon sx={{ fontSize: 16 }} />}
                </Box>
              )}
            </Box>

            {/* Expanded nested view */}
            {isComplex && isExpanded && (
              <Box sx={{ pl: 3, borderLeft: '2px solid #e5e7eb', ml: 1.5, my: 0.5 }}>
                {Array.isArray(value) ? (
                  value.map((item, idx) => (
                    <Box key={idx} sx={{ py: 0.5, px: 1, borderBottom: '1px solid #f5f5f5' }}>
                      <Typography sx={{ fontSize: 11, fontFamily: 'monospace', color: '#6b7280', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {typeof item === 'object' ? JSON.stringify(item, null, 2) : String(item)}
                      </Typography>
                    </Box>
                  ))
                ) : (
                  <StructuredDataView data={value as Record<string, unknown>} maxHeight={200} />
                )}
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
}

// ─── Data Block (input / output / error — structured or raw JSON) ───────────

export function DataBlock({
  label,
  data,
  color,
  maxHeight = 280,
}: {
  label: string;
  data: unknown;
  color?: string;
  maxHeight?: number;
}) {
  const [viewMode, setViewMode] = useState<'structured' | 'json'>('structured');
  const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  const isStructurable = typeof data === 'object' && data !== null && !Array.isArray(data);
  const itemCount = countDataItems(data);

  return (
    <Box sx={{ mb: 1.5 }}>
      {/* Header row */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
        <Typography
          variant="caption"
          sx={{ color: color || 'text.secondary', fontWeight: 700, fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase' }}
        >
          {label}
        </Typography>
        {itemCount > 0 && (
          <Chip
            label={`${itemCount} ${itemCount === 1 ? 'item' : 'items'}`}
            size="small"
            sx={{ height: 16, fontSize: 9, fontWeight: 600, bgcolor: (color || '#64748b') + '15', color: color || '#64748b' }}
          />
        )}
        <Box sx={{ flex: 1 }} />
        {isStructurable && (
          <Box sx={{ display: 'flex', gap: 0, border: '1px solid #e5e7eb', borderRadius: 1, overflow: 'hidden' }}>
            <Box
              onClick={() => setViewMode('structured')}
              sx={{
                px: 0.75, py: 0.25, fontSize: 9, fontWeight: 600, cursor: 'pointer',
                bgcolor: viewMode === 'structured' ? '#f1f5f9' : 'transparent',
                color: viewMode === 'structured' ? '#334155' : '#94a3b8',
                '&:hover': { bgcolor: '#f8fafc' },
              }}
            >
              Schema
            </Box>
            <Box
              onClick={() => setViewMode('json')}
              sx={{
                px: 0.75, py: 0.25, fontSize: 9, fontWeight: 600, cursor: 'pointer',
                borderLeft: '1px solid #e5e7eb',
                bgcolor: viewMode === 'json' ? '#f1f5f9' : 'transparent',
                color: viewMode === 'json' ? '#334155' : '#94a3b8',
                '&:hover': { bgcolor: '#f8fafc' },
              }}
            >
              JSON
            </Box>
          </Box>
        )}
        <Tooltip title="Copy">
          <IconButton
            size="small"
            sx={{ color: '#94a3b8', ml: 0.5 }}
            onClick={() => navigator.clipboard.writeText(text)}
          >
            <ContentCopyIcon sx={{ fontSize: 12 }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Content */}
      <Paper
        variant="outlined"
        sx={{
          borderRadius: 1.5,
          overflow: 'hidden',
          border: '1px solid #e5e7eb',
        }}
      >
        {viewMode === 'structured' && isStructurable ? (
          <StructuredDataView data={data as Record<string, unknown>} maxHeight={maxHeight} />
        ) : (
          <Box
            sx={{
              bgcolor: '#1e1e2e',
              p: 1,
              maxHeight,
              overflow: 'auto',
            }}
          >
            <Typography
              sx={{
                fontSize: 11,
                fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                lineHeight: 1.5,
                color: '#cdd6f4',
              }}
            >
              {text}
            </Typography>
          </Box>
        )}
      </Paper>
    </Box>
  );
}

// ─── Stat Badge ─────────────────────────────────────────────────────────────

export function StatBadge({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <Box sx={{ textAlign: 'center', flex: 1 }}>
      <Typography sx={{ fontSize: 16, fontWeight: 800, color, lineHeight: 1.2 }}>{value}</Typography>
      <Typography sx={{ fontSize: 10, color: 'text.secondary', fontWeight: 600 }}>{label}</Typography>
    </Box>
  );
}

// ─── Step Card (timeline node with expandable input/output) ─────────────────

export interface StepCardData {
  nodeId: string;
  label: string;
  status: string;
  durationMs?: number;
  itemCount?: number;
  input?: unknown;
  output?: unknown;
  error?: string;
  /** Agent-specific metadata */
  category?: string;
  type?: string;
  tokens?: { prompt: number; completion: number; total: number };
  timestamp?: string;
}

export function StepCard({
  step,
  index,
  isLast,
  showCategory = false,
}: {
  step: StepCardData;
  index: number;
  isLast: boolean;
  /** Whether to show category chip (used in agent debug view) */
  showCategory?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasData = step.input != null || step.output != null || step.error;
  const catColors = step.category ? CATEGORY_COLORS[step.category] : undefined;
  const borderColor = catColors?.border || STATUS_COLORS[step.status] || '#94a3b8';

  return (
    <Box sx={{ display: 'flex', gap: 1.5 }}>
      {/* Timeline line + dot */}
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 24, flexShrink: 0 }}>
        <Box
          sx={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            bgcolor: STATUS_COLORS[step.status] || '#94a3b8',
            border: '2px solid #fff',
            boxShadow: `0 0 0 2px ${STATUS_COLORS[step.status] || '#94a3b8'}40`,
            zIndex: 1,
          }}
        />
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
          borderColor,
          overflow: 'hidden',
          transition: 'all 0.15s',
          '&:hover': { boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
        }}
      >
        <Box
          sx={{
            px: 2,
            py: 1.25,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            cursor: hasData ? 'pointer' : 'default',
            bgcolor: catColors?.bg || 'transparent',
          }}
          onClick={() => hasData && setExpanded(!expanded)}
        >
          <StatusIcon status={step.status} size={16} />

          {showCategory && step.category && catColors && (
            <Chip
              label={step.category}
              size="small"
              sx={{
                bgcolor: catColors.border,
                color: '#fff',
                fontWeight: 600,
                fontSize: 9,
                height: 18,
                textTransform: 'capitalize',
              }}
            />
          )}

          <Typography variant="subtitle2" sx={{ fontSize: 12, fontWeight: 700, flex: 1, color: catColors?.text }}>
            {step.label}
          </Typography>

          {step.type && (
            <Typography variant="caption" sx={{ color: '#78909c', fontSize: 10 }}>
              {step.type}
            </Typography>
          )}

          {step.itemCount != null && (
            <Chip
              label={`${step.itemCount} item${step.itemCount !== 1 ? 's' : ''}`}
              size="small"
              color={step.status === 'completed' ? 'success' : 'default'}
              variant="outlined"
              sx={{ height: 20, fontSize: 10, fontWeight: 600 }}
            />
          )}

          {step.tokens && (
            <Tooltip title={`Prompt: ${step.tokens.prompt} | Completion: ${step.tokens.completion} | Total: ${step.tokens.total}`}>
              <Chip
                label={`${step.tokens.total} tok`}
                size="small"
                variant="outlined"
                sx={{ height: 18, fontSize: 9, fontWeight: 600, color: '#8b5cf6', borderColor: '#8b5cf6' }}
              />
            </Tooltip>
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
              <DataBlock label="Error" data={step.error} color="#ef4444" />
            )}
            {step.input != null && (
              <DataBlock label="Input" data={step.input} color="#3b82f6" />
            )}
            {step.output != null && (
              <DataBlock label="Output" data={step.output} color="#22c55e" />
            )}
          </Box>
        </Collapse>
      </Paper>
    </Box>
  );
}

// ─── Run Header (stats bar + progress) ──────────────────────────────────────

export function RunHeader({
  status,
  label,
  startedAt,
  finishedAt,
  stepCount,
  completedCount,
  failedCount,
  durationMs,
  extra,
  actions,
}: {
  status: string;
  label: string;
  startedAt: string;
  finishedAt?: string;
  stepCount: number;
  completedCount: number;
  failedCount: number;
  durationMs?: number;
  extra?: ReactNode;
  actions?: ReactNode;
}) {
  const totalDuration = durationMs ??
    (finishedAt ? new Date(finishedAt).getTime() - new Date(startedAt).getTime() : undefined);

  return (
    <>
      {/* Header row */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: (STATUS_COLORS[status] || '#94a3b8') + '15',
          }}
        >
          <StatusIcon status={status} size={24} />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 800, fontSize: 16, lineHeight: 1.2 }}>
            {label}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {new Date(startedAt).toLocaleString()}
          </Typography>
        </Box>
        <Chip
          label={status}
          size="small"
          sx={{
            fontWeight: 700,
            bgcolor: (STATUS_COLORS[status] || '#94a3b8') + '18',
            color: STATUS_COLORS[status] || '#94a3b8',
            textTransform: 'capitalize',
          }}
        />
        {actions}
      </Box>

      {/* Stats row */}
      <Box
        sx={{
          display: 'flex',
          gap: 2,
          mb: 2,
          p: 1.5,
          bgcolor: '#f8f9fa',
          borderRadius: 2,
          border: '1px solid #e9ecef',
        }}
      >
        <StatBadge label="Steps" value={stepCount} color="#3b82f6" />
        <StatBadge label="Completed" value={completedCount} color="#22c55e" />
        {failedCount > 0 && <StatBadge label="Failed" value={failedCount} color="#ef4444" />}
        {totalDuration != null && (
          <StatBadge label="Duration" value={formatDuration(totalDuration)} color="#64748b" />
        )}
        {extra}
      </Box>

      {/* Progress bar for running state */}
      {status === 'running' && (
        <LinearProgress sx={{ mb: 2, borderRadius: 1 }} />
      )}

      <Divider sx={{ mb: 2 }} />
    </>
  );
}

// ─── Step Timeline ──────────────────────────────────────────────────────────

export function StepTimeline({
  steps,
  showCategory = false,
}: {
  steps: StepCardData[];
  showCategory?: boolean;
}) {
  if (steps.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 3 }}>
        <Typography variant="body2" sx={{ color: '#9e9e9e', fontStyle: 'italic' }}>
          Waiting for steps…
        </Typography>
      </Box>
    );
  }

  return (
    <>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5, fontSize: 13 }}>
        Step Timeline
      </Typography>
      {steps.map((step, idx) => (
        <StepCard
          key={step.nodeId + '-' + idx}
          step={step}
          index={idx}
          isLast={idx === steps.length - 1}
          showCategory={showCategory}
        />
      ))}
    </>
  );
}
