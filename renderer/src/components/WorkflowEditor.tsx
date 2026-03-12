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
import InputLabel from '@mui/material/InputLabel';
import TextField from '@mui/material/TextField';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';

import AddIcon from '@mui/icons-material/Add';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import SaveIcon from '@mui/icons-material/Save';
import SendIcon from '@mui/icons-material/Send';
import ChatIcon from '@mui/icons-material/Chat';
import DeleteIcon from '@mui/icons-material/Delete';

import { useBackend } from '../context/BackendContext';

import {
  WorkflowNode,
  NodeConfigDrawer,
  NodePaletteDrawer,
  ExecutionsPanel,
  getPaletteForType,
  type WfNodeData,
  type EditorWorkflow,
  type RunLog,
  type NodePaletteEntry,
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

  const activeWorkflow = workflows.find(w => w.id === activeWorkflowId);

  // Check if current workflow has a chat-input trigger
  const hasChatTrigger = useMemo(() =>
    nodes.some(n => n.data.nodeType === 'trigger' && (n.data.config as any)?.triggerType === 'chat-input'),
    [nodes]
  );

  // ── Load workflows on mount ──
  useEffect(() => {
    (async () => {
      try {
        const saved = await backend.orchestratorListEditorWorkflows() as EditorWorkflow[];
        setWorkflows(saved);
        if (saved.length > 0) {
          setActiveWorkflowId(saved[0].id);
          setNodes(saved[0].nodes);
          setEdges(saved[0].edges);
        }
      } catch { /* ignore */ }
    })();
  }, []);

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
      if (event.category === 'step') {
        const { stepId, status, itemCount, durationMs, error } = event.data || {};
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
                  },
                }
              : n
          ));
        }
      }
    });
    return unsub;
  }, [backend]);

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
    await backend.orchestratorSaveEditorWorkflow(wf);
  }, [workflows, backend]);

  const saveWorkflow = useCallback(async () => {
    if (!activeWorkflowId) return;
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
    await backend.orchestratorSaveEditorWorkflow(wf);
  }, [activeWorkflowId, activeWorkflow, nodes, edges, backend]);

  const deleteWorkflow = useCallback(async () => {
    if (!activeWorkflowId) return;
    setWorkflows(prev => prev.filter(w => w.id !== activeWorkflowId));
    await backend.orchestratorDeleteEditorWorkflow(activeWorkflowId);
    setActiveWorkflowId(workflows.length > 1 ? workflows.find(w => w.id !== activeWorkflowId)?.id || null : null);
    setNodes([]);
    setEdges([]);
  }, [activeWorkflowId, workflows, backend]);

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

  // ── Execute current workflow ──
  const executeWorkflow = useCallback(async (triggerInput?: unknown) => {
    if (!activeWorkflowId || executing) return;
    setExecuting(true);

    // Reset all node statuses
    setNodes(prev => prev.map(n => ({
      ...n,
      data: { ...n.data, status: 'pending' as const, itemCount: undefined, durationMs: undefined, error: undefined, output: undefined },
    })));

    try {
      await saveWorkflow();

      const result = await backend.orchestratorExecuteWorkflow({
        id: activeWorkflowId,
        name: activeWorkflow?.name || 'Untitled',
        nodes,
        edges,
        triggerInput,
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
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Workflow</InputLabel>
          <Select
            value={activeWorkflowId || ''}
            label="Workflow"
            onChange={(e) => {
              const wf = workflows.find(w => w.id === e.target.value);
              if (wf) {
                setActiveWorkflowId(wf.id);
                setNodes(wf.nodes);
                setEdges(wf.edges);
              }
            }}
          >
            {workflows.map(w => (
              <MenuItem key={w.id} value={w.id}>{w.name}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <Tooltip title="New Workflow">
          <IconButton size="small" onClick={createWorkflow}><AddIcon /></IconButton>
        </Tooltip>

        {activeWorkflowId && (
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

        <Button size="small" startIcon={<SaveIcon />} onClick={saveWorkflow} variant="outlined" sx={{ borderRadius: 6 }}>
          Save
        </Button>
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
          />
        </Box>
      ) : (
        <ExecutionsPanel
          runs={workflowRuns}
          activeRunId={activeRunId}
          onSelectRun={setActiveRunId}
        />
      )}
    </Box>
  );
}
