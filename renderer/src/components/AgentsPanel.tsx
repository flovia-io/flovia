/**
 * AgentsPanel — n8n-style visual agent builder with:
 *   - Agent list sidebar (create, rename, delete, duplicate)
 *   - Visual pipeline canvas (draggable nodes, editable parameters, tool config)
 *   - Slide-out node parameter editor (n8n-style right drawer)
 *   - Execution trace viewer (real-time step-by-step observability)
 *   - "Continue or Stop" question toggle + max retries per node
 *
 * Sub-components live in ./agents/ for maintainability.
 */
import { useCallback, useMemo, useState, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type NodeTypes,
  BackgroundVariant,
  type OnNodesChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

/* MUI */
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import MuiButton from '@mui/material/Button';
import MuiIconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import MuiBadge from '@mui/material/Badge';
import FormControl from '@mui/material/FormControl';
import Collapse from '@mui/material/Collapse';

/* MUI Icons */
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import SettingsIcon from '@mui/icons-material/Settings';
import VisibilityIcon from '@mui/icons-material/Visibility';
import BuildIcon from '@mui/icons-material/Build';
import TimelineIcon from '@mui/icons-material/Timeline';
import StarIcon from '@mui/icons-material/Star';
import DescriptionIcon from '@mui/icons-material/Description';

/* Types */
import type {
  AgentNode as AgentNodeType,
  AgentTool,
  AgentEdge as AgentEdgeType,
  AgentParameters,
} from '../types/agent.types';
import { CORE_AGENT_TOOLS, buildAllAgentTools } from '../types/agent.types';
import type { ConnectorToolSource } from '../types/agent.types';

/* Context */
import { useAgentExecution } from '../context/AgentExecutionContext';
import { useBackend } from '../context/BackendContext';

/* Sub-components */
import {
  AgentFlowNode,
  type FlowNodeData,
  NodeParameterDrawer,
  AddNodeDialog,
  ParametersDialog,
  CATEGORY_COLORS,
  CATEGORY_LABELS,
} from './agents';
import { WorkflowDebugView } from './workflow/WorkflowDebugView';
import { ConfirmDialog } from './shared';

/* ─── ReactFlow node types map ─── */
const nodeTypes: NodeTypes = { agentNode: AgentFlowNode };

/* ─── View toggle ─── */
type PanelView = 'canvas' | 'trace';

/* ══════════════════════════════════════
   Main AgentsPanel
   ══════════════════════════════════════ */
export default function AgentsPanel() {
  const {
    agents, activeAgent, activeAgentId, setActiveAgentId,
    createAgent, updateAgent, deleteAgent, renameAgent, duplicateAgent,
    traces,
  } = useAgentExecution();
  const backend = useBackend();

  /* ── Local state ── */
  const [view, setView] = useState<PanelView>('canvas');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState('');
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [addingNode, setAddingNode] = useState(false);
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
  const [editingParams, setEditingParams] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  /* ── Build tool list from core + connector actions ── */
  const [allTools, setAllTools] = useState<AgentTool[]>(CORE_AGENT_TOOLS);
  useEffect(() => {
    (async () => {
      try {
        const list = await backend.connectorList();
        const sources: ConnectorToolSource[] = [];
        for (const meta of list) {
          const detail = await backend.connectorGet(meta.id);
          if (detail && detail.actions.length > 0) {
            sources.push({ id: detail.metadata.id, name: detail.metadata.name, actions: detail.actions });
          }
        }
        setAllTools(buildAllAgentTools(sources));
      } catch {
        // fallback to core tools only
      }
    })();
  }, [backend]);

  const isEditable = !activeAgent.isDefault;
  const drawerNode = selectedNode ? activeAgent.nodes.find((n: AgentNodeType) => n.id === selectedNode) : null;

  /* ── Callbacks ── */
  const handleSaveNode = useCallback((updated: AgentNodeType) => {
    updateAgent({
      ...activeAgent,
      nodes: activeAgent.nodes.map((n: AgentNodeType) => n.id === updated.id ? updated : n),
    });
  }, [activeAgent, updateAgent]);

  const handleDeleteNode = useCallback((nodeId: string) => {
    updateAgent({
      ...activeAgent,
      nodes: activeAgent.nodes.filter((n: AgentNodeType) => n.id !== nodeId),
      edges: activeAgent.edges.filter((e: AgentEdgeType) => e.source !== nodeId && e.target !== nodeId),
    });
    if (selectedNode === nodeId) setSelectedNode(null);
  }, [activeAgent, updateAgent, selectedNode]);

  const handleSaveTools = useCallback((nodeId: string, enabledTools: AgentTool[]) => {
    updateAgent({
      ...activeAgent,
      nodes: activeAgent.nodes.map((n: AgentNodeType) => {
        if (n.id !== nodeId) return n;
        return { ...n, tools: allTools.map(t => ({ ...t, enabled: enabledTools.some(e => e.id === t.id) })) };
      }),
    });
  }, [activeAgent, updateAgent, allTools]);

  const handleAddNode = useCallback((node: AgentNodeType) => {
    updateAgent({ ...activeAgent, nodes: [...activeAgent.nodes, node] });
    setSelectedNode(node.id);
  }, [activeAgent, updateAgent]);

  const handleSaveParams = useCallback((params: Partial<AgentParameters>) => {
    updateAgent({
      ...activeAgent,
      parameters: Object.keys(params).length > 0 ? params : undefined,
    });
  }, [activeAgent, updateAgent]);

  const modifiedParamsCount = activeAgent.parameters ? Object.keys(activeAgent.parameters).length : 0;

  /* ── ReactFlow node drag handler ── */
  const onNodesChange: OnNodesChange = useCallback((changes) => {
    if (!isEditable) return;
    const posChanges = changes.filter(c => c.type === 'position' && c.position);
    if (posChanges.length === 0) return;
    const updatedNodes = activeAgent.nodes.map((n: AgentNodeType) => {
      const change = posChanges.find(c => c.type === 'position' && c.id === n.id);
      if (change && change.type === 'position' && change.position) {
        return { ...n, position: { x: change.position.x, y: change.position.y } };
      }
      return n;
    });
    if (JSON.stringify(updatedNodes.map(n => n.position)) !== JSON.stringify(activeAgent.nodes.map((n: AgentNodeType) => n.position))) {
      updateAgent({ ...activeAgent, nodes: updatedNodes });
    }
  }, [activeAgent, isEditable, updateAgent]);

  /* ── Memoised ReactFlow data ── */
  const flowNodes = useMemo((): Node<FlowNodeData>[] => activeAgent.nodes.map((n: AgentNodeType) => ({
    id: n.id, type: 'agentNode', position: n.position,
    data: {
      label: n.label, description: n.description, category: n.category,
      icon: n.icon, promptKey: n.promptKey, tools: n.tools,
      enabled: n.enabled, nodeId: n.id,
      maxRetries: n.maxRetries, continueQuestion: n.continueQuestion,
      onSelect: (id: string) => setSelectedNode(id),
    },
  })), [activeAgent]);

  const flowEdges = useMemo((): Edge[] => activeAgent.edges.map((e: AgentEdgeType) => ({
    id: e.id, source: e.source, target: e.target, label: e.label,
    animated: e.animated,
    style: {
      stroke: CATEGORY_COLORS[activeAgent.nodes.find((n: AgentNodeType) => n.id === e.source)?.category || 'output']?.border || '#999',
      strokeWidth: 2, ...(e.label ? { strokeDasharray: '5,5' } : {}),
    },
    labelStyle: { fontSize: 10, fill: '#78909c' },
    labelBgStyle: { fill: '#fafafa', fillOpacity: 0.8 },
  })), [activeAgent]);

  /* ── Agent CRUD helpers ── */
  const handleCreate = async () => {
    if (!newName.trim()) return;
    await createAgent(newName.trim());
    setNewName('');
    setCreating(false);
  };
  const handleStartRename = (id: string, name: string) => { setEditingName(id); setEditNameValue(name); };
  const handleFinishRename = async () => {
    if (editingName && editNameValue.trim()) await renameAgent(editingName, editNameValue.trim());
    setEditingName(null);
  };

  /* ── Active trace for the trace view ── */
  const currentTrace = useMemo(() => {
    const traceId = selectedTraceId ?? traces[traces.length - 1]?.id;
    return traces.find(t => t.id === traceId) ?? null;
  }, [traces, selectedTraceId]);

  /* ══════════════════════════════
     Render
     ══════════════════════════════ */
  return (
    <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden', bgcolor: '#f5f5f5' }}>
      {/* ── Agent List Sidebar ── */}
      <Paper sx={{ width: 230, flexShrink: 0, borderRadius: 0, borderRight: '1px solid #e0e0e0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }} elevation={0}>
        <Box sx={{ px: 1.5, py: 1.25, borderBottom: '1px solid #f0f0f0' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: creating ? 1 : 0 }}>
            <Typography sx={{ fontWeight: 700, fontSize: '0.84rem', display: 'flex', alignItems: 'center', gap: 0.5 }}>
              🤖 Agents
            </Typography>
            <Tooltip title="Create new agent">
              <MuiIconButton size="small" onClick={() => setCreating(!creating)} sx={{ color: '#1976d2' }}>
                <AddIcon fontSize="small" />
              </MuiIconButton>
            </Tooltip>
          </Box>
          <Collapse in={creating}>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <TextField autoFocus value={newName} onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()} placeholder="Agent name…" size="small" fullWidth
                sx={{ '& .MuiInputBase-input': { fontSize: '0.75rem', py: 0.5 } }} />
              <MuiButton variant="contained" size="small" onClick={handleCreate} disabled={!newName.trim()}
                sx={{ textTransform: 'none', fontSize: '0.72rem', minWidth: 'auto', px: 1.5 }}>Create</MuiButton>
            </Box>
          </Collapse>
        </Box>

        <Box sx={{ flex: 1, overflowY: 'auto' }}>
          {agents.map(agent => (
            <Box key={agent.id} onClick={() => setActiveAgentId(agent.id)} sx={{
              px: 1.5, py: 1, cursor: 'pointer',
              bgcolor: agent.id === activeAgentId ? '#e3f2fd' : 'transparent',
              borderLeft: agent.id === activeAgentId ? '3px solid #1976d2' : '3px solid transparent',
              '&:hover': { bgcolor: agent.id === activeAgentId ? '#e3f2fd' : '#f5f5f5' },
              transition: 'all 0.15s',
            }}>
              {editingName === agent.id ? (
                <TextField autoFocus value={editNameValue} onChange={e => setEditNameValue(e.target.value)}
                  onBlur={handleFinishRename}
                  onKeyDown={e => { if (e.key === 'Enter') handleFinishRename(); if (e.key === 'Escape') setEditingName(null); }}
                  onClick={e => e.stopPropagation()} size="small" fullWidth
                  sx={{ '& .MuiInputBase-input': { fontSize: '0.75rem', py: 0.25 } }} />
              ) : (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography sx={{ fontWeight: agent.id === activeAgentId ? 700 : 500, fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    {agent.isDefault ? <StarIcon sx={{ fontSize: 14, color: '#f9a825' }} /> : <DescriptionIcon sx={{ fontSize: 14, color: '#9e9e9e' }} />}
                    {agent.name}
                  </Typography>
                  {!agent.isDefault && agent.id === activeAgentId && (
                    <Box sx={{ display: 'flex', gap: 0 }}>
                      <MuiIconButton size="small" onClick={e => { e.stopPropagation(); handleStartRename(agent.id, agent.name); }}><EditIcon sx={{ fontSize: 14 }} /></MuiIconButton>
                      <MuiIconButton size="small" onClick={e => { e.stopPropagation(); duplicateAgent(agent.id); }}><ContentCopyIcon sx={{ fontSize: 14 }} /></MuiIconButton>
                      <MuiIconButton size="small" onClick={e => { e.stopPropagation(); setConfirmDeleteId(agent.id); }}>
                        <DeleteIcon sx={{ fontSize: 14, color: '#e53935' }} />
                      </MuiIconButton>
                    </Box>
                  )}
                </Box>
              )}
              {agent.id === activeAgentId && (
                <Typography sx={{ fontSize: '0.63rem', color: '#9e9e9e', mt: 0.25 }}>
                  {agent.nodes.filter((n: AgentNodeType) => n.enabled).length}/{agent.nodes.length} nodes active
                </Typography>
              )}
            </Box>
          ))}
        </Box>
      </Paper>

      {/* ── Main Area ── */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <Paper elevation={0} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1, borderBottom: '1px solid #e0e0e0', borderRadius: 0, flexShrink: 0, flexWrap: 'wrap', gap: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography sx={{ fontSize: '1.1rem' }}>{activeAgent.isDefault ? '⭐' : '📄'}</Typography>
            <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, color: '#1a1a2e' }}>{activeAgent.name}</Typography>
            <Chip label={activeAgent.isDefault ? 'Read Only' : 'Editable'} size="small"
              sx={{ height: 20, fontSize: '0.65rem', fontWeight: 600,
                ...(activeAgent.isDefault ? { bgcolor: '#f5f5f5', color: '#9e9e9e' } : { bgcolor: '#e3f2fd', color: '#1976d2' }) }} />
          </Box>

          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
            {isEditable && view === 'canvas' && (
              <>
                <MuiButton variant="outlined" size="small" startIcon={<AddIcon />} onClick={() => setAddingNode(true)}
                  sx={{ textTransform: 'none', fontSize: '0.72rem', borderColor: '#43a047', color: '#2e7d32', '&:hover': { borderColor: '#2e7d32', bgcolor: '#e8f5e9' } }}>
                  Add Node
                </MuiButton>
                <MuiBadge badgeContent={modifiedParamsCount > 0 ? modifiedParamsCount : undefined} color="warning">
                  <MuiButton variant="outlined" size="small" startIcon={<SettingsIcon />} onClick={() => setEditingParams(true)}
                    sx={{ textTransform: 'none', fontSize: '0.72rem', borderColor: '#8e24aa', color: '#6a1b9a', '&:hover': { borderColor: '#6a1b9a', bgcolor: '#f3e5f5' } }}>
                    Parameters
                  </MuiButton>
                </MuiBadge>
              </>
            )}
            {!isEditable && view === 'canvas' && (
              <MuiButton variant="outlined" size="small" startIcon={<VisibilityIcon />} onClick={() => setEditingParams(true)}
                sx={{ textTransform: 'none', fontSize: '0.72rem' }}>View Parameters</MuiButton>
            )}
            <Box sx={{ mx: 0.5, height: 24, borderLeft: '1px solid #e0e0e0' }} />
            <MuiButton variant={view === 'canvas' ? 'contained' : 'outlined'} size="small"
              startIcon={<BuildIcon sx={{ fontSize: 16 }} />} onClick={() => setView('canvas')}
              sx={{ textTransform: 'none', fontSize: '0.72rem' }}>Pipeline</MuiButton>
            <MuiBadge badgeContent={traces.length > 0 ? traces.length : undefined} color="info">
              <MuiButton variant={view === 'trace' ? 'contained' : 'outlined'} size="small"
                startIcon={<TimelineIcon sx={{ fontSize: 16 }} />} onClick={() => setView('trace')}
                sx={{ textTransform: 'none', fontSize: '0.72rem' }}>Traces</MuiButton>
            </MuiBadge>
          </Box>

          {/* Legend */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {Object.entries(CATEGORY_LABELS).map(([key, lbl]) => {
              const c = CATEGORY_COLORS[key];
              return (
                <Chip key={key} size="small" label={lbl}
                  sx={{ height: 20, fontSize: '0.58rem', fontWeight: 600, color: c.accent, bgcolor: c.bg, border: `1px solid ${c.border}30`,
                    '& .MuiChip-label': { px: 0.75 } }}
                  avatar={<Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: c.border, ml: '4px !important' }} />} />
              );
            })}
          </Box>
        </Paper>

        {/* Canvas or Trace */}
        {view === 'canvas' ? (
          <Box sx={{ flex: 1, minHeight: 0 }}>
            <ReactFlow
              nodes={flowNodes} edges={flowEdges} nodeTypes={nodeTypes}
              fitView fitViewOptions={{ padding: 0.2 }}
              nodesDraggable={isEditable} nodesConnectable={false} elementsSelectable
              proOptions={{ hideAttribution: true }} minZoom={0.3} maxZoom={1.5}
              onNodesChange={onNodesChange}
              onNodeClick={(_, node) => setSelectedNode(node.id)}
              onNodeDoubleClick={(_, node) => setSelectedNode(node.id)}
              onPaneClick={() => setSelectedNode(null)}
            >
              <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#e0e0e0" />
              <Controls showInteractive={false} />
              <MiniMap
                nodeColor={n => {
                  const d = n.data as FlowNodeData;
                  return CATEGORY_COLORS[d.category]?.border || '#999';
                }}
                style={{ borderRadius: 8, border: '1px solid #e0e0e0' }}
              />
            </ReactFlow>
          </Box>
        ) : (
          <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            {traces.length === 0 ? (
              <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9e9e9e' }}>
                <Box sx={{ textAlign: 'center' }}>
                  <TimelineIcon sx={{ fontSize: 48, mb: 1, color: '#bdbdbd' }} />
                  <Typography sx={{ fontSize: '0.88rem', fontWeight: 600 }}>No traces yet</Typography>
                  <Typography sx={{ fontSize: '0.72rem', mt: 0.5, color: '#bdbdbd' }}>Run the agent from the Chat panel to see execution traces here.</Typography>
                </Box>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                {/* Trace selector */}
                <Box sx={{ px: 1.5, py: 1, borderBottom: '1px solid #f0f0f0', bgcolor: '#fafafa', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <FormControl size="small" sx={{ minWidth: 300 }}>
                    <Select
                      value={selectedTraceId ?? traces[traces.length - 1]?.id ?? ''}
                      onChange={e => { setSelectedTraceId(e.target.value); }}
                      sx={{ fontSize: '0.72rem' }}
                    >
                      {traces.map(t => (
                        <MenuItem key={t.id} value={t.id} sx={{ fontSize: '0.72rem' }}>
                          {t.status === 'running' ? '⏳' : t.status === 'success' ? '✓' : '✗'} {t.agentName} — "{t.userRequest.slice(0, 40)}{t.userRequest.length > 40 ? '…' : ''}"
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  {currentTrace && (() => {
                    const sc = currentTrace.steps.filter(s => s.status === 'success').length;
                    const ec = currentTrace.steps.filter(s => s.status === 'error').length;
                    return (
                      <Box sx={{ display: 'flex', gap: 1, fontSize: '0.68rem', color: '#9e9e9e', alignItems: 'center' }}>
                        <Chip label={`${currentTrace.steps.length} steps`} size="small" sx={{ height: 20, fontSize: '0.6rem', fontWeight: 600 }} />
                        <Typography sx={{ color: '#43a047', fontSize: '0.68rem', fontWeight: 600 }}>✓ {sc}</Typography>
                        {ec > 0 && <Typography sx={{ color: '#e53935', fontSize: '0.68rem', fontWeight: 600 }}>✗ {ec}</Typography>}
                        {currentTrace.totalDurationMs != null && (
                          <Typography sx={{ fontSize: '0.68rem', color: '#9e9e9e' }}>{(currentTrace.totalDurationMs / 1000).toFixed(1)}s</Typography>
                        )}
                      </Box>
                    );
                  })()}
                </Box>
                {/* Workflow debug canvas */}
                {currentTrace && (
                  <WorkflowDebugView
                    trace={currentTrace}
                    pipelineNodes={activeAgent.nodes}
                    pipelineEdges={activeAgent.edges}
                  />
                )}
              </Box>
            )}
          </Box>
        )}
      </Box>

      {/* ── Slide-out node parameter drawer ── */}
      {drawerNode && (
        <NodeParameterDrawer
          node={drawerNode}
          isEditable={isEditable}
          onSave={handleSaveNode}
          onDelete={handleDeleteNode}
          onSaveTools={handleSaveTools}
          onClose={() => setSelectedNode(null)}
          allTools={allTools}
        />
      )}

      {/* ── Dialogs ── */}
      <AddNodeDialog
        open={addingNode}
        existingNodes={activeAgent.nodes}
        onAdd={handleAddNode}
        onClose={() => setAddingNode(false)}
        allTools={allTools}
      />

      <ParametersDialog
        open={editingParams}
        parameters={activeAgent.parameters ?? {}}
        isEditable={isEditable}
        onSave={isEditable ? handleSaveParams : () => {}}
        onClose={() => setEditingParams(false)}
      />

      {/* Delete agent confirmation */}
      <ConfirmDialog
        open={confirmDeleteId !== null}
        title={`Delete "${agents.find(a => a.id === confirmDeleteId)?.name}"?`}
        message="This agent and all its nodes will be permanently removed."
        confirmLabel="Delete"
        confirmColor="error"
        onConfirm={() => { if (confirmDeleteId) deleteAgent(confirmDeleteId); setConfirmDeleteId(null); }}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </Box>
  );
}
