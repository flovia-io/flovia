/**
 * WorkflowDebugView — Unified debug/trace view that renders agent execution
 * on top of the actual workflow editor canvas.
 *
 * Features:
 *  • Shows the agent pipeline as a ReactFlow graph (same nodes/edges as the pipeline canvas)
 *  • Overlays execution data (status, duration, input/output) on each node
 *  • Groups trace steps by node — if a node is hit multiple times (loops), shows "Run 1", "Run 2", etc.
 *  • Expandable data table below each node with structured input/output per run
 *  • Shares visual primitives with ExecutionViewParts for consistency
 */
import { useState, useMemo, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  BackgroundVariant,
  type Node,
  type Edge,
  type NodeTypes,
  Handle,
  Position,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import IconButton from '@mui/material/IconButton';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';

import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import SkipNextIcon from '@mui/icons-material/SkipNext';

import type { AgentTrace, TraceStep, AgentNode as AgentNodeType, AgentEdge as AgentEdgeType, PhaseCategory } from '../../types/agent.types';
import { DataBlock, formatDuration } from '../shared/ExecutionViewParts';

// ─── Constants ──────────────────────────────────────────────────────────────

const categoryColors: Record<string, { bg: string; border: string; accent: string }> = {
  entry:          { bg: '#e3f2fd', border: '#1976d2', accent: '#1565c0' },
  classification: { bg: '#fff8e1', border: '#f9a825', accent: '#f57f17' },
  research:       { bg: '#e8f5e9', border: '#43a047', accent: '#2e7d32' },
  planning:       { bg: '#f3e5f5', border: '#8e24aa', accent: '#6a1b9a' },
  execution:      { bg: '#ffebee', border: '#e53935', accent: '#c62828' },
  verification:   { bg: '#e0f2f1', border: '#00897b', accent: '#00695c' },
  output:         { bg: '#eceff1', border: '#546e7a', accent: '#37474f' },
};

const categoryLabels: Record<string, string> = {
  entry: 'Entry', classification: 'Classification', research: 'Research',
  planning: 'Planning', execution: 'Execution', verification: 'Verification', output: 'Output',
};

// ─── Per-node grouped runs ──────────────────────────────────────────────────

export interface NodeRunGroup {
  nodeId: string;
  nodeLabel: string;
  category: PhaseCategory;
  /** Ordered runs — each entry is a TraceStep from one execution pass */
  runs: TraceStep[];
}

/** Group trace steps by their nodeId so we can show multiple runs per node */
function groupStepsByNode(steps: TraceStep[]): Map<string, NodeRunGroup> {
  const map = new Map<string, NodeRunGroup>();
  for (const step of steps) {
    const existing = map.get(step.nodeId);
    if (existing) {
      existing.runs.push(step);
    } else {
      map.set(step.nodeId, {
        nodeId: step.nodeId,
        nodeLabel: step.nodeLabel,
        category: step.category,
        runs: [step],
      });
    }
  }
  return map;
}

// ─── Status helpers ─────────────────────────────────────────────────────────

function getStatusIcon(status: string, size = 16) {
  switch (status) {
    case 'success':
    case 'completed':
      return <CheckCircleIcon sx={{ fontSize: size, color: '#22c55e' }} />;
    case 'error':
    case 'failed':
      return <ErrorIcon sx={{ fontSize: size, color: '#ef4444' }} />;
    case 'running':
      return <HourglassEmptyIcon sx={{ fontSize: size, color: '#3b82f6', animation: 'exec-spin 1s linear infinite', '@keyframes exec-spin': { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } } }} />;
    case 'skipped':
      return <SkipNextIcon sx={{ fontSize: size, color: '#94a3b8' }} />;
    default:
      return <HourglassEmptyIcon sx={{ fontSize: size, color: '#94a3b8' }} />;
  }
}

// ─── Debug Node (ReactFlow custom node with inline debug data) ──────────────

interface DebugNodeData extends Record<string, unknown> {
  label: string;
  description: string;
  category: PhaseCategory;
  icon: string;
  enabled: boolean;
  nodeId: string;
  /** Grouped runs for this node from the active trace */
  runGroup: NodeRunGroup | null;
  /** Whether this node is currently selected/expanded */
  isSelected: boolean;
  onSelect: (nodeId: string) => void;
}

