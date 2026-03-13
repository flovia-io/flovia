/**
 * WorkflowDebugView — Unified debug/trace view that renders agent execution
 * on top of the actual workflow editor canvas in read-only mode.
 *
 * Features:
 *  • Uses the SAME WorkflowNode component as the editor (read-only, no dragging)
 *  • Uses the SAME NodeConfigDrawer as the editor — in read-only mode with "Runs" tab
 *  • Overlays execution data (status, duration, output, error, liveOutput) from traces
 *  • Groups trace steps by node — if a node is hit multiple times (loops), shows "Run 1", "Run 2", etc.
 *  • Orphan steps (sub-steps not in the pipeline) rendered as dashed "sub-step" cards
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

import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import SkipNextIcon from '@mui/icons-material/SkipNext';

import type { AgentTrace, TraceStep, AgentNode as AgentNodeType, AgentEdge as AgentEdgeType, PhaseCategory } from '../../types/agent.types';
import { formatDuration, STATUS_COLORS } from '../shared/ExecutionViewParts';
import { WorkflowNode } from './WorkflowNode';
import { NodeConfigDrawer } from './NodeConfigDrawer';
import { getPaletteForType } from './workflow.constants';
import type { WfNodeData, NodeRunInfo } from './workflow.types';

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

// Map trace status → WfNodeData status
function traceStatusToNodeStatus(status: string): WfNodeData['status'] {
  if (status === 'success') return 'completed';
  if (status === 'error') return 'failed';
  if (status === 'running') return 'running';
  if (status === 'skipped') return 'skipped';
  return 'pending';
}

// Map agent pipeline category → nodeType for palette lookup
function categoryToNodeType(category: PhaseCategory): string {
  switch (category) {
    case 'entry': return 'trigger';
    case 'classification': return 'decision';
    case 'research': return 'llm';
    case 'planning': return 'llm';
    case 'execution': return 'developer';
    case 'verification': return 'llm';
    case 'output': return 'output';
    default: return 'llm';
  }
}

// ─── Node types: actual WorkflowNode + orphan sub-step node ─────────────────

/** Orphan node visual style (dashed border for sub-steps not mapped to pipeline) */
interface OrphanNodeData extends WfNodeData {
  /** Callback when clicked — opens detail panel */
  onOrphanClick?: (nodeId: string) => void;
  _orphanNodeId?: string;
}

function OrphanFlowNode({ id, data, selected }: NodeProps<Node<OrphanNodeData>>) {
  const colors = categoryColors[(data as any).category] || categoryColors.output;
  const borderColor = data.status ? (STATUS_COLORS[data.status] || colors.border) : colors.border;

  return (
    <Box sx={{ position: 'relative' }}>
      <Paper
        elevation={selected ? 6 : 1}
        onClick={() => data.onOrphanClick?.((data as any)._orphanNodeId || id)}
        sx={{
          background: '#fffde7',
          border: `2px dashed ${borderColor}`,
          borderRadius: '10px',
          p: '8px 12px',
          minWidth: 200,
          maxWidth: 260,
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          outline: selected ? `2px solid ${borderColor}` : 'none',
          '&:hover': { boxShadow: 4 },
        }}
      >
        <Handle type="target" position={Position.Left} style={{ background: borderColor, width: 8, height: 8, border: '2px solid #fff' }} />

        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
          <Chip label="Sub-step" size="small"
            sx={{ height: 16, fontSize: '0.5rem', fontWeight: 700, bgcolor: '#fff8e1', color: '#f57f17', border: '1px solid #ffe082' }} />
          <Box sx={{ flex: 1 }} />
          {data.status && getStatusIcon(data.status === 'completed' ? 'success' : data.status === 'failed' ? 'error' : data.status, 14)}
        </Box>

        {/* Title */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
          <Typography sx={{ fontSize: '0.95rem', lineHeight: 1 }}>{data.icon}</Typography>
          <Typography sx={{ fontWeight: 600, fontSize: '0.75rem', color: '#5d4037' }}>{data.label}</Typography>
        </Box>

        {/* Duration + error */}
        {(data.durationMs != null || data.error) && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.25 }}>
            {data.durationMs != null && data.durationMs > 0 && (
              <Typography sx={{ fontSize: '0.58rem', color: '#78909c' }}>{formatDuration(data.durationMs)}</Typography>
            )}
            {data.error && (
              <Typography sx={{ fontSize: '0.58rem', color: '#ef4444', fontWeight: 600, flex: 1 }} noWrap>
                ⚠ {data.error}
              </Typography>
            )}
          </Box>
        )}

        <Handle type="source" position={Position.Right} style={{ background: borderColor, width: 8, height: 8, border: '2px solid #fff' }} />
      </Paper>
    </Box>
  );
}

const debugNodeTypes: NodeTypes = {
  workflowNode: WorkflowNode as any,
  orphanNode: OrphanFlowNode as any,
};

// ─── Orphan step detection & positioning ────────────────────────────────────

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

interface OrphanNodeInfo {
  nodeId: string;
  label: string;
  icon: string;
  category: PhaseCategory;
  position: { x: number; y: number };
  parentNodeId: string | null;
}

