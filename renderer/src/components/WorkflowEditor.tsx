/**
 * WorkflowEditor — n8n-style visual workflow builder using ReactFlow.
 *
 * Features:
 *  • Drag-and-drop node palette (triggers, actions, LLM, decision, etc.)
 *  • Connector action picker when adding Action nodes
 *  • Decision node with if/switch routing rules
 *  • Execution log panel showing step-by-step run data
 *  • Past runs list with item counts per node
 *  • Real-time step status, item counts, and duration during execution
 *  • Chat Input trigger for interactive workflow execution
 *  • Persist workflows to storage via IPC
 *
 * Sub-components live in ./workflow/ — this file is orchestration only.
 */
import { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  addEdge,
  type Node,
  type Edge,
  type Connection,
  type NodeTypes,
  type OnNodesChange,
  type OnEdgesChange,
  applyNodeChanges,
  applyEdgeChanges,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import TextField from '@mui/material/TextField';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import Autocomplete from '@mui/material/Autocomplete';

import AddIcon from '@mui/icons-material/Add';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import SaveIcon from '@mui/icons-material/Save';
import SendIcon from '@mui/icons-material/Send';
import ChatIcon from '@mui/icons-material/Chat';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import LockIcon from '@mui/icons-material/Lock';
import DashboardIcon from '@mui/icons-material/Dashboard';
import EditIcon from '@mui/icons-material/Edit';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import ListItemIcon from '@mui/material/ListItemIcon';

import { useBackend } from '../context/BackendContext';
import { useWorkspace } from '../context/WorkspaceContext';

import {
  WorkflowNode,
  NodeConfigDrawer,
  NodePaletteDrawer,
  ExecutionsPanel,
  getPaletteForType,
  BUILTIN_TEMPLATES,
  cloneTemplate,
  workflowHasAINode,
  type WfNodeData,
  type EditorWorkflow,
  type RunLog,
  type NodePaletteEntry,
  type WorkflowTemplate,
} from './workflow';

// ─── ReactFlow node type registration ───────────────────────────────────────

const nodeTypes: NodeTypes = {
  workflowNode: WorkflowNode as any,
};

// ─── ID generators ──────────────────────────────────────────────────────────

let nodeIdCounter = 0;
const genNodeId = () => `wfn-${Date.now()}-${++nodeIdCounter}`;
const genEdgeId = () => `wfe-${Date.now()}-${++nodeIdCounter}`;
const genWorkflowId = () => `wf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

// ─── Main Component ─────────────────────────────────────────────────────────

export default function WorkflowEditor() {
  const backend = useBackend();
  const { folderPath, activeTabPath } = useWorkspace();

  // Derive the requested workflow ID from the tab path (e.g. "workflow:builtin:chat")
  const tabWorkflowId = activeTabPath?.startsWith('workflow:')
    ? activeTabPath.replace('workflow:', '') || null
    : null;

  // State
  const [workflows, setWorkflows] = useState<EditorWorkflow[]>([]);
  const [activeWorkflowId, setActiveWorkflowId] = useState<string | null>(null);
  const [nodes, setNodes] = useState<Node<WfNodeData>[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedNode, setSelectedNode] = useState<Node<WfNodeData> | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'editor' | 'executions'>('editor');
  const [runs, setRuns] = useState<RunLog[]>([]);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [executing, setExecuting] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const chatInputRef = useRef<HTMLInputElement>(null);

  const [templateBrowserOpen, setTemplateBrowserOpen] = useState(false);
  const [renamingWorkflow, setRenamingWorkflow] = useState(false);
  const [renameValue, setRenameValue] = useState('');

  const activeWorkflow = workflows.find(w => w.id === activeWorkflowId);

  // Is the active workflow a built-in (read-only)?
  const isBuiltIn = activeWorkflowId?.startsWith('builtin:') ?? false;

  // Check if current workflow has a chat-input trigger
  const hasChatTrigger = useMemo(() =>
    nodes.some(n => n.data.nodeType === 'trigger' && (n.data.config as any)?.triggerType === 'chat-input'),
    [nodes]
  );

  // ── Load workflows on mount (merge built-ins + saved) ──
  useEffect(() => {
    (async () => {
      try {
        const saved = await backend.orchestratorListEditorWorkflows(folderPath || undefined) as EditorWorkflow[];
        // Merge built-in template workflows (if not already overridden by a saved one)
        const builtInWfs = BUILTIN_TEMPLATES.map(t => t.workflow);
        const merged = [
          ...builtInWfs.filter(bw => !saved.some(s => s.id === bw.id)),
          ...saved,
        ];
        setWorkflows(merged);

        // If a specific workflow was requested via tab, open it; otherwise default to first
        const requestedId = tabWorkflowId && tabWorkflowId !== 'new' ? tabWorkflowId : null;
        const target = requestedId
          ? merged.find(w => w.id === requestedId)
          : merged[0];

        if (target) {
          setActiveWorkflowId(target.id);
          setNodes(target.nodes);
          setEdges(target.edges);
        }
      } catch { /* ignore */ }
    })();
  }, [tabWorkflowId]);

  // ── Sync active workflow when tab switches to a different workflow ──
  useEffect(() => {
    if (!tabWorkflowId || tabWorkflowId === 'new' || workflows.length === 0) return;
    if (tabWorkflowId === activeWorkflowId) return;
    const target = workflows.find(w => w.id === tabWorkflowId);
    if (target) {
      setActiveWorkflowId(target.id);
      setNodes(target.nodes);
      setEdges(target.edges);
    }
  }, [tabWorkflowId, workflows]);

  // ── Load runs ──
  useEffect(() => {
    (async () => {
      try {
        const saved = await backend.orchestratorListRuns() as RunLog[];
        setRuns(saved);
      } catch { /* ignore */ }
    })();
  }, []);

  // ── Subscribe to real-time events ──
  useEffect(() => {
    const unsub = backend.onOrchestratorEvent((event: any) => {
      if (event.category !== 'step') return;

      // Live streaming chunk — update liveOutput on the node
      if (event.type === 'chunk') {
        const { stepId, accumulated } = event.data || {};
        if (stepId) {
          setNodes(prev => prev.map(n =>
            n.id === stepId
              ? { ...n, data: { ...n.data, liveOutput: accumulated, outputDismissed: false } }
              : n
          ));
        }
        return;
      }

      // Status updates (started, completed, failed)
      const { stepId, status, itemCount, durationMs, error, output } = event.data || {};
      if (stepId) {
        setNodes(prev => prev.map(n =>
          n.id === stepId
            ? {
                ...n,
                data: {
                  ...n.data,
                  status: status || n.data.status,
                  ...(itemCount != null && { itemCount }),
                  ...(durationMs != null && { durationMs }),
                  ...(error != null && { error }),
                  // Store structured output for the node drawer
                  ...(output != null && { output }),
                  // Populate liveOutput with completed step output for display
                  ...(status === 'completed' && output != null && !n.data.outputDismissed && {
                    liveOutput: typeof output === 'string'
                      ? output
                      : (output as any)?.text || (output as any)?.reply || JSON.stringify(output, null, 2),
                  }),
                },
              }
            : n
        ));
      }
    });
    return unsub;
  }, [backend]);

  // ── Keep selectedNode in sync with nodes array (so drawer sees live updates) ──
  useEffect(() => {
    if (!selectedNode) return;
    const updated = nodes.find(n => n.id === selectedNode.id);
    if (updated && updated.data !== selectedNode.data) {
      setSelectedNode(updated);
    }
  }, [nodes, selectedNode]);

  // ── Node/Edge change handlers ──

  const onNodesChange: OnNodesChange<Node<WfNodeData>> = useCallback((changes) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
  }, []);

  const onEdgesChange: OnEdgesChange = useCallback((changes) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
  }, []);

  const onConnect = useCallback((connection: Connection) => {
    setEdges((eds) => addEdge({ ...connection, id: genEdgeId(), animated: true }, eds));
  }, []);

  const onNodeClick = useCallback((_: any, node: Node<WfNodeData>) => {
    setSelectedNode(node);
    setDrawerOpen(true);
  }, []);

  // ── Workflow CRUD ──

  const createWorkflow = useCallback(async () => {
    const id = genWorkflowId();
    const triggerNode: Node<WfNodeData> = {
      id: genNodeId(),
      type: 'workflowNode',
      position: { x: 100, y: 200 },
      data: {
        label: 'Manual Trigger',
        icon: '⚡',
        nodeType: 'trigger',
        config: { triggerType: 'manual' },
        subtitle: 'manual',
      },
    };

    const wf: EditorWorkflow = {
      id,
      name: `Workflow ${workflows.length + 1}`,
      nodes: [triggerNode],
      edges: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setWorkflows(prev => [...prev, wf]);
    setActiveWorkflowId(id);
    setNodes([triggerNode]);
    setEdges([]);
    await backend.orchestratorSaveEditorWorkflow(wf, folderPath || undefined);
    window.dispatchEvent(new Event('workflow-saved'));
  }, [workflows, backend, folderPath]);

  const saveWorkflow = useCallback(async () => {
    if (!activeWorkflowId || isBuiltIn) return;
    const wf: EditorWorkflow = {
      id: activeWorkflowId,
      name: activeWorkflow?.name || 'Untitled',
      description: activeWorkflow?.description,
      nodes,
      edges,
      createdAt: activeWorkflow?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setWorkflows(prev => prev.map(w => w.id === activeWorkflowId ? wf : w));
    await backend.orchestratorSaveEditorWorkflow(wf, folderPath || undefined);
    window.dispatchEvent(new Event('workflow-saved'));
  }, [activeWorkflowId, activeWorkflow, nodes, edges, backend, isBuiltIn, folderPath]);

  const deleteWorkflow = useCallback(async () => {
    if (!activeWorkflowId || isBuiltIn) return;
    setWorkflows(prev => prev.filter(w => w.id !== activeWorkflowId));
    await backend.orchestratorDeleteEditorWorkflow(activeWorkflowId);
    setActiveWorkflowId(workflows.length > 1 ? workflows.find(w => w.id !== activeWorkflowId)?.id || null : null);
    setNodes([]);
    setEdges([]);
    window.dispatchEvent(new Event('workflow-saved'));
  }, [activeWorkflowId, workflows, backend, isBuiltIn]);

  // ── Rename active workflow ──
  const renameWorkflow = useCallback(async (newName: string) => {
    if (!activeWorkflowId || isBuiltIn || !newName.trim()) return;
    const trimmed = newName.trim();
    setWorkflows(prev => prev.map(w => w.id === activeWorkflowId ? { ...w, name: trimmed, updatedAt: new Date().toISOString() } : w));
    // Persist
    const wf: EditorWorkflow = {
      id: activeWorkflowId,
      name: trimmed,
      description: activeWorkflow?.description,
      nodes,
      edges,
      createdAt: activeWorkflow?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await backend.orchestratorSaveEditorWorkflow(wf, folderPath || undefined);
    window.dispatchEvent(new Event('workflow-saved'));
  }, [activeWorkflowId, activeWorkflow, nodes, edges, backend, isBuiltIn, folderPath]);

  // ── Clone a built-in template into a new editable workflow ──

  const handleCloneTemplate = useCallback(async (template: WorkflowTemplate) => {
    const cloned = cloneTemplate(template);
    setWorkflows(prev => [...prev, cloned]);
    setActiveWorkflowId(cloned.id);
    setNodes(cloned.nodes);
    setEdges(cloned.edges);
    await backend.orchestratorSaveEditorWorkflow(cloned, folderPath || undefined);
    setTemplateBrowserOpen(false);
    window.dispatchEvent(new Event('workflow-saved'));
  }, [backend, folderPath]);

  const handleCloneCurrentBuiltIn = useCallback(async () => {
    if (!isBuiltIn || !activeWorkflowId) return;
    const template = BUILTIN_TEMPLATES.find(t => t.id === activeWorkflowId);
    if (template) await handleCloneTemplate(template);
  }, [isBuiltIn, activeWorkflowId, handleCloneTemplate]);

  // ── Add / Delete / Update nodes ──

  const addNode = useCallback((paletteItem: NodePaletteEntry) => {
    const newNode: Node<WfNodeData> = {
      id: genNodeId(),
      type: 'workflowNode',
      position: { x: 300 + Math.random() * 200, y: 100 + Math.random() * 300 },
      data: {
        label: paletteItem.label,
        icon: paletteItem.icon,
        nodeType: paletteItem.type,
        config: {},
        subtitle: paletteItem.description,
      },
    };
    setNodes(prev => [...prev, newNode]);
    setPaletteOpen(false);
  }, []);

  const deleteNode = useCallback((nodeId: string) => {
    setNodes(prev => prev.filter(n => n.id !== nodeId));
    setEdges(prev => prev.filter(e => e.source !== nodeId && e.target !== nodeId));
    setDrawerOpen(false);
    setSelectedNode(null);
  }, []);

  const updateNodeData = useCallback((nodeId: string, updates: Partial<WfNodeData>) => {
    setNodes(prev => prev.map(n =>
      n.id === nodeId ? { ...n, data: { ...n.data, ...updates } } : n
    ));
    if (selectedNode?.id === nodeId) {
      setSelectedNode(prev => prev ? { ...prev, data: { ...prev.data, ...updates } } : null);
    }
  }, [selectedNode]);

  // ── Runs for current workflow ──
  const workflowRuns = useMemo(() =>
    runs.filter(r => r.workflowId === activeWorkflowId),
    [runs, activeWorkflowId]
  );

  // ── Compute upstream nodes for the selected node (for expression wiring) ──
  const upstreamNodes = useMemo(() => {
    if (!selectedNode) return [];
    const visited = new Set<string>();
    const queue = [selectedNode.id];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      for (const edge of edges) {
        if (edge.target === cur && !visited.has(edge.source)) {
          visited.add(edge.source);
          queue.push(edge.source);
        }
      }
    }
    return nodes
      .filter(n => visited.has(n.id))
      .map(n => ({ id: n.id, label: n.data.label, nodeType: n.data.nodeType }));
  }, [selectedNode, nodes, edges]);

  // ── Execute current workflow ──
  const executeWorkflow = useCallback(async (triggerInput?: unknown) => {
    if (!activeWorkflowId || executing) return;
    setExecuting(true);

    // Reset all node statuses and clear live output bubbles
    setNodes(prev => prev.map(n => ({
      ...n,
      data: {
        ...n.data,
        status: 'pending' as const,
        itemCount: undefined,
        durationMs: undefined,
        error: undefined,
        output: undefined,
        liveOutput: undefined,
        outputDismissed: false,
      },
    })));

    try {
      await saveWorkflow();

      const result = await backend.orchestratorExecuteWorkflow({
        id: activeWorkflowId,
        name: activeWorkflow?.name || 'Untitled',
        nodes,
        edges,
        triggerInput,
        workspacePath: folderPath || undefined,
      });

      if (result.run) {
        const run = result.run as RunLog;
        setRuns(prev => [...prev, run]);
        setActiveRunId(run.id);

        // Update node statuses from run steps
        if (run.steps) {
          setNodes(prev => prev.map(n => {
            const step = run.steps.find((s: any) => s.nodeId === n.id);
            if (step) {
              return {
                ...n,
                data: {
                  ...n.data,
                  status: step.status as any,
                  itemCount: (step as any).itemCount,
                  durationMs: step.durationMs,
                  error: step.error,
                  output: step.output,
                },
              };
            }
            return n;
          }));
        }
      }
    } catch (err) {
      console.error('Workflow execution failed:', err);
      setNodes(prev => prev.map(n => ({
        ...n,
        data: {
          ...n.data,
          status: n.data.status === 'completed' ? 'completed' : 'failed' as const,
        },
      })));
    } finally {
      setExecuting(false);
    }
  }, [activeWorkflowId, activeWorkflow, nodes, edges, executing, saveWorkflow, backend]);

  // ── Handle chat input submission ──
  const handleChatSubmit = useCallback(() => {
    if (!chatInput.trim() || executing) return;
    const input = chatInput.trim();
    setChatInput('');
    executeWorkflow({ message: input, timestamp: new Date().toISOString() });
  }, [chatInput, executing, executeWorkflow]);

  // ── Render ──

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1,
        borderBottom: 1, borderColor: 'divider',
        bgcolor: '#fafbfc',
        backdropFilter: 'blur(8px)',
      }}>
        {/* Workflow name — show inline rename when there's an active workflow */}
        {activeWorkflow ? (
          <>
            {!isBuiltIn ? (
              renamingWorkflow ? (
                <TextField
                  autoFocus
                  size="small"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => { renameWorkflow(renameValue); setRenamingWorkflow(false); }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { renameWorkflow(renameValue); setRenamingWorkflow(false); }
                    if (e.key === 'Escape') setRenamingWorkflow(false);
                  }}
                  sx={{ width: 200, '& .MuiInputBase-input': { fontSize: 14, fontWeight: 700, py: 0.5 } }}
                />
              ) : (
                <Tooltip title="Click to rename">
                  <Typography
                    onClick={() => { setRenameValue(activeWorkflow.name); setRenamingWorkflow(true); }}
                    sx={{
                      fontWeight: 800, fontSize: 15, cursor: 'pointer', color: '#1a1a2e',
                      '&:hover': { color: 'primary.main' },
                      transition: 'color 0.15s',
                      display: 'flex', alignItems: 'center', gap: 0.5,
                    }}
                  >
                    {activeWorkflow.name}
                    <EditIcon sx={{ fontSize: 14, opacity: 0.4 }} />
                  </Typography>
                </Tooltip>
              )
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <LockIcon sx={{ fontSize: 16, color: '#b45309' }} />
                <Typography sx={{ fontWeight: 800, fontSize: 15, color: '#1a1a2e' }}>
                  {activeWorkflow.name}
                </Typography>
                <Chip
                  label="Built-in"
                  size="small"
                  variant="outlined"
                  color="info"
                  sx={{ height: 20, fontSize: 10, fontWeight: 600 }}
                />
                <Tooltip title="Clone as editable workflow">
                  <Button
                    size="small"
                    startIcon={<ContentCopyIcon />}
                    onClick={handleCloneCurrentBuiltIn}
                    variant="outlined"
                    color="info"
                    sx={{ borderRadius: 6, fontSize: 10, textTransform: 'none', height: 26 }}
                  >
                    Clone
                  </Button>
                </Tooltip>
              </Box>
            )}
          </>
        ) : (
          <Typography sx={{ fontWeight: 700, fontSize: 14, color: '#9e9e9e' }}>
            No workflow selected
          </Typography>
        )}

        {/* Workflow switcher — compact dropdown only when multiple workflows exist */}
        {workflows.length > 1 && (
          <FormControl size="small" sx={{ minWidth: 140, ml: 1 }}>
            <Select
              value={activeWorkflowId || ''}
              displayEmpty
              onChange={(e) => {
                const wf = workflows.find(w => w.id === e.target.value);
                if (wf) {
                  setActiveWorkflowId(wf.id);
                  setNodes(wf.nodes);
                  setEdges(wf.edges);
                  setRenamingWorkflow(false);
                }
              }}
              sx={{
                fontSize: 11, height: 28,
                '& .MuiSelect-select': { py: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 },
              }}
              renderValue={() => (
                <Typography sx={{ fontSize: 11, color: '#78909c', fontWeight: 600 }}>
                  Switch workflow
                </Typography>
              )}
            >
              {workflows.map(w => (
                <MenuItem key={w.id} value={w.id} sx={{ fontSize: 12 }}>
                  {w.id.startsWith('builtin:') && <LockIcon sx={{ fontSize: 12, mr: 0.5, opacity: 0.4 }} />}
                  {w.name}
                  {w.id === activeWorkflowId && (
                    <Chip label="active" size="small" sx={{ ml: 0.5, height: 16, fontSize: 9, bgcolor: '#e3f2fd', color: '#1976d2' }} />
                  )}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        <Tooltip title="New Workflow">
          <IconButton size="small" onClick={createWorkflow}><AddIcon /></IconButton>
        </Tooltip>

        <Tooltip title="Browse Templates">
          <IconButton size="small" onClick={() => setTemplateBrowserOpen(true)}><DashboardIcon /></IconButton>
        </Tooltip>

        {activeWorkflowId && !isBuiltIn && (
          <Tooltip title="Delete Workflow">
            <IconButton size="small" color="error" onClick={deleteWorkflow}><DeleteIcon /></IconButton>
          </Tooltip>
        )}

        <Divider orientation="vertical" flexItem />

        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ minHeight: 36 }}>
          <Tab label="Editor" value="editor" sx={{ minHeight: 36, py: 0 }} />
          <Tab
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                Executions
                {runs.length > 0 && (
                  <Chip label={workflowRuns.length} size="small" sx={{ height: 18, fontSize: 10, fontWeight: 700 }} />
                )}
              </Box>
            }
            value="executions"
            sx={{ minHeight: 36, py: 0 }}
          />
        </Tabs>

        <Box sx={{ flex: 1 }} />

        {isBuiltIn ? (
          <Tooltip title="Clone this built-in to edit">
            <Button size="small" startIcon={<ContentCopyIcon />} onClick={handleCloneCurrentBuiltIn} variant="outlined" sx={{ borderRadius: 6 }}>
              Clone to Edit
            </Button>
          </Tooltip>
        ) : (
          <Button size="small" startIcon={<SaveIcon />} onClick={saveWorkflow} variant="outlined" sx={{ borderRadius: 6 }}>
            Save
          </Button>
        )}
        <Button
          size="small"
          startIcon={executing ? <StopIcon /> : <PlayArrowIcon />}
          variant="contained"
          color={executing ? 'warning' : 'success'}
          sx={{ borderRadius: 6, fontWeight: 700 }}
          onClick={() => executeWorkflow()}
          disabled={!activeWorkflowId || executing}
        >
          {executing ? 'Running…' : 'Execute'}
        </Button>
      </Box>

      {/* Progress bar during execution */}
      {executing && <LinearProgress sx={{ height: 3 }} />}

      {activeTab === 'editor' ? (
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
          {/* ReactFlow Canvas */}
          <Box sx={{ flex: 1 }}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={onNodeClick}
              nodeTypes={nodeTypes}
              fitView
              defaultEdgeOptions={{
                animated: true,
                style: { stroke: '#94a3b8', strokeWidth: 2 },
              }}
            >
              <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#e2e8f0" />
              <Controls />
              <MiniMap
                nodeColor={(node: any) => {
                  const palette = getPaletteForType(node.data?.nodeType);
                  return palette?.color || '#94a3b8';
                }}
                maskColor="rgba(0,0,0,0.08)"
              />
            </ReactFlow>
          </Box>

          {/* Add Node FAB */}
          <Tooltip title="Add node">
            <Button
              variant="contained"
              sx={{
                position: 'absolute',
                bottom: hasChatTrigger ? 80 : 24,
                left: '50%',
                transform: 'translateX(-50%)',
                borderRadius: 8,
                minWidth: 120,
                zIndex: 10,
              }}
              startIcon={<AddIcon />}
              onClick={() => setPaletteOpen(true)}
            >
              Add Step
            </Button>
          </Tooltip>

          {/* Chat Input Trigger Bar */}
          {hasChatTrigger && (
            <Paper
              elevation={3}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                px: 2,
                py: 1,
                borderTop: 1,
                borderColor: 'divider',
                bgcolor: '#fff',
              }}
            >
              <ChatIcon sx={{ color: 'primary.main', fontSize: 20 }} />
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, mr: 0.5 }}>
                Chat Input:
              </Typography>
              <TextField
                inputRef={chatInputRef}
                size="small"
                fullWidth
                placeholder="Type a message to trigger the workflow…"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleChatSubmit();
                  }
                }}
                disabled={executing}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 6,
                    bgcolor: '#f8f9fa',
                  },
                }}
              />
              <Tooltip title="Send & Execute">
                <span>
                  <IconButton
                    color="primary"
                    onClick={handleChatSubmit}
                    disabled={!chatInput.trim() || executing}
                    sx={{
                      bgcolor: 'primary.main',
                      color: '#fff',
                      '&:hover': { bgcolor: 'primary.dark' },
                      '&.Mui-disabled': { bgcolor: '#e0e0e0' },
                    }}
                  >
                    <SendIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            </Paper>
          )}

          {/* Node Palette Drawer */}
          <NodePaletteDrawer
            open={paletteOpen}
            onClose={() => setPaletteOpen(false)}
            onAddNode={addNode}
          />

          {/* Node Config Drawer */}
          <NodeConfigDrawer
            open={drawerOpen}
            node={selectedNode}
            onClose={() => setDrawerOpen(false)}
            onUpdateNodeData={updateNodeData}
            onDeleteNode={deleteNode}
            upstreamNodes={upstreamNodes}
          />
        </Box>
      ) : (
        <ExecutionsPanel
          runs={workflowRuns}
          activeRunId={activeRunId}
          onSelectRun={setActiveRunId}
        />
      )}

      {/* ── Read-only banner for built-in workflows ── */}
      {isBuiltIn && activeTab === 'editor' && (
        <Paper
          elevation={2}
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1.5,
            px: 2,
            py: 0.75,
            bgcolor: '#fffbeb',
            borderTop: '2px solid #f59e0b',
          }}
        >
          <LockIcon sx={{ fontSize: 16, color: '#b45309' }} />
          <Typography variant="caption" sx={{ color: '#92400e', fontWeight: 600 }}>
            This is a built-in template (read-only).
          </Typography>
          <Button
            size="small"
            variant="contained"
            startIcon={<ContentCopyIcon />}
            onClick={handleCloneCurrentBuiltIn}
            sx={{
              borderRadius: 6,
              textTransform: 'none',
              fontSize: 11,
              bgcolor: '#f59e0b',
              color: '#fff',
              '&:hover': { bgcolor: '#d97706' },
            }}
          >
            Clone to customize
          </Button>
        </Paper>
      )}

      {/* ── Template Browser Dialog ── */}
      <Dialog
        open={templateBrowserOpen}
        onClose={() => setTemplateBrowserOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <DashboardIcon sx={{ color: 'primary.main' }} />
          Workflow Templates
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Start from a built-in template. Cloned workflows are fully editable and will appear as chat modes if they contain an AI node.
          </Typography>
          <List disablePadding>
            {BUILTIN_TEMPLATES.map(template => (
              <ListItemButton
                key={template.id}
                onClick={() => handleCloneTemplate(template)}
                sx={{
                  borderRadius: 2,
                  mb: 1,
                  border: '1px solid',
                  borderColor: 'divider',
                  '&:hover': { bgcolor: 'action.hover', borderColor: 'primary.main' },
                }}
              >
                <ListItemIcon sx={{ minWidth: 40, fontSize: 24 }}>
                  {template.icon}
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography fontWeight={600}>{template.name}</Typography>
                      {template.chatMode && (
                        <Chip
                          label={`Chat mode: ${template.chatMode}`}
                          size="small"
                          color="primary"
                          variant="outlined"
                          sx={{ height: 20, fontSize: 10 }}
                        />
                      )}
                    </Box>
                  }
                  secondary={template.description}
                />
                <ContentCopyIcon sx={{ color: 'text.secondary', fontSize: 18, ml: 1 }} />
              </ListItemButton>
            ))}
          </List>
        </DialogContent>
      </Dialog>
    </Box>
  );
}