function DebugFlowNode({ data }: NodeProps<Node<DebugNodeData>>) {
  const colors = categoryColors[data.category] || categoryColors.output;
  const group = data.runGroup;
  const hasRuns = group && group.runs.length > 0;
  const lastRun = hasRuns ? group!.runs[group!.runs.length - 1] : null;
  const overallStatus = lastRun?.status || (data.enabled ? 'pending' : 'skipped');
  const borderColor = hasRuns
    ? (overallStatus === 'success' ? '#22c55e' : overallStatus === 'error' ? '#ef4444' : overallStatus === 'running' ? '#3b82f6' : colors.border)
    : (data.enabled ? colors.border : '#bdbdbd');
  const totalDuration = hasRuns ? group!.runs.reduce((sum, r) => sum + (r.durationMs || 0), 0) : undefined;

  return (
    <Box sx={{ position: 'relative' }}>
      <Paper
        elevation={data.isSelected ? 8 : 2}
        onClick={() => data.onSelect(data.nodeId)}
        sx={{
          background: !data.enabled ? '#f5f5f5' : '#fff',
          borderLeft: `4px solid ${borderColor}`,
          borderRadius: '10px',
          p: '10px 14px',
          minWidth: 230,
          maxWidth: 310,
          opacity: !data.enabled ? 0.5 : 1,
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          outline: data.isSelected ? `2px solid ${borderColor}` : 'none',
          '&:hover': { boxShadow: 6 },
        }}
      >
        <Handle type="target" position={Position.Top} style={{ background: borderColor, width: 10, height: 10, border: '2px solid #fff' }} />

        {/* Header row */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
          <Chip label={categoryLabels[data.category] || data.category} size="small"
            sx={{ height: 18, fontSize: '0.6rem', fontWeight: 700, bgcolor: `${colors.accent}14`, color: colors.accent, border: `1px solid ${colors.accent}30` }} />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {hasRuns && getStatusIcon(overallStatus, 16)}
            {hasRuns && group!.runs.length > 1 && (
              <Chip label={`×${group!.runs.length}`} size="small" sx={{ height: 18, fontSize: '0.55rem', fontWeight: 700, bgcolor: '#e3f2fd', color: '#1976d2' }} />
            )}
          </Box>
        </Box>

        {/* Title */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
          <Typography sx={{ fontSize: '1.15rem', lineHeight: 1 }}>{data.icon}</Typography>
          <Typography sx={{ fontWeight: 700, fontSize: '0.82rem', color: '#1a1a2e' }}>{data.label}</Typography>
        </Box>

        {/* Type + Duration */}
        {hasRuns && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <Typography sx={{ fontSize: '0.62rem', color: '#9e9e9e' }}>{lastRun!.type}</Typography>
            {totalDuration != null && totalDuration > 0 && (
              <Typography sx={{ fontSize: '0.62rem', color: '#78909c', ml: 'auto' }}>{formatDuration(totalDuration)}</Typography>
            )}
          </Box>
        )}

        {/* Tokens */}
        {hasRuns && lastRun?.tokens && (
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {(['prompt', 'completion', 'total'] as const).map(k => (
              <Chip key={k} size="small" label={`${k[0].toUpperCase()}: ${lastRun!.tokens![k]}`}
                sx={{ height: 16, fontSize: '0.5rem', bgcolor: '#f5f3ff', color: '#7c3aed', fontFamily: 'monospace' }} />
            ))}
          </Box>
        )}

        {/* Error */}
        {hasRuns && lastRun?.error && (
          <Typography sx={{ fontSize: '0.62rem', color: '#ef4444', mt: 0.5, fontWeight: 600 }}>⚠ {lastRun.error}</Typography>
        )}

        <Handle type="source" position={Position.Bottom} style={{ background: borderColor, width: 10, height: 10, border: '2px solid #fff' }} />
      </Paper>
    </Box>
  );
}

// (debugNodeTypes replaced by allNodeTypes which includes orphanNode)

// ─── Data Table for a single step run ───────────────────────────────────────

function StepRunDataTable({ step, runIndex }: { step: TraceStep; runIndex: number }) {
  const [tab, setTab] = useState(0); // 0=input, 1=output, 2=info

  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden', mb: 1 }}>
      {/* Run header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 0.75, bgcolor: '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
        {getStatusIcon(step.status, 14)}
        <Typography sx={{ fontWeight: 700, fontSize: '0.72rem', color: '#334155' }}>Run #{runIndex + 1}</Typography>
        <Chip label={step.type} size="small" sx={{ height: 16, fontSize: '0.55rem', bgcolor: step.type === 'llm-call' ? '#e3f2fd' : '#e8f5e9', color: step.type === 'llm-call' ? '#1565c0' : '#2e7d32', fontFamily: 'monospace' }} />
        {step.durationMs != null && (
          <Typography sx={{ fontSize: '0.62rem', color: '#94a3b8', ml: 'auto' }}>{formatDuration(step.durationMs)}</Typography>
        )}
        {step.tokens && (
          <Chip label={`${step.tokens.total} tok`} size="small" sx={{ height: 16, fontSize: '0.5rem', color: '#8b5cf6', bgcolor: '#f5f3ff', border: '1px solid #ddd6fe' }} />
        )}
      </Box>

      {/* Mini tabs */}
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{
        minHeight: 28, borderBottom: '1px solid #f0f0f0',
        '& .MuiTab-root': { minHeight: 28, fontSize: '0.65rem', textTransform: 'none', py: 0.25, px: 1.5, minWidth: 'auto' },
        '& .MuiTabs-indicator': { height: 2 },
      }}>
        <Tab label={`Input${step.input != null ? ' ✓' : ''}`} />
        <Tab label={`Output${step.output != null ? ' ✓' : ''}`} />
        <Tab label="Info" />
      </Tabs>

      <Box sx={{ p: 1 }}>
        {tab === 0 && (
          step.input != null ? (
            <DataBlock label="" data={step.input} color="#3b82f6" maxHeight={180} />
          ) : (
            <Typography sx={{ fontSize: '0.68rem', color: '#9e9e9e', textAlign: 'center', py: 1 }}>No input data</Typography>
          )
        )}
        {tab === 1 && (
          step.output != null ? (
            <DataBlock label="" data={step.output} color="#22c55e" maxHeight={180} />
          ) : (
            <Typography sx={{ fontSize: '0.68rem', color: '#9e9e9e', textAlign: 'center', py: 1 }}>No output data</Typography>
          )
        )}
        {tab === 2 && (
          <TableContainer>
            <Table size="small" sx={{ '& .MuiTableCell-root': { fontSize: '0.68rem', py: 0.5, px: 1, fontFamily: 'monospace' } }}>
              <TableBody>
                <TableRow><TableCell sx={{ fontWeight: 600, color: '#64748b' }}>Step ID</TableCell><TableCell>{step.id}</TableCell></TableRow>
                <TableRow><TableCell sx={{ fontWeight: 600, color: '#64748b' }}>Node ID</TableCell><TableCell>{step.nodeId}</TableCell></TableRow>
                <TableRow><TableCell sx={{ fontWeight: 600, color: '#64748b' }}>Type</TableCell><TableCell>{step.type}</TableCell></TableRow>
                <TableRow><TableCell sx={{ fontWeight: 600, color: '#64748b' }}>Category</TableCell><TableCell>{step.category}</TableCell></TableRow>
                <TableRow><TableCell sx={{ fontWeight: 600, color: '#64748b' }}>Timestamp</TableCell><TableCell>{new Date(step.timestamp).toLocaleString()}</TableCell></TableRow>
                <TableRow><TableCell sx={{ fontWeight: 600, color: '#64748b' }}>Duration</TableCell><TableCell>{step.durationMs != null ? formatDuration(step.durationMs) : '—'}</TableCell></TableRow>
                {step.chosenFiles && step.chosenFiles.length > 0 && (
                  <TableRow><TableCell sx={{ fontWeight: 600, color: '#64748b' }}>Chosen Files</TableCell><TableCell>{step.chosenFiles.join(', ')}</TableCell></TableRow>
                )}
                {step.error && (
                  <TableRow><TableCell sx={{ fontWeight: 600, color: '#ef4444' }}>Error</TableCell><TableCell sx={{ color: '#ef4444' }}>{step.error}</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>
    </Paper>
  );
}

// ─── Node Debug Detail Panel (sidebar when a node is selected) ──────────────

function NodeDebugDetail({ group, nodeDef }: { group: NodeRunGroup; nodeDef?: AgentNodeType }) {
  return (
    <Box sx={{ p: 2, overflowY: 'auto', height: '100%' }}>
      {/* Node header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Typography sx={{ fontSize: '1.4rem' }}>{nodeDef?.icon || '⚡'}</Typography>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontWeight: 700, fontSize: '0.92rem', color: '#1a1a2e' }}>{group.nodeLabel}</Typography>
          <Typography sx={{ fontSize: '0.68rem', color: '#78909c' }}>{nodeDef?.description || ''}</Typography>
        </Box>
        <Chip
          label={`${group.runs.length} run${group.runs.length !== 1 ? 's' : ''}`}
          size="small"
          sx={{ fontWeight: 700, fontSize: '0.65rem', bgcolor: '#e3f2fd', color: '#1976d2' }}
        />
      </Box>

      {/* Runs summary table */}
      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, mb: 2 }}>
        <Table size="small" sx={{ '& .MuiTableCell-root': { fontSize: '0.68rem', py: 0.5, px: 1 } }}>
          <TableHead>
            <TableRow sx={{ bgcolor: '#f8fafc' }}>
              <TableCell sx={{ fontWeight: 700 }}>Run</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Duration</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Tokens</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {group.runs.map((run, idx) => (
              <TableRow key={run.id} sx={{ '&:hover': { bgcolor: '#f8fafc' } }}>
                <TableCell sx={{ fontWeight: 600 }}>#{idx + 1}</TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    {getStatusIcon(run.status, 14)}
                    <span>{run.status}</span>
                  </Box>
                </TableCell>
                <TableCell>
                  <Chip label={run.type} size="small" sx={{ height: 16, fontSize: '0.55rem', fontFamily: 'monospace' }} />
                </TableCell>
                <TableCell>{run.durationMs != null ? formatDuration(run.durationMs) : '—'}</TableCell>
                <TableCell>{run.tokens ? run.tokens.total.toLocaleString() : '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Detailed data per run */}
      {group.runs.map((run, idx) => (
        <StepRunDataTable key={run.id} step={run} runIndex={idx} />
      ))}
    </Box>
  );
}

// ─── Orphan node visual style (dashed border for sub-steps) ─────────────────

const orphanTypeIcons: Record<string, string> = {
  'llm-call': '🧠',
  'tool-call': '🔧',
  'file-read': '📖',
  'file-write': '💾',
  'file-search': '🔍',
  'text-search': '🔎',
  'integration-call': '🔌',
  'decision': '🤔',
};

function OrphanFlowNode({ data }: NodeProps<Node<DebugNodeData>>) {
  const colors = categoryColors[data.category] || categoryColors.output;
  const group = data.runGroup;
  const hasRuns = group && group.runs.length > 0;
  const lastRun = hasRuns ? group!.runs[group!.runs.length - 1] : null;
  const overallStatus = lastRun?.status || 'pending';
  const borderColor = hasRuns
    ? (overallStatus === 'success' ? '#22c55e' : overallStatus === 'error' ? '#ef4444' : overallStatus === 'running' ? '#3b82f6' : colors.border)
    : colors.border;

  return (
    <Box sx={{ position: 'relative' }}>
      <Paper
        elevation={data.isSelected ? 6 : 1}
        onClick={() => data.onSelect(data.nodeId)}
        sx={{
          background: '#fffde7',
          border: `2px dashed ${borderColor}`,
          borderRadius: '10px',
          p: '8px 12px',
          minWidth: 200,
          maxWidth: 260,
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          outline: data.isSelected ? `2px solid ${borderColor}` : 'none',
          '&:hover': { boxShadow: 4 },
        }}
      >
        <Handle type="target" position={Position.Top} style={{ background: borderColor, width: 8, height: 8, border: '2px solid #fff' }} />

        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.25 }}>
          <Chip label="Sub-step" size="small"
            sx={{ height: 16, fontSize: '0.5rem', fontWeight: 700, bgcolor: '#fff8e1', color: '#f57f17', border: '1px solid #ffe082' }} />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {hasRuns && getStatusIcon(overallStatus, 14)}
            {hasRuns && group!.runs.length > 1 && (
              <Chip label={`×${group!.runs.length}`} size="small" sx={{ height: 16, fontSize: '0.5rem', fontWeight: 700, bgcolor: '#e3f2fd', color: '#1976d2' }} />
            )}
          </Box>
        </Box>

        {/* Title */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
          <Typography sx={{ fontSize: '0.95rem', lineHeight: 1 }}>{data.icon}</Typography>
          <Typography sx={{ fontWeight: 600, fontSize: '0.75rem', color: '#5d4037' }}>{data.label}</Typography>
        </Box>

        {/* Type + Duration */}
        {hasRuns && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography sx={{ fontSize: '0.58rem', color: '#9e9e9e', fontFamily: 'monospace' }}>{lastRun!.type}</Typography>
            {lastRun!.durationMs != null && lastRun!.durationMs > 0 && (
              <Typography sx={{ fontSize: '0.58rem', color: '#78909c', ml: 'auto' }}>{formatDuration(lastRun!.durationMs)}</Typography>
            )}
          </Box>
        )}

        <Handle type="source" position={Position.Bottom} style={{ background: borderColor, width: 8, height: 8, border: '2px solid #fff' }} />
      </Paper>
    </Box>
  );
}

const allNodeTypes: NodeTypes = { debugNode: DebugFlowNode, orphanNode: OrphanFlowNode };

// ─── Orphan step detection & positioning ────────────────────────────────────

interface OrphanNodeInfo {
  nodeId: string;
  label: string;
  icon: string;
  category: PhaseCategory;
  /** Computed position next to the nearest category-matching pipeline node */
  position: { x: number; y: number };
  /** Which pipeline node this is logically closest to (for edge drawing) */
  parentNodeId: string | null;
}

/**
 * Find trace steps whose nodeId doesn't match any pipeline node,
 * group them, and compute positions for floating orphan nodes.
 */
function findOrphanSteps(
  steps: TraceStep[],
  pipelineNodeIds: Set<string>,
  pipelineNodes: AgentNodeType[],
): OrphanNodeInfo[] {
  // Collect unique orphan nodeIds
  const orphanMap = new Map<string, { steps: TraceStep[] }>();
  for (const step of steps) {
    if (pipelineNodeIds.has(step.nodeId)) continue;
    const existing = orphanMap.get(step.nodeId);
    if (existing) { existing.steps.push(step); }
    else { orphanMap.set(step.nodeId, { steps: [step] }); }
  }

  if (orphanMap.size === 0) return [];

  const orphans: OrphanNodeInfo[] = [];
  let orphanIndex = 0;

  for (const [nodeId, { steps: orphanSteps }] of orphanMap) {
    const first = orphanSteps[0];

    // Find the closest pipeline node of the same category for positioning
    const sameCategory = pipelineNodes.filter(n => n.category === first.category);
    const parent = sameCategory.length > 0 ? sameCategory[0] : pipelineNodes[0];

    // Position orphans to the right of their parent category node, stacked vertically
    const baseX = (parent?.position?.x ?? 600) + 380;
    const baseY = (parent?.position?.y ?? 0) + orphanIndex * 120;

    orphans.push({
      nodeId,
      label: first.nodeLabel,
      icon: orphanTypeIcons[first.type] || '⚡',
      category: first.category,
      position: { x: baseX, y: baseY },
      parentNodeId: parent?.id || null,
    });
    orphanIndex++;
  }

  return orphans;
}

// ─── Main WorkflowDebugView ─────────────────────────────────────────────────

export interface WorkflowDebugViewProps {
  /** The agent trace to visualize */
  trace: AgentTrace;
  /** The pipeline node definitions (from AgentConfig.nodes) */
  pipelineNodes: AgentNodeType[];
  /** The pipeline edge definitions (from AgentConfig.edges) */
  pipelineEdges: AgentEdgeType[];
}

export function WorkflowDebugView({ trace, pipelineNodes, pipelineEdges }: WorkflowDebugViewProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const runGroups = useMemo(() => groupStepsByNode(trace.steps), [trace.steps]);

  const handleNodeSelect = useCallback((nodeId: string) => {
    setSelectedNodeId(prev => prev === nodeId ? null : nodeId);
  }, []);

  // Detect orphan steps (nodeIds not in pipelineNodes)
  const pipelineNodeIds = useMemo(() => new Set(pipelineNodes.map(n => n.id)), [pipelineNodes]);
  const orphanNodes = useMemo(
    () => findOrphanSteps(trace.steps, pipelineNodeIds, pipelineNodes),
    [trace.steps, pipelineNodeIds, pipelineNodes],
  );

  // Convert pipeline nodes to ReactFlow debug nodes
  const flowNodes = useMemo((): Node<DebugNodeData>[] => {
    // Regular pipeline nodes
    const pipelineFlowNodes: Node<DebugNodeData>[] = pipelineNodes.map(n => ({
      id: n.id,
      type: 'debugNode',
      position: n.position,
      data: {
        label: n.label,
        description: n.description,
        category: n.category,
        icon: n.icon,
        enabled: n.enabled,
        nodeId: n.id,
        runGroup: runGroups.get(n.id) || null,
        isSelected: selectedNodeId === n.id,
        onSelect: handleNodeSelect,
      },
    }));

    // Orphan nodes (sub-steps not mapped to pipeline)
    const orphanFlowNodes: Node<DebugNodeData>[] = orphanNodes.map(o => ({
      id: o.nodeId,
      type: 'orphanNode',
      position: o.position,
      data: {
        label: o.label,
        description: `Sub-step not mapped to a pipeline node`,
        category: o.category,
        icon: o.icon,
        enabled: true,
        nodeId: o.nodeId,
        runGroup: runGroups.get(o.nodeId) || null,
        isSelected: selectedNodeId === o.nodeId,
        onSelect: handleNodeSelect,
      },
    }));

    return [...pipelineFlowNodes, ...orphanFlowNodes];
  }, [pipelineNodes, orphanNodes, runGroups, selectedNodeId, handleNodeSelect]);

  // Convert pipeline edges + orphan connector edges
  const flowEdges = useMemo((): Edge[] => {
    // Standard pipeline edges
    const standardEdges: Edge[] = pipelineEdges.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.label,
      animated: e.animated ?? true,
      style: {
        stroke: categoryColors[pipelineNodes.find(n => n.id === e.source)?.category || 'output']?.border || '#999',
        strokeWidth: 2,
        ...(e.label ? { strokeDasharray: '5,5' } : {}),
      },
      labelStyle: { fontSize: 10, fill: '#78909c' },
      labelBgStyle: { fill: '#fafafa', fillOpacity: 0.8 },
    }));

    // Dashed edges from parent pipeline node → orphan node
    const orphanEdges: Edge[] = orphanNodes
      .filter(o => o.parentNodeId)
      .map(o => ({
        id: `e-orphan-${o.nodeId}`,
        source: o.parentNodeId!,
        target: o.nodeId,
        animated: false,
        style: { stroke: '#f9a825', strokeWidth: 1.5, strokeDasharray: '4,4' },
        labelStyle: { fontSize: 9, fill: '#f57f17' },
        label: 'sub-step',
        labelBgStyle: { fill: '#fffde7', fillOpacity: 0.9 },
      }));

    return [...standardEdges, ...orphanEdges];
  }, [pipelineEdges, pipelineNodes, orphanNodes]);

  const selectedGroup = selectedNodeId ? runGroups.get(selectedNodeId) : null;
  const selectedNodeDef = selectedNodeId
    ? pipelineNodes.find(n => n.id === selectedNodeId)
      // For orphan nodes, synthesize a minimal node definition for the detail panel
      ?? (() => {
        const orphan = orphanNodes.find(o => o.nodeId === selectedNodeId);
        if (!orphan) return undefined;
        return {
          id: orphan.nodeId,
          label: orphan.label,
          description: `Sub-step not mapped to a pipeline node`,
          category: orphan.category,
          icon: orphan.icon,
          enabled: true,
          position: orphan.position,
        } satisfies AgentNodeType;
      })()
    : undefined;

  return (
    <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      {/* ReactFlow Canvas */}
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          nodeTypes={allNodeTypes}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable
          proOptions={{ hideAttribution: true }}
          minZoom={0.2}
          maxZoom={1.5}
          onNodeClick={(_, node) => handleNodeSelect(node.id)}
          onPaneClick={() => setSelectedNodeId(null)}
        >
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#e0e0e0" />
          <Controls showInteractive={false} />
          <MiniMap
            nodeColor={n => {
              const d = n.data as DebugNodeData;
              const group = d.runGroup;
              if (group && group.runs.length > 0) {
                const lastStatus = group.runs[group.runs.length - 1].status;
                if (lastStatus === 'success') return '#22c55e';
                if (lastStatus === 'error') return '#ef4444';
                if (lastStatus === 'running') return '#3b82f6';
              }
              return categoryColors[d.category]?.border || '#999';
            }}
            style={{ borderRadius: 8, border: '1px solid #e0e0e0' }}
          />
          {/* Legend for orphan sub-steps */}
          {orphanNodes.length > 0 && (
            <Panel position="top-right">
              <Paper elevation={1} sx={{ px: 1.5, py: 0.75, borderRadius: 2, display: 'flex', alignItems: 'center', gap: 1, bgcolor: '#fffde7', border: '1px dashed #f9a825' }}>
                <Typography sx={{ fontSize: '0.65rem', color: '#f57f17', fontWeight: 600 }}>
                  ⚡ {orphanNodes.length} sub-step{orphanNodes.length !== 1 ? 's' : ''} (not in pipeline)
                </Typography>
              </Paper>
            </Panel>
          )}
        </ReactFlow>
      </Box>

      {/* Right Detail Panel (shows when a node is selected and has runs) */}
      {selectedGroup && (
        <Paper
          elevation={0}
          sx={{
            width: 420,
            borderLeft: '1px solid #e0e0e0',
            flexShrink: 0,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Panel header */}
          <Box sx={{
            px: 2, py: 1.25,
            borderBottom: `3px solid ${categoryColors[selectedGroup.category]?.border || '#999'}`,
            bgcolor: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <Typography sx={{ fontWeight: 700, fontSize: '0.88rem', color: '#1a1a2e' }}>
              {selectedGroup.nodeLabel}
            </Typography>
            <IconButton size="small" onClick={() => setSelectedNodeId(null)}>
              <ExpandLessIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Box>

          {/* Panel body */}
          <Box sx={{ flex: 1, overflow: 'auto', bgcolor: '#fafafa' }}>
            <NodeDebugDetail group={selectedGroup} nodeDef={selectedNodeDef} />
          </Box>
        </Paper>
      )}

      {/* If selected node has no runs, show a hint */}
      {selectedNodeId && !selectedGroup && (
        <Paper
          elevation={0}
          sx={{
            width: 320,
            borderLeft: '1px solid #e0e0e0',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: '#fafafa',
          }}
        >
          <Box sx={{ textAlign: 'center', px: 3 }}>
            <Typography sx={{ fontSize: '1.5rem', mb: 1 }}>🔇</Typography>
            <Typography sx={{ fontWeight: 600, fontSize: '0.85rem', color: '#9e9e9e' }}>
              No execution data
            </Typography>
            <Typography sx={{ fontSize: '0.72rem', color: '#bdbdbd', mt: 0.5 }}>
              This node was not reached during this run.
            </Typography>
          </Box>
        </Paper>
      )}
    </Box>
  );
}