function findOrphanSteps(
  steps: TraceStep[],
  pipelineNodeIds: Set<string>,
  pipelineNodes: AgentNodeType[],
): OrphanNodeInfo[] {
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
    const sameCategory = pipelineNodes.filter(n => n.category === first.category);
    const parent = sameCategory.length > 0 ? sameCategory[0] : pipelineNodes[0];
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

  // Convert pipeline nodes → actual WorkflowNode-compatible ReactFlow nodes
  // prefilled with execution data from the trace (read-only debug overlay)
  const flowNodes = useMemo((): Node<WfNodeData>[] => {
    // Regular pipeline nodes — render using the SAME WorkflowNode as the editor
    const pipelineFlowNodes: Node<WfNodeData>[] = pipelineNodes.map(n => {
      const group = runGroups.get(n.id);
      const lastRun = group ? group.runs[group.runs.length - 1] : null;
      const overallStatus = lastRun
        ? traceStatusToNodeStatus(lastRun.status)
        : (n.enabled ? undefined : 'skipped');
      const totalDuration = group
        ? group.runs.reduce((sum, r) => sum + (r.durationMs || 0), 0)
        : undefined;
      const lastError = lastRun?.error;
      const lastOutput = lastRun?.output;
      const outputText = lastOutput != null
        ? (typeof lastOutput === 'string' ? lastOutput : (lastOutput as any)?.text || (lastOutput as any)?.reply || JSON.stringify(lastOutput, null, 2))
        : undefined;

      return {
        id: n.id,
        type: 'workflowNode',
        position: n.position,
        selected: selectedNodeId === n.id,
        data: {
          label: n.label,
          icon: n.icon,
          nodeType: categoryToNodeType(n.category),
          config: {},
          subtitle: n.description,
          status: overallStatus,
          durationMs: totalDuration,
          error: lastError,
          output: lastOutput,
          itemCount: group ? group.runs.length : undefined,
          // Show output text in live output bubble if the step has output
          liveOutput: outputText?.slice(0, 500),
          outputDismissed: !outputText, // Only show bubble if there's output
        },
      };
    });

    // Orphan nodes (sub-steps not mapped to pipeline) — dashed cards
    const orphanFlowNodes: Node<OrphanNodeData>[] = orphanNodes.map(o => {
      const group = runGroups.get(o.nodeId);
      const lastRun = group ? group.runs[group.runs.length - 1] : null;

      return {
        id: o.nodeId,
        type: 'orphanNode',
        position: o.position,
        selected: selectedNodeId === o.nodeId,
        data: {
          label: o.label,
          icon: o.icon,
          nodeType: 'action',
          config: {},
          category: o.category,
          status: lastRun ? traceStatusToNodeStatus(lastRun.status) : undefined,
          durationMs: lastRun?.durationMs,
          error: lastRun?.error,
          _orphanNodeId: o.nodeId,
          onOrphanClick: handleNodeSelect,
        } as OrphanNodeData,
      };
    });

    return [...pipelineFlowNodes, ...orphanFlowNodes];
  }, [pipelineNodes, orphanNodes, runGroups, selectedNodeId, handleNodeSelect]);

  // Convert pipeline edges + orphan connector edges
  const flowEdges = useMemo((): Edge[] => {
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

  // Build the flow node for NodeConfigDrawer (same shape it expects)
  const selectedFlowNode = useMemo((): Node<WfNodeData> | null => {
    if (!selectedNodeId) return null;
    return flowNodes.find(n => n.id === selectedNodeId) ?? null;
  }, [selectedNodeId, flowNodes]);

  // Convert trace runs into NodeRunInfo[] for the drawer's "Runs" tab
  const selectedDebugRuns = useMemo((): NodeRunInfo[] | undefined => {
    if (!selectedGroup) return undefined;
    return selectedGroup.runs.map((run, idx) => ({
      runIndex: idx,
      status: run.status,
      durationMs: run.durationMs,
      input: run.input,
      output: run.output,
      error: run.error,
      tokens: run.tokens,
      timestamp: run.timestamp,
      type: run.type,
    }));
  }, [selectedGroup]);

  return (
    <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      {/* ReactFlow Canvas — same component as editor, read-only */}
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          nodeTypes={debugNodeTypes}
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
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#e2e8f0" />
          <Controls showInteractive={false} />
          <MiniMap
            nodeColor={n => {
              const d = n.data as WfNodeData;
              if (d.status === 'completed') return '#22c55e';
              if (d.status === 'failed') return '#ef4444';
              if (d.status === 'running') return '#3b82f6';
              const palette = getPaletteForType(d.nodeType);
              return palette?.color || '#94a3b8';
            }}
            maskColor="rgba(0,0,0,0.08)"
            style={{ borderRadius: 8, border: '1px solid #e0e0e0' }}
          />

          {/* Read-only banner */}
          <Panel position="top-left">
            <Paper elevation={1} sx={{ px: 1.5, py: 0.5, borderRadius: 2, display: 'flex', alignItems: 'center', gap: 1, bgcolor: '#e3f2fd', border: '1px solid #bbdefb' }}>
              <Typography sx={{ fontSize: '0.65rem', color: '#1565c0', fontWeight: 600 }}>
                🔒 Read-only debug view — execution data overlaid on workflow canvas
              </Typography>
            </Paper>
          </Panel>

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

      {/* NodeConfigDrawer — same as editor, but read-only with debug runs */}
      <NodeConfigDrawer
        open={!!selectedNodeId}
        node={selectedFlowNode}
        onClose={() => setSelectedNodeId(null)}
        onUpdateNodeData={() => {}} // no-op in debug mode
        onDeleteNode={() => {}} // no-op in debug mode
        readOnly
        debugRuns={selectedDebugRuns}
      />
    </Box>
  );
}
