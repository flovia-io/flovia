/**
 * WorkflowNode — Custom ReactFlow node for the visual workflow editor.
 */
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';

import { STATUS_COLORS, getPaletteForType } from './workflow.constants';
import type { WfNodeData } from './workflow.types';

export function WorkflowNode({ data, selected }: NodeProps<Node<WfNodeData>>) {
  const palette = getPaletteForType(data.nodeType);
  const borderColor = data.status ? STATUS_COLORS[data.status] : (palette?.color || '#94a3b8');
  const isRunning = data.status === 'running';
  const isCompleted = data.status === 'completed';
  const isFailed = data.status === 'failed';

  return (
    <Paper
      elevation={selected ? 6 : 2}
      sx={{
        minWidth: 180,
        maxWidth: 240,
        border: 2,
        borderColor,
        borderRadius: 3,
        overflow: 'hidden',
        opacity: data.status === 'skipped' ? 0.5 : 1,
        transition: 'all 0.25s ease',
        cursor: 'pointer',
        '&:hover': {
          transform: 'translateY(-1px)',
          boxShadow: `0 4px 20px ${borderColor}30`,
        },
        ...(isRunning && {
          boxShadow: `0 0 16px ${borderColor}50`,
          animation: 'pulse 1.5s infinite',
        }),
        ...(isCompleted && {
          boxShadow: `0 2px 8px ${borderColor}25`,
        }),
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: borderColor, width: 10, height: 10, border: '2px solid #fff' }} />

      {/* Header */}
      <Box sx={{
        px: 1.5, py: 1,
        bgcolor: `${palette?.color || '#94a3b8'}12`,
        display: 'flex', alignItems: 'center', gap: 1,
        borderBottom: `1px solid ${palette?.color || '#94a3b8'}20`,
      }}>
        <Box sx={{
          width: 32, height: 32, borderRadius: 1.5,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          bgcolor: `${palette?.color || '#94a3b8'}18`,
          fontSize: 16,
        }}>
          {data.icon || palette?.icon}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle2" noWrap sx={{ fontWeight: 700, fontSize: 12, lineHeight: 1.3 }}>{data.label}</Typography>
          {data.subtitle && (
            <Typography variant="caption" noWrap sx={{ color: 'text.secondary', fontSize: 10 }}>{data.subtitle}</Typography>
          )}
        </Box>
        {isCompleted && <CheckCircleIcon sx={{ fontSize: 18, color: '#22c55e' }} />}
        {isFailed && <ErrorIcon sx={{ fontSize: 18, color: '#ef4444' }} />}
        {isRunning && <HourglassEmptyIcon sx={{ fontSize: 18, color: '#3b82f6', animation: 'spin 1s infinite' }} />}
      </Box>

      {/* Footer — item count & duration */}
      {(data.itemCount != null || data.durationMs != null || data.error) && (
        <Box sx={{ px: 1.5, py: 0.75, display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
          {data.itemCount != null && (
            <Chip
              label={`${data.itemCount} item${data.itemCount !== 1 ? 's' : ''}`}
              size="small"
              color={isCompleted ? 'success' : isFailed ? 'error' : 'default'}
              variant="outlined"
              sx={{ height: 20, fontSize: 10, fontWeight: 600 }}
            />
          )}
          {data.durationMs != null && (
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 10, ml: 'auto' }}>
              {data.durationMs < 1000 ? `${data.durationMs}ms` : `${(data.durationMs / 1000).toFixed(1)}s`}
            </Typography>
          )}
          {data.error && (
            <Typography variant="caption" noWrap sx={{ color: 'error.main', fontSize: 10, maxWidth: '100%' }}>
              {data.error}
            </Typography>
          )}
        </Box>
      )}

      {/* Output handles */}
      {data.nodeType === 'decision' ? (
        <>
          <Handle type="source" position={Position.Right} id="true" style={{ background: '#22c55e', top: '30%', width: 10, height: 10, border: '2px solid #fff' }} />
          <Handle type="source" position={Position.Right} id="false" style={{ background: '#ef4444', top: '70%', width: 10, height: 10, border: '2px solid #fff' }} />
          <Box sx={{ position: 'absolute', right: -50, top: '25%', fontSize: 10, color: '#22c55e', fontWeight: 600 }}>True</Box>
          <Box sx={{ position: 'absolute', right: -44, top: '65%', fontSize: 10, color: '#ef4444', fontWeight: 600 }}>False</Box>
        </>
      ) : (
        <Handle type="source" position={Position.Right} style={{ background: borderColor, width: 10, height: 10, border: '2px solid #fff' }} />
      )}
    </Paper>
  );
}
