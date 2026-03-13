/**
 * AgentFlowNode — Custom ReactFlow node card (n8n-style) for the pipeline canvas.
 */
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import QuestionAnswerIcon from '@mui/icons-material/QuestionAnswer';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import type { PhaseCategory, AgentTool } from '../../types/agent.types';
import { getCategoryColors, CATEGORY_LABELS } from './agent.constants';

export interface FlowNodeData extends Record<string, unknown> {
  label: string;
  description: string;
  category: PhaseCategory;
  icon: string;
  promptKey?: string;
  tools?: AgentTool[];
  enabled: boolean;
  nodeId: string;
  maxRetries?: number;
  continueQuestion?: boolean;
  onSelect?: (id: string) => void;
}

export default function AgentFlowNode({ data, selected }: NodeProps<Node<FlowNodeData>>) {
  const colors = getCategoryColors(data.category);
  const dimmed = !data.enabled;
  const enabledToolCount = data.tools?.filter(t => t.enabled).length ?? 0;

  return (
    <Paper
      elevation={selected ? 8 : 2}
      sx={{
        background: dimmed ? '#f5f5f5' : '#fff',
        borderLeft: `4px solid ${dimmed ? '#bdbdbd' : colors.border}`,
        borderRadius: '10px',
        p: '10px 14px',
        minWidth: 210,
        maxWidth: 280,
        opacity: dimmed ? 0.5 : 1,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        outline: selected ? `2px solid ${colors.border}` : 'none',
        '&:hover': { boxShadow: 6 },
      }}
      onClick={() => data.onSelect?.(data.nodeId)}
    >
      <Handle type="target" position={Position.Top} style={{ background: colors.border, width: 10, height: 10, border: '2px solid #fff' }} />

      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
        <Chip
          label={CATEGORY_LABELS[data.category]}
          size="small"
          sx={{ height: 18, fontSize: '0.6rem', fontWeight: 700, bgcolor: `${colors.accent}14`, color: colors.accent, border: `1px solid ${colors.accent}30` }}
        />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {data.continueQuestion && (
            <Tooltip title="Continue/Stop question enabled" arrow>
              <QuestionAnswerIcon sx={{ fontSize: 14, color: '#7c3aed' }} />
            </Tooltip>
          )}
          {(data.maxRetries ?? 0) > 0 && (
            <Tooltip title={`Max ${data.maxRetries} retries`} arrow>
              <Chip label={`↻${data.maxRetries}`} size="small" sx={{ height: 16, fontSize: '0.55rem', bgcolor: '#fff3e0', color: '#e65100' }} />
            </Tooltip>
          )}
          <Chip
            label={data.enabled ? 'ON' : 'OFF'}
            size="small"
            sx={{
              height: 18, fontSize: '0.55rem', fontWeight: 700,
              bgcolor: data.enabled ? '#e8f5e9' : '#ffebee',
              color: data.enabled ? '#2e7d32' : '#c62828',
            }}
          />
        </Box>
      </Box>

      {/* Title */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
        <Typography sx={{ fontSize: '1.15rem', lineHeight: 1 }}>{data.icon}</Typography>
        <Typography sx={{ fontWeight: 700, fontSize: '0.82rem', color: '#1a1a2e' }}>{data.label}</Typography>
      </Box>

      {/* Description */}
      <Typography sx={{ fontSize: '0.68rem', color: '#78909c', lineHeight: 1.4, mb: 0.5 }}>{data.description}</Typography>

      {/* Tools */}
      {enabledToolCount > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.3, mt: 0.5 }}>
          {data.tools!.filter(t => t.enabled).slice(0, 4).map(t => (
            <Chip key={t.id} label={`${t.icon} ${t.label}`} size="small"
              sx={{ height: 16, fontSize: '0.55rem', bgcolor: '#ede7f6', color: '#4527a0' }} />
          ))}
          {enabledToolCount > 4 && (
            <Chip label={`+${enabledToolCount - 4}`} size="small" sx={{ height: 16, fontSize: '0.55rem', bgcolor: '#e0e0e0' }} />
          )}
        </Box>
      )}

      <Handle type="source" position={Position.Bottom} style={{ background: colors.border, width: 10, height: 10, border: '2px solid #fff' }} />
    </Paper>
  );
}
