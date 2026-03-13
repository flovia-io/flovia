/**
 * WorkflowNode — Custom ReactFlow node for the visual workflow editor.
 */
import { useReactFlow, Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import PushPinIcon from '@mui/icons-material/PushPin';
import CloseIcon from '@mui/icons-material/Close';

import { STATUS_COLORS, getPaletteForType } from './workflow.constants';
import type { WfNodeData } from './workflow.types';

export function WorkflowNode({ id, data, selected }: NodeProps<Node<WfNodeData>>) {
  const { setNodes } = useReactFlow();
  const palette = getPaletteForType(data.nodeType);
  const borderColor = data.status ? STATUS_COLORS[data.status] : (palette?.color || '#94a3b8');
  const isRunning = data.status === 'running';
  const isCompleted = data.status === 'completed';
  const isFailed = data.status === 'failed';

  const handleDismiss = () => {
    setNodes(nds => nds.map(n =>
      n.id === id ? { ...n, data: { ...n.data, outputDismissed: true } } : n
    ));
  };

  const showBubble = !!(data.liveOutput && !data.outputDismissed);

  return (
    <Paper
      elevation={selected ? 6 : 2}
      sx={{
        minWidth: 180,
        maxWidth: 240,
        border: 2,
        borderColor,
        borderRadius: 3,
        overflow: 'visible',
        opacity: data.status === 'skipped' ? 0.5 : 1,
        transition: 'all 0.25s ease',
        cursor: 'pointer',
        position: 'relative',
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
      {/* Inner clip container so header/footer look tidy */}
      <Box sx={{ borderRadius: 'inherit', overflow: 'hidden' }}>
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
          {data.pinnedData != null && <PushPinIcon sx={{ fontSize: 14, color: '#8b5cf6', ml: -0.5 }} />}
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
      </Box>

      {/* Live output bubble — floats below the node */}
      {showBubble && (
        <Box
          sx={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            mt: 0.75,
            zIndex: 100,
            pointerEvents: 'all',
          }}
        >
          <Paper
            elevation={6}
            sx={{
              borderRadius: 2,
              border: `1px solid ${borderColor}50`,
              overflow: 'hidden',
              bgcolor: '#0f172a',
            }}
          >
            {/* Bubble header */}
            <Box sx={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              px: 1, py: 0.4,
              bgcolor: `${borderColor}20`,
              borderBottom: `1px solid ${borderColor}30`,
            }}>
              <Typography sx={{ fontSize: 9, fontWeight: 700, color: borderColor, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                {isRunning ? 'Live Output' : 'Output'}
              </Typography>
              <IconButton
                size="small"
                onClick={handleDismiss}
                sx={{ p: 0.25, color: '#94a3b8', '&:hover': { color: '#fff' } }}
              >
                <CloseIcon sx={{ fontSize: 11 }} />
              </IconButton>
            </Box>

            {/* Bubble content */}
            <Box sx={{ maxHeight: 130, overflow: 'auto', px: 1, py: 0.75 }}>
              <Typography
                component="pre"
                sx={{
                  fontSize: 9.5,
                  fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  color: '#e2e8f0',
                  lineHeight: 1.5,
                  m: 0,
                }}
              >
                {String(data.liveOutput).slice(-800)}
                {isRunning && <Box component="span" sx={{ display: 'inline-block', width: 7, height: 12, bgcolor: '#3b82f6', ml: 0.25, animation: 'blink 1s step-end infinite', verticalAlign: 'text-bottom' }} />}
              </Typography>
            </Box>
          </Paper>
        </Box>
      )}
    </Paper>
  );
}
