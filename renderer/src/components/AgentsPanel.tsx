/**
 * AgentsPanel — n8n-style visual agent builder with:
 *   - Agent list sidebar (create, rename, delete, duplicate)
 *   - Visual pipeline canvas (draggable nodes, editable parameters, tool config)
 *   - Slide-out node parameter editor (n8n-style right drawer)
 *   - Execution trace viewer (real-time step-by-step observability)
 *   - "Continue or Stop" question toggle + max retries per node
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
  Handle,
  Position,
  type NodeProps,
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
import Switch from '@mui/material/Switch';
import Slider from '@mui/material/Slider';
import Chip from '@mui/material/Chip';
import MuiTabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Drawer from '@mui/material/Drawer';
import Tooltip from '@mui/material/Tooltip';
import MuiBadge from '@mui/material/Badge';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import InputLabel from '@mui/material/InputLabel';
import Checkbox from '@mui/material/Checkbox';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import InputAdornment from '@mui/material/InputAdornment';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Collapse from '@mui/material/Collapse';
import Divider from '@mui/material/Divider';

/* MUI Icons */
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CloseIcon from '@mui/icons-material/Close';
import SettingsIcon from '@mui/icons-material/Settings';
import VisibilityIcon from '@mui/icons-material/Visibility';
import TuneIcon from '@mui/icons-material/Tune';
import BuildIcon from '@mui/icons-material/Build';
import TimelineIcon from '@mui/icons-material/Timeline';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import RestoreIcon from '@mui/icons-material/Restore';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import QuestionAnswerIcon from '@mui/icons-material/QuestionAnswer';
import ReplayIcon from '@mui/icons-material/Replay';
import StarIcon from '@mui/icons-material/Star';
import DescriptionIcon from '@mui/icons-material/Description';

import type {
  AgentNode as AgentNodeType,
  AgentTool,
  PhaseCategory,
  TraceStep,
  AgentEdge as AgentEdgeType,
  AgentParameters,
} from '../types/agent.types';
import { CORE_AGENT_TOOLS, buildAllAgentTools, DEFAULT_AGENT_PARAMETERS, resolveAgentParameters } from '../types/agent.types';
import type { ConnectorToolSource } from '../types/agent.types';
import { useAgentExecution } from '../context/AgentExecutionContext';
import { useBackend } from '../context/BackendContext';

/* ─── Constants ─── */
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
  entry: 'Entry Point', classification: 'Classification', research: 'Research',
  planning: 'Planning', execution: 'Execution', verification: 'Verification', output: 'Output',
};

/* ══════════════════════════════════════
   Custom Flow Node (n8n-style card)
   ══════════════════════════════════════ */
interface FlowNodeData extends Record<string, unknown> {
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

function AgentFlowNode({ data, selected }: NodeProps<Node<FlowNodeData>>) {
  const colors = categoryColors[data.category] || categoryColors.output;
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
        <Chip label={categoryLabels[data.category]} size="small"
          sx={{ height: 18, fontSize: '0.6rem', fontWeight: 700, bgcolor: `${colors.accent}14`, color: colors.accent, border: `1px solid ${colors.accent}30` }} />
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
          <Chip label={data.enabled ? 'ON' : 'OFF'} size="small"
            sx={{ height: 18, fontSize: '0.55rem', fontWeight: 700, bgcolor: data.enabled ? '#e8f5e9' : '#ffebee', color: data.enabled ? '#2e7d32' : '#c62828' }} />
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

const nodeTypes: NodeTypes = { agentNode: AgentFlowNode };

/* ══════════════════════════════════════
   Trace Step Row
   ══════════════════════════════════════ */
function TraceStepRow({ step, selected, onSelect }: { step: TraceStep; selected: boolean; onSelect: () => void }) {
  const colors = categoryColors[step.category] || categoryColors.output;
  const statusIcon = step.status === 'running' ? <HourglassEmptyIcon sx={{ fontSize: 16, color: '#f9a825' }} />
    : step.status === 'success' ? <CheckCircleIcon sx={{ fontSize: 16, color: '#43a047' }} />
    : step.status === 'error' ? <ErrorIcon sx={{ fontSize: 16, color: '#e53935' }} />
    : <SkipNextIcon sx={{ fontSize: 16, color: '#9e9e9e' }} />;

  return (
    <Box onClick={onSelect} sx={{
      display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 1,
      cursor: 'pointer',
      bgcolor: selected ? '#e3f2fd' : 'transparent',
      borderLeft: selected ? '3px solid #1976d2' : '3px solid transparent',
      borderBottom: '1px solid #f5f5f5',
      transition: 'all 0.15s',
      '&:hover': { bgcolor: '#f5f5f5' },
    }}>
      {statusIcon}
      <Chip label={step.category} size="small"
        sx={{ height: 18, fontSize: '0.55rem', fontWeight: 700, color: colors.accent, bgcolor: `${colors.accent}12` }} />
      <Typography sx={{ fontWeight: 600, fontSize: '0.73rem', color: '#333', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {step.summary}
      </Typography>
      {step.durationMs != null && (
        <Typography sx={{ fontSize: '0.6rem', color: '#bdbdbd', flexShrink: 0 }}>{step.durationMs}ms</Typography>
      )}
    </Box>
  );
}

/* ══════════════════════════════════════
   n8n Step Detail Panel
   ══════════════════════════════════════ */
function StepDetailPanel({ step }: { step: TraceStep }) {
  const [tab, setTab] = useState(0);
  const colors = categoryColors[step.category] || categoryColors.output;

  const inputEntries: [string, unknown][] = step.input != null
    ? (typeof step.input === 'object' && !Array.isArray(step.input)
      ? Object.entries(step.input as Record<string, unknown>)
      : [['data', step.input]])
    : [];

  const outputEntries: [string, unknown][] = step.output != null
    ? (typeof step.output === 'object' && !Array.isArray(step.output)
      ? Object.entries(step.output as Record<string, unknown>)
      : [['result', step.output]])
    : [];

  const renderDataTable = (entries: [string, unknown][], emptyIcon: string, emptyMsg: string) => {
    if (entries.length === 0) {
      return (
        <Box sx={{ textAlign: 'center', py: 5, color: '#bdbdbd' }}>
          <Typography sx={{ fontSize: '1.5rem', mb: 0.5 }}>{emptyIcon}</Typography>
          <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, color: '#9e9e9e' }}>{emptyMsg}</Typography>
        </Box>
      );
    }
    return (
      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: '0.3fr 1fr', fontSize: '0.68rem', fontWeight: 700, color: '#9e9e9e', px: 1.5, py: 1, bgcolor: '#fafafa', borderBottom: '1px solid #e0e0e0', textTransform: 'uppercase' }}>
          <span>Field</span><span>Value</span>
        </Box>
        {entries.map(([key, val], i) => (
          <Box key={key} sx={{ display: 'grid', gridTemplateColumns: '0.3fr 1fr', px: 1.5, py: 1, fontSize: '0.74rem', borderBottom: i < entries.length - 1 ? '1px solid #f5f5f5' : 'none', alignItems: 'start' }}>
            <Typography sx={{ fontWeight: 600, color: '#616161', fontFamily: 'monospace', fontSize: '0.7rem' }}>{key}</Typography>
            <Box component="pre" sx={{ m: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '0.7rem', color: '#333', fontFamily: 'monospace', maxHeight: 200, overflow: 'auto' }}>
              {typeof val === 'string' ? val : JSON.stringify(val, null, 2)}
            </Box>
          </Box>
        ))}
      </Paper>
    );
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid #e0e0e0', bgcolor: '#fff', display: 'flex', alignItems: 'center', gap: 1.25 }}>
        <Typography sx={{ fontSize: '1.1rem' }}>
          {step.type === 'llm-call' ? '🧠' : step.type === 'file-read' ? '📖' : step.type === 'file-write' ? '💾' : step.type === 'file-search' ? '🔍' : step.type === 'text-search' ? '🔎' : step.type === 'integration-call' ? '🔌' : '⚡'}
        </Typography>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: '#1a1a2e' }}>{step.nodeLabel}</Typography>
          <Typography sx={{ fontSize: '0.68rem', color: '#9e9e9e' }}>{step.summary}</Typography>
        </Box>
        <Chip label={step.category} size="small" sx={{ fontWeight: 700, color: colors.accent, bgcolor: `${colors.accent}12`, textTransform: 'uppercase', fontSize: '0.6rem' }} />
        {step.durationMs != null && (
          <Typography sx={{ fontSize: '0.68rem', color: '#bdbdbd' }}>{step.durationMs}ms</Typography>
        )}
      </Box>

      {/* Tabs */}
      <MuiTabs value={tab} onChange={(_, v) => setTab(v)} sx={{
        borderBottom: '1px solid #e0e0e0', bgcolor: '#fff', minHeight: 36,
        '& .MuiTab-root': { minHeight: 36, fontSize: '0.72rem', textTransform: 'none', py: 0.5 },
        '& .MuiTabs-indicator': { bgcolor: colors.accent },
      }}>
        <Tab label="Parameters" />
        <Tab label={`Input${inputEntries.length ? ` (${inputEntries.length})` : ''}`} />
        <Tab label={`Output${outputEntries.length ? ` (${outputEntries.length})` : ''}`} />
        <Tab label="Settings" />
      </MuiTabs>

      {/* Content */}
      <Box sx={{ flex: 1, overflowY: 'auto', bgcolor: '#fafafa', p: 2 }}>
        {tab === 0 && (
          <Stack spacing={1.5}>
            {step.error && <Alert severity="error" sx={{ fontSize: '0.75rem' }}><strong>Error:</strong> {step.error}</Alert>}
            <Box>
              <Typography variant="overline" sx={{ fontSize: '0.65rem', color: '#9e9e9e' }}>Method</Typography>
              <Paper variant="outlined" sx={{ p: 1, display: 'flex', alignItems: 'center', gap: 1, borderRadius: 2 }}>
                <Chip label={step.type === 'llm-call' ? 'LLM' : step.type.toUpperCase()} size="small"
                  sx={{ fontWeight: 700, fontSize: '0.68rem', fontFamily: 'monospace', bgcolor: step.type === 'llm-call' ? '#e3f2fd' : '#e8f5e9', color: step.type === 'llm-call' ? '#1565c0' : '#2e7d32' }} />
                <Typography sx={{ fontSize: '0.76rem' }}>{step.nodeLabel}</Typography>
              </Paper>
            </Box>
            <Box>
              <Typography variant="overline" sx={{ fontSize: '0.65rem', color: '#9e9e9e' }}>Target</Typography>
              <Chip icon={<AutoFixHighIcon sx={{ fontSize: 14 }} />} label="Defined automatically by the model" size="small"
                sx={{ mb: 0.5, fontSize: '0.68rem', color: '#7c3aed', bgcolor: '#f5f3ff', border: '1px solid #ddd6fe' }} />
              <Paper variant="outlined" sx={{ p: 1, borderRadius: 2 }}>
                <Typography sx={{ fontSize: '0.76rem', fontFamily: 'monospace', color: '#333' }}>
                  {step.type === 'llm-call' ? 'AI Model Endpoint' : step.type === 'file-read' || step.type === 'file-write' ? 'Workspace File System' : 'Tool Invocation'}
                </Typography>
              </Paper>
            </Box>
            {step.chosenFiles && step.chosenFiles.length > 0 && (
              <Box>
                <Typography variant="overline" sx={{ fontSize: '0.65rem', color: '#9e9e9e' }}>Chosen Files ({step.chosenFiles.length})</Typography>
                <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
                  {step.chosenFiles.map((f, i) => (
                    <Box key={i} sx={{ px: 1.5, py: 0.75, fontSize: '0.72rem', borderBottom: i < step.chosenFiles!.length - 1 ? '1px solid #f5f5f5' : 'none', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <DescriptionIcon sx={{ fontSize: 14, color: '#1976d2' }} /> {f}
                    </Box>
                  ))}
                </Paper>
              </Box>
            )}
            {step.tokens && (
              <Box>
                <Typography variant="overline" sx={{ fontSize: '0.65rem', color: '#9e9e9e' }}>Token Usage</Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  {(['prompt', 'completion', 'total'] as const).map(k => (
                    <Paper key={k} variant="outlined" sx={{ flex: 1, textAlign: 'center', p: 1, borderRadius: 2 }}>
                      <Typography sx={{ fontSize: '1rem', fontWeight: 700 }}>{step.tokens![k]}</Typography>
                      <Typography variant="overline" sx={{ fontSize: '0.55rem', color: '#9e9e9e' }}>{k}</Typography>
                    </Paper>
                  ))}
                </Box>
              </Box>
            )}
          </Stack>
        )}
        {tab === 1 && renderDataTable(inputEntries, '→|', 'No input data')}
        {tab === 2 && renderDataTable(outputEntries, '|→', 'No output data')}
        {tab === 3 && (
          <Stack spacing={1.5}>
            <Alert severity="info" sx={{ fontSize: '0.72rem' }}>Execution will continue even if the node fails</Alert>
            {[
              ['Node ID', step.nodeId],
              ['Type', step.type],
              ['Category', step.category],
              ['Timestamp', new Date(step.timestamp).toLocaleString()],
            ].map(([label, val]) => (
              <Box key={label}>
                <Typography variant="overline" sx={{ fontSize: '0.65rem', color: '#9e9e9e' }}>{label}</Typography>
                <Paper variant="outlined" sx={{ p: 1, borderRadius: 2 }}>
                  <Typography sx={{ fontSize: '0.76rem', fontFamily: 'monospace' }}>{val}</Typography>
                </Paper>
              </Box>
            ))}
          </Stack>
        )}
      </Box>
    </Box>
  );
}

/* ══════════════════════════════════════
   n8n-Style Node Parameter Drawer
   ══════════════════════════════════════ */
function NodeParameterDrawer({
  node, isEditable, onSave, onDelete, onSaveTools, onClose, allTools,
}: {
  node: AgentNodeType;
  isEditable: boolean;
  onSave: (updated: AgentNodeType) => void;
  onDelete: (nodeId: string) => void;
  onSaveTools: (nodeId: string, tools: AgentTool[]) => void;
  onClose: () => void;
  allTools: AgentTool[];
}) {
  const [tab, setTab] = useState(0);
  const [label, setLabel] = useState(node.label);
  const [description, setDescription] = useState(node.description);
  const [category, setCategory] = useState<PhaseCategory>(node.category);
  const [icon, setIcon] = useState(node.icon);
  const [promptKey, setPromptKey] = useState(node.promptKey ?? '');
  const [customPrompt, setCustomPrompt] = useState(node.customPrompt ?? '');
  const [enabled, setEnabled] = useState(node.enabled);
  const [maxRetries, setMaxRetries] = useState(node.maxRetries ?? 0);
  const [continueQuestion, setContinueQuestion] = useState(node.continueQuestion ?? false);
  const [continueQuestionPrompt, setContinueQuestionPrompt] = useState(
    node.continueQuestionPrompt ?? 'Based on the results, should we continue to the next step or stop here?'
  );
  const [localTools, setLocalTools] = useState<AgentTool[]>(() =>
    allTools.map(t => {
      const existing = node.tools?.find(e => e.id === t.id);
      return existing ? { ...t, enabled: existing.enabled } : { ...t };
    })
  );
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Sync when node changes
  useEffect(() => {
    setLabel(node.label);
    setDescription(node.description);
    setCategory(node.category);
    setIcon(node.icon);
    setPromptKey(node.promptKey ?? '');
    setCustomPrompt(node.customPrompt ?? '');
    setEnabled(node.enabled);
    setMaxRetries(node.maxRetries ?? 0);
    setContinueQuestion(node.continueQuestion ?? false);
    setContinueQuestionPrompt(node.continueQuestionPrompt ?? 'Based on the results, should we continue to the next step or stop here?');
    setLocalTools(allTools.map(t => {
      const existing = node.tools?.find(e => e.id === t.id);
      return existing ? { ...t, enabled: existing.enabled } : { ...t };
    }));
    setTab(0);
  }, [node.id, allTools]);

  const toggleTool = (toolId: string) => setLocalTools(prev => prev.map(t => t.id === toolId ? { ...t, enabled: !t.enabled } : t));
  const integrations = Array.from(new Set(allTools.map(t => t.integration).filter(Boolean)));
  const colors = categoryColors[node.category] || categoryColors.output;

  const handleSave = () => {
    onSave({
      ...node,
      label, description, category, icon, enabled,
      promptKey: promptKey || undefined,
      customPrompt: customPrompt || undefined,
      maxRetries: maxRetries > 0 ? maxRetries : undefined,
      continueQuestion: continueQuestion || undefined,
      continueQuestionPrompt: continueQuestion ? continueQuestionPrompt : undefined,
    });
    if (node.tools) {
      onSaveTools(node.id, localTools.filter(t => t.enabled));
    }
  };

  return (
    <Drawer anchor="right" open onClose={onClose} PaperProps={{
      sx: { width: 420, display: 'flex', flexDirection: 'column', bgcolor: '#fafafa' },
    }}>
      {/* Header */}
      <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1.5, borderBottom: `3px solid ${colors.border}`, bgcolor: '#fff' }}>
        <Typography sx={{ fontSize: '1.4rem' }}>{icon}</Typography>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontWeight: 700, fontSize: '0.92rem', color: '#1a1a2e' }}>{label || 'Node'}</Typography>
          <Chip label={categoryLabels[category]} size="small"
            sx={{ height: 18, fontSize: '0.6rem', fontWeight: 700, bgcolor: `${colors.accent}14`, color: colors.accent }} />
        </Box>
        <FormControlLabel
          control={<Switch checked={enabled} onChange={(_, v) => setEnabled(v)} disabled={!isEditable} size="small" />}
          label="" sx={{ mr: 0 }}
        />
        <MuiIconButton onClick={onClose} size="small"><CloseIcon fontSize="small" /></MuiIconButton>
      </Box>

      {/* Tabs */}
      <MuiTabs value={tab} onChange={(_, v) => setTab(v)} variant="fullWidth" sx={{
        bgcolor: '#fff', borderBottom: '1px solid #e0e0e0', minHeight: 40,
        '& .MuiTab-root': { minHeight: 40, fontSize: '0.72rem', textTransform: 'none' },
      }}>
        <Tab icon={<TuneIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="Parameters" />
        <Tab icon={<BuildIcon sx={{ fontSize: 16 }} />} iconPosition="start" label={`Tools (${localTools.filter(t => t.enabled).length})`} />
        <Tab icon={<SettingsIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="Settings" />
      </MuiTabs>

      {/* Content */}
      <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
        {/* Parameters Tab */}
        {tab === 0 && (
          <Stack spacing={2}>
            {/* Basic Info */}
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Typography variant="overline" sx={{ fontSize: '0.65rem', color: '#9e9e9e', mb: 1, display: 'block' }}>Basic Info</Typography>
              <Stack spacing={1.5}>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <TextField label="Icon" value={icon} onChange={e => setIcon(e.target.value)} size="small"
                    disabled={!isEditable} sx={{ width: 70 }}
                    inputProps={{ style: { textAlign: 'center', fontSize: '1.2rem' } }} />
                  <TextField label="Label" value={label} onChange={e => setLabel(e.target.value)} size="small"
                    disabled={!isEditable} fullWidth />
                </Box>
                <TextField label="Description" value={description} onChange={e => setDescription(e.target.value)}
                  size="small" disabled={!isEditable} fullWidth multiline rows={2} />
                <FormControl size="small" fullWidth disabled={!isEditable}>
                  <InputLabel>Category</InputLabel>
                  <Select value={category} label="Category" onChange={e => setCategory(e.target.value as PhaseCategory)}>
                    {Object.entries(categoryLabels).map(([k, v]) => (
                      <MenuItem key={k} value={k}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: categoryColors[k]?.border }} />
                          {v}
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Stack>
            </Paper>

            {/* Prompt */}
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Typography variant="overline" sx={{ fontSize: '0.65rem', color: '#9e9e9e', mb: 1, display: 'block' }}>Prompt</Typography>
              <Stack spacing={1.5}>
                <TextField label="Prompt Key" value={promptKey} onChange={e => setPromptKey(e.target.value)}
                  size="small" disabled={!isEditable} fullWidth placeholder="e.g. researchAgentPrompt"
                  InputProps={{ startAdornment: <InputAdornment position="start"><Typography sx={{ fontSize: '0.7rem', color: '#9e9e9e' }}>key:</Typography></InputAdornment> }}
                />
                <TextField label="Custom Prompt Override" value={customPrompt} onChange={e => setCustomPrompt(e.target.value)}
                  size="small" disabled={!isEditable} fullWidth multiline rows={4}
                  placeholder="Leave empty to use default prompt…"
                  sx={{ '& textarea': { fontFamily: 'monospace', fontSize: '0.72rem' } }} />
              </Stack>
            </Paper>

            {/* Continue/Stop Gate */}
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, border: continueQuestion ? '2px solid #7c3aed' : undefined }}>
              <Typography variant="overline" sx={{ fontSize: '0.65rem', color: '#9e9e9e', mb: 1, display: 'block' }}>
                <QuestionAnswerIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                Continue / Stop Gate
              </Typography>
              <FormControlLabel
                control={<Switch checked={continueQuestion} onChange={(_, v) => setContinueQuestion(v)} disabled={!isEditable} size="small"
                  sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: '#7c3aed' }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#7c3aed' } }} />}
                label={<Typography sx={{ fontSize: '0.76rem', fontWeight: 600 }}>Ask model to continue or stop</Typography>}
              />
              <Collapse in={continueQuestion}>
                <Box sx={{ mt: 1.5 }}>
                  <Alert severity="info" sx={{ fontSize: '0.7rem', mb: 1.5 }}>
                    After this node completes, the model decides whether to proceed or stop the pipeline.
                  </Alert>
                  <TextField
                    label="Continue Question Prompt"
                    value={continueQuestionPrompt}
                    onChange={e => setContinueQuestionPrompt(e.target.value)}
                    size="small" disabled={!isEditable} fullWidth multiline rows={3}
                    sx={{ '& textarea': { fontFamily: 'monospace', fontSize: '0.72rem' } }}
                  />
                </Box>
              </Collapse>
            </Paper>

            {/* Max Retries */}
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Typography variant="overline" sx={{ fontSize: '0.65rem', color: '#9e9e9e', mb: 0.5, display: 'block' }}>
                <ReplayIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                Max Retries
              </Typography>
              <Typography sx={{ fontSize: '0.7rem', color: '#78909c', mb: 1 }}>
                Retry this node on failure (0 = no retries)
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 1 }}>
                <Slider value={maxRetries} onChange={(_, v) => setMaxRetries(v as number)}
                  min={0} max={10} step={1} disabled={!isEditable}
                  marks={[{ value: 0, label: '0' }, { value: 3, label: '3' }, { value: 5, label: '5' }, { value: 10, label: '10' }]}
                  valueLabelDisplay="auto" sx={{ flex: 1, color: '#e65100' }} />
                <TextField value={maxRetries} type="number"
                  onChange={e => setMaxRetries(Math.max(0, Math.min(10, parseInt(e.target.value) || 0)))}
                  size="small" disabled={!isEditable} sx={{ width: 65 }}
                  inputProps={{ min: 0, max: 10, style: { textAlign: 'center', fontWeight: 700 } }} />
              </Box>
            </Paper>
          </Stack>
        )}

        {/* Tools Tab */}
        {tab === 1 && (
          <Stack spacing={2}>
            {!node.tools ? (
              <Alert severity="info" sx={{ fontSize: '0.72rem' }}>This node does not use tools.</Alert>
            ) : (
              integrations.map(intg => (
                <Paper key={intg} variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
                  <Box sx={{ px: 1.5, py: 0.75, bgcolor: '#f5f5f5', borderBottom: '1px solid #e0e0e0' }}>
                    <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: '#9e9e9e', textTransform: 'uppercase' }}>{intg}</Typography>
                  </Box>
                  {localTools.filter(t => t.integration === intg).map(tool => (
                    <Box key={tool.id} sx={{
                      display: 'flex', alignItems: 'center', px: 1.5, py: 0.5,
                      borderBottom: '1px solid #f5f5f5', '&:hover': { bgcolor: '#f8f8ff' },
                    }}>
                      <Checkbox checked={tool.enabled} onChange={() => toggleTool(tool.id)} disabled={!isEditable} size="small" />
                      <Typography sx={{ fontSize: '0.9rem', mr: 0.75 }}>{tool.icon}</Typography>
                      <Typography sx={{ fontSize: '0.78rem', flex: 1 }}>{tool.label}</Typography>
                      {tool.enabled && <Chip label="Active" size="small" sx={{ height: 18, fontSize: '0.55rem', bgcolor: '#e8f5e9', color: '#2e7d32' }} />}
                    </Box>
                  ))}
                </Paper>
              ))
            )}
          </Stack>
        )}

        {/* Settings Tab */}
        {tab === 2 && (
          <Stack spacing={2}>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Typography variant="overline" sx={{ fontSize: '0.65rem', color: '#9e9e9e', mb: 1, display: 'block' }}>Node Metadata</Typography>
              {[
                ['Node ID', node.id],
                ['Position', `x: ${node.position.x}, y: ${node.position.y}`],
                ['Inputs', node.inputs?.join(' → ') || 'None'],
                ['Outputs', node.outputs?.join(' → ') || 'None'],
              ].map(([lbl, val]) => (
                <Box key={lbl} sx={{ mb: 1 }}>
                  <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: '#9e9e9e', textTransform: 'uppercase' }}>{lbl}</Typography>
                  <Typography sx={{ fontSize: '0.76rem', fontFamily: 'monospace', color: '#333' }}>{val}</Typography>
                </Box>
              ))}
            </Paper>
            {isEditable && (
              <Box>
                <MuiButton variant="outlined" color="error" startIcon={<DeleteIcon />}
                  onClick={() => setConfirmDelete(true)} fullWidth sx={{ textTransform: 'none' }}>
                  Delete Node
                </MuiButton>
                <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)}>
                  <DialogTitle>Delete "{node.label}"?</DialogTitle>
                  <DialogContent>
                    <Typography sx={{ fontSize: '0.85rem' }}>This will remove the node and all connected edges.</Typography>
                  </DialogContent>
                  <DialogActions>
                    <MuiButton onClick={() => setConfirmDelete(false)}>Cancel</MuiButton>
                    <MuiButton color="error" variant="contained" onClick={() => { onDelete(node.id); onClose(); }}>Delete</MuiButton>
                  </DialogActions>
                </Dialog>
              </Box>
            )}
          </Stack>
        )}
      </Box>

      {/* Footer */}
      <Box sx={{ px: 2, py: 1.5, borderTop: '1px solid #e0e0e0', bgcolor: '#fff', display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
        <MuiButton variant="outlined" size="small" onClick={onClose} sx={{ textTransform: 'none' }}>Cancel</MuiButton>
        {isEditable && (
          <MuiButton variant="contained" size="small" onClick={handleSave} sx={{ textTransform: 'none' }}>Save Changes</MuiButton>
        )}
      </Box>
    </Drawer>
  );
}

/* ══════════════════════════════════════
   Add Node Dialog
   ══════════════════════════════════════ */
function AddNodeDialog({ open, onAdd, onClose, existingNodes, allTools }: {
  open: boolean;
  onAdd: (node: AgentNodeType) => void;
  onClose: () => void;
  existingNodes: AgentNodeType[];
  allTools: AgentTool[];
}) {
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<PhaseCategory>('execution');
  const [icon, setIcon] = useState('⚡');
  const [hasTools, setHasTools] = useState(false);
  const [continueQuestion, setContinueQuestion] = useState(false);
  const [maxRetries, setMaxRetries] = useState(0);

  const handleAdd = () => {
    if (!label.trim()) return;
    const maxY = existingNodes.reduce((max, n) => Math.max(max, n.position.y), 0);
    const newNode: AgentNodeType = {
      id: `node-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      label: label.trim(),
      description: description.trim() || `Custom ${label.trim()} node`,
      category, icon, enabled: true,
      position: { x: 200, y: maxY + 160 },
      tools: hasTools ? allTools.map(t => ({ ...t, enabled: false })) : undefined,
      continueQuestion: continueQuestion || undefined,
      maxRetries: maxRetries > 0 ? maxRetries : undefined,
    };
    onAdd(newNode);
    setLabel(''); setDescription(''); setIcon('⚡'); setCategory('execution'); setHasTools(false); setContinueQuestion(false); setMaxRetries(0);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <AddIcon /> Add New Node
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField label="Icon" value={icon} onChange={e => setIcon(e.target.value)} size="small"
              sx={{ width: 70 }} inputProps={{ style: { textAlign: 'center', fontSize: '1.2rem' } }} />
            <TextField label="Name" value={label} onChange={e => setLabel(e.target.value)} size="small" fullWidth autoFocus />
          </Box>
          <TextField label="Description" value={description} onChange={e => setDescription(e.target.value)}
            size="small" fullWidth multiline rows={2} placeholder="What does this node do?" />
          <FormControl size="small" fullWidth>
            <InputLabel>Category</InputLabel>
            <Select value={category} label="Category" onChange={e => setCategory(e.target.value as PhaseCategory)}>
              {Object.entries(categoryLabels).map(([k, v]) => (
                <MenuItem key={k} value={k}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: categoryColors[k]?.border }} />
                    {v}
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Divider />
          <FormControlLabel
            control={<Checkbox checked={hasTools} onChange={e => setHasTools(e.target.checked)} size="small" />}
            label={<Typography sx={{ fontSize: '0.82rem' }}>Enable tool selection</Typography>}
          />
          <FormControlLabel
            control={<Switch checked={continueQuestion} onChange={(_, v) => setContinueQuestion(v)} size="small"
              sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: '#7c3aed' } }} />}
            label={<Typography sx={{ fontSize: '0.82rem' }}>Ask "continue or stop?" after this node</Typography>}
          />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography sx={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}>Max Retries:</Typography>
            <Slider value={maxRetries} onChange={(_, v) => setMaxRetries(v as number)}
              min={0} max={10} step={1} sx={{ flex: 1 }} valueLabelDisplay="auto" />
            <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', minWidth: 20, textAlign: 'center' }}>{maxRetries}</Typography>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <MuiButton onClick={onClose} sx={{ textTransform: 'none' }}>Cancel</MuiButton>
        <MuiButton variant="contained" onClick={handleAdd} disabled={!label.trim()} sx={{ textTransform: 'none' }}>Add Node</MuiButton>
      </DialogActions>
    </Dialog>
  );
}

/* ══════════════════════════════════════
   Agent Parameters Dialog
   ══════════════════════════════════════ */
const NUMERIC_PARAM_META: { key: keyof AgentParameters; label: string; description: string; min: number; max: number }[] = [
  { key: 'maxResearchFiles', label: 'Max Research Files', description: 'Maximum files the research agent returns', min: 1, max: 30 },
  { key: 'minResearchFiles', label: 'Min Research Files', description: 'Minimum files the research agent should pick', min: 1, max: 20 },
  { key: 'maxMergedContextFiles', label: 'Max Context Files', description: 'Max files after merging research + search', min: 1, max: 50 },
  { key: 'maxTextSearchResults', label: 'Max Search Results', description: 'Max results per text search query', min: 10, max: 500 },
  { key: 'maxTextSearchDisplay', label: 'Max Search Display', description: 'Max search matches shown to model', min: 5, max: 200 },
  { key: 'maxSearchDiscoveredFiles', label: 'Max Search-Discovered Files', description: 'Max extra files from text search', min: 1, max: 20 },
  { key: 'maxSearchQueries', label: 'Max Search Queries', description: 'Max grep queries the search agent issues', min: 1, max: 10 },
  { key: 'maxFilePatterns', label: 'Max File Patterns', description: 'Max file type patterns for search', min: 1, max: 10 },
  { key: 'maxVerificationAttempts', label: 'Max Verification Retries', description: 'Max verification retry attempts', min: 1, max: 10 },
  { key: 'maxActionPlanFiles', label: 'Max Action Plan Files', description: 'Max files in a single action plan', min: 1, max: 30 },
  { key: 'chatHistoryDepth', label: 'Chat History Depth', description: 'Recent messages included as context', min: 2, max: 30 },
  { key: 'maxFileListDisplay', label: 'Max File List Display', description: 'Max workspace files in system prompt', min: 50, max: 2000 },
  { key: 'maxNodeRetries', label: 'Global Max Node Retries', description: 'Default max retries per node', min: 0, max: 10 },
];

const PROMPT_PARAM_META: { key: keyof AgentParameters; label: string; description: string; placeholders: string }[] = [
  { key: 'systemContextPrompt', label: 'System Context', description: 'AI persona & workspace context', placeholders: '{{folderPath}}, {{fileCount}}, {{fileList}}' },
  { key: 'researchAgentPrompt', label: 'Research Agent', description: 'Instructs AI to pick relevant files', placeholders: '{{folderPath}}, {{fileCount}}, {{fileList}}, {{minFiles}}, {{maxFiles}}' },
  { key: 'searchDecisionPrompt', label: 'Search Decision', description: 'Decides if text search is needed', placeholders: '{{folderPath}}, {{fileCount}}, {{maxQueries}}' },
  { key: 'checkAgentPrompt', label: 'Check Agent', description: 'Classifies if request needs file changes', placeholders: '(none)' },
  { key: 'actionPlanPrompt', label: 'Action Planner', description: 'Creates file change action plan', placeholders: '{{fileCount}}, {{fileList}}, {{fileContexts}}, {{maxFiles}}' },
  { key: 'fileChangeCreatePrompt', label: 'File Create', description: 'Instructs AI to create a new file', placeholders: '{{file}}, {{description}}' },
  { key: 'fileChangeUpdatePrompt', label: 'File Update', description: 'SEARCH/REPLACE instructions', placeholders: '{{file}}, {{description}}, {{currentContent}}' },
  { key: 'verificationPrompt', label: 'Verification', description: 'Evaluates if changes satisfy request', placeholders: '{{userRequest}}, {{changeSummary}}' },
  { key: 'continueQuestionPrompt', label: 'Continue Question', description: 'Asked between nodes to decide continue/stop', placeholders: '(none)' },
];

function ParametersDialog({ open, parameters, isEditable, onSave, onClose }: {
  open: boolean;
  parameters: Partial<AgentParameters>;
  isEditable: boolean;
  onSave: (params: Partial<AgentParameters>) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState(0);
  const resolved = resolveAgentParameters(parameters);
  const [localParams, setLocalParams] = useState<AgentParameters>({ ...resolved });
  const [enableContinueQuestion, setEnableContinueQuestion] = useState(resolved.enableContinueQuestion);

  useEffect(() => {
    const r = resolveAgentParameters(parameters);
    setLocalParams({ ...r });
    setEnableContinueQuestion(r.enableContinueQuestion);
  }, [parameters]);

  const setNumericParam = (key: keyof AgentParameters, value: number) =>
    setLocalParams(prev => ({ ...prev, [key]: value }));
  const setPromptParam = (key: keyof AgentParameters, value: string) =>
    setLocalParams(prev => ({ ...prev, [key]: value }));
  const resetParam = (key: keyof AgentParameters) =>
    setLocalParams(prev => ({ ...prev, [key]: DEFAULT_AGENT_PARAMETERS[key] }));
  const isModified = (key: keyof AgentParameters) =>
    localParams[key] !== DEFAULT_AGENT_PARAMETERS[key];

  const handleSave = () => {
    const diff: Partial<AgentParameters> = {};
    for (const key of Object.keys(localParams) as (keyof AgentParameters)[]) {
      if (localParams[key] !== DEFAULT_AGENT_PARAMETERS[key]) {
        (diff as any)[key] = localParams[key];
      }
    }
    diff.enableContinueQuestion = enableContinueQuestion;
    onSave(diff);
    onClose();
  };

  const modifiedCount = Object.keys(localParams).filter(k => isModified(k as keyof AgentParameters)).length;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { height: '85vh' } }}>
      <Box sx={{ px: 2.5, py: 1.5, borderBottom: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', gap: 1.25 }}>
        <SettingsIcon sx={{ color: '#1976d2' }} />
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }}>Agent Parameters</Typography>
          <Typography sx={{ fontSize: '0.68rem', color: '#9e9e9e' }}>Customize limits, prompts, and continue/stop behavior</Typography>
        </Box>
        <MuiIconButton onClick={onClose} size="small"><CloseIcon /></MuiIconButton>
      </Box>

      <MuiTabs value={tab} onChange={(_, v) => setTab(v)} sx={{
        borderBottom: '1px solid #e0e0e0', bgcolor: '#fafafa', minHeight: 40,
        '& .MuiTab-root': { minHeight: 40, fontSize: '0.76rem', textTransform: 'none' },
      }}>
        <Tab label="🔢 Numeric Limits" />
        <Tab label="📝 Prompt Templates" />
        <Tab label="🤔 Continue/Stop" />
      </MuiTabs>

      <DialogContent sx={{ bgcolor: '#fafafa' }}>
        {/* Numeric */}
        {tab === 0 && (
          <Stack spacing={1.5}>
            {NUMERIC_PARAM_META.map(meta => (
              <Paper key={meta.key} variant="outlined" sx={{
                p: 1.5, borderRadius: 2, display: 'flex', alignItems: 'center', gap: 2,
                bgcolor: isModified(meta.key) ? '#fff8e1' : '#fff',
                borderColor: isModified(meta.key) ? '#ffb300' : '#e0e0e0',
              }}>
                <Box sx={{ flex: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Typography sx={{ fontWeight: 600, fontSize: '0.78rem' }}>{meta.label}</Typography>
                    {isModified(meta.key) && <Chip label="MODIFIED" size="small" sx={{ height: 16, fontSize: '0.55rem', bgcolor: '#fff3e0', color: '#e65100', fontWeight: 700 }} />}
                  </Box>
                  <Typography sx={{ fontSize: '0.66rem', color: '#9e9e9e' }}>{meta.description}</Typography>
                </Box>
                <TextField type="number" size="small"
                  value={localParams[meta.key] as number}
                  onChange={e => setNumericParam(meta.key, Math.max(meta.min, Math.min(meta.max, parseInt(e.target.value) || meta.min)))}
                  disabled={!isEditable}
                  inputProps={{ min: meta.min, max: meta.max, style: { textAlign: 'center', fontWeight: 700, fontFamily: 'monospace', width: 50 } }}
                />
                {isModified(meta.key) && (
                  <Tooltip title={`Reset to ${DEFAULT_AGENT_PARAMETERS[meta.key]}`}>
                    <MuiIconButton size="small" onClick={() => resetParam(meta.key)}><RestoreIcon fontSize="small" /></MuiIconButton>
                  </Tooltip>
                )}
              </Paper>
            ))}
          </Stack>
        )}

        {/* Prompts */}
        {tab === 1 && (
          <Stack spacing={2}>
            <Alert severity="info" sx={{ fontSize: '0.72rem' }}>
              Use <code style={{ background: '#e3f2fd', padding: '1px 4px', borderRadius: 3, fontFamily: 'monospace' }}>{'{{placeholder}}'}</code> for dynamic values.
            </Alert>
            {PROMPT_PARAM_META.map(meta => (
              <Paper key={meta.key} variant="outlined" sx={{
                borderRadius: 2, overflow: 'hidden',
                borderColor: isModified(meta.key) ? '#ffb300' : '#e0e0e0',
              }}>
                <Box sx={{ px: 1.5, py: 1, borderBottom: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Typography sx={{ fontWeight: 600, fontSize: '0.78rem' }}>{meta.label}</Typography>
                      {isModified(meta.key) && <Chip label="MODIFIED" size="small" sx={{ height: 16, fontSize: '0.55rem', bgcolor: '#fff3e0', color: '#e65100', fontWeight: 700 }} />}
                    </Box>
                    <Typography sx={{ fontSize: '0.62rem', color: '#9e9e9e' }}>
                      {meta.description} · <code style={{ fontFamily: 'monospace', fontSize: '0.6rem' }}>{meta.placeholders}</code>
                    </Typography>
                  </Box>
                  {isModified(meta.key) && (
                    <MuiButton size="small" startIcon={<RestoreIcon sx={{ fontSize: 14 }} />} onClick={() => resetParam(meta.key)}
                      sx={{ textTransform: 'none', fontSize: '0.68rem' }}>Reset</MuiButton>
                  )}
                </Box>
                <TextField
                  value={localParams[meta.key] as string}
                  onChange={e => setPromptParam(meta.key, e.target.value)}
                  disabled={!isEditable} fullWidth multiline rows={5}
                  sx={{ '& .MuiOutlinedInput-notchedOutline': { border: 'none' }, '& textarea': { fontFamily: 'monospace', fontSize: '0.7rem', lineHeight: 1.6 } }}
                />
              </Paper>
            ))}
          </Stack>
        )}

        {/* Continue/Stop */}
        {tab === 2 && (
          <Stack spacing={2}>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, border: enableContinueQuestion ? '2px solid #7c3aed' : undefined }}>
              <FormControlLabel
                control={<Switch checked={enableContinueQuestion} onChange={(_, v) => setEnableContinueQuestion(v)} disabled={!isEditable} size="small"
                  sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: '#7c3aed' }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#7c3aed' } }} />}
                label={<Typography sx={{ fontWeight: 700, fontSize: '0.88rem' }}>Enable "Continue or Stop?" globally</Typography>}
              />
              <Typography sx={{ fontSize: '0.72rem', color: '#78909c', mt: 0.5, ml: 5.5 }}>
                After each node the model decides whether to continue or stop. Individual nodes can override this.
              </Typography>
            </Paper>
            <Alert severity="info" sx={{ fontSize: '0.72rem' }}>
              The continue question prompt is in the "Prompt Templates" tab under "Continue Question".
            </Alert>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', mb: 1 }}>How it works</Typography>
              <Stack spacing={1}>
                {[
                  'After a node completes, the "continue question" prompt is sent to the model',
                  'The model responds with { shouldContinue: true/false, reason: "..." }',
                  'If shouldContinue is false, the pipeline stops with the reason',
                  'Nodes with their own "Continue/Stop Gate" override the global setting',
                  'Max retries per node controls how many times a failed node retries',
                ].map((text, i) => (
                  <Box key={i} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                    <Chip label={String(i + 1)} size="small" sx={{ height: 20, minWidth: 20, fontSize: '0.65rem', fontWeight: 700, bgcolor: '#ede7f6', color: '#4527a0' }} />
                    <Typography sx={{ fontSize: '0.76rem', color: '#333' }}>{text}</Typography>
                  </Box>
                ))}
              </Stack>
            </Paper>
          </Stack>
        )}
      </DialogContent>

      <Box sx={{ px: 2.5, py: 1.5, borderTop: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: '#fafafa' }}>
        <Typography sx={{ fontSize: '0.68rem', color: '#9e9e9e' }}>{modifiedCount} parameter(s) modified</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <MuiButton variant="outlined" size="small" onClick={onClose} sx={{ textTransform: 'none' }}>Cancel</MuiButton>
          {isEditable && (
            <MuiButton variant="contained" size="small" onClick={handleSave} sx={{ textTransform: 'none' }}>Save Parameters</MuiButton>
          )}
        </Box>
      </Box>
    </Dialog>
  );
}

/* ══════════════════════════════════════
   Main AgentsPanel
   ══════════════════════════════════════ */
type PanelView = 'canvas' | 'trace';

export default function AgentsPanel() {
  const {
    agents, activeAgent, activeAgentId, setActiveAgentId,
    createAgent, updateAgent, deleteAgent, renameAgent, duplicateAgent,
    traces,
  } = useAgentExecution();
  const backend = useBackend();

  const [view, setView] = useState<PanelView>('canvas');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState('');
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [addingNode, setAddingNode] = useState(false);
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
  const [editingParams, setEditingParams] = useState(false);

  // Build tool list dynamically from core tools + registered connector actions
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
  }, [activeAgent, updateAgent]);

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
      stroke: categoryColors[activeAgent.nodes.find((n: AgentNodeType) => n.id === e.source)?.category || 'output']?.border || '#999',
      strokeWidth: 2, ...(e.label ? { strokeDasharray: '5,5' } : {}),
    },
    labelStyle: { fontSize: 10, fill: '#78909c' },
    labelBgStyle: { fill: '#fafafa', fillOpacity: 0.8 },
  })), [activeAgent]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await createAgent(newName.trim());
    setNewName(''); setCreating(false);
  };
  const handleStartRename = (id: string, name: string) => { setEditingName(id); setEditNameValue(name); };
  const handleFinishRename = async () => {
    if (editingName && editNameValue.trim()) await renameAgent(editingName, editNameValue.trim());
    setEditingName(null);
  };

  return (
    <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden', bgcolor: '#f5f5f5' }}>
      {/* Agent List Sidebar */}
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
                      <MuiIconButton size="small" onClick={e => { e.stopPropagation(); if (confirm(`Delete "${agent.name}"?`)) deleteAgent(agent.id); }}><DeleteIcon sx={{ fontSize: 14, color: '#e53935' }} /></MuiIconButton>
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

      {/* Main Area */}
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
            {Object.entries(categoryLabels).map(([key, lbl]) => {
              const c = categoryColors[key];
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
                  return categoryColors[d.category]?.border || '#999';
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
              <>
                {/* Trace list + steps */}
                <Paper elevation={0} sx={{ width: 300, flexShrink: 0, borderRight: '1px solid #e0e0e0', borderRadius: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <Box sx={{ px: 1.5, py: 1, borderBottom: '1px solid #f0f0f0', bgcolor: '#fafafa' }}>
                    <FormControl size="small" fullWidth>
                      <Select
                        value={selectedTraceId ?? traces[traces.length - 1]?.id ?? ''}
                        onChange={e => { setSelectedTraceId(e.target.value); setSelectedStepId(null); }}
                        sx={{ fontSize: '0.72rem' }}
                      >
                        {traces.map(t => (
                          <MenuItem key={t.id} value={t.id} sx={{ fontSize: '0.72rem' }}>
                            {t.status === 'running' ? '⏳' : t.status === 'success' ? '✓' : '✗'} {t.agentName} — "{t.userRequest.slice(0, 40)}{t.userRequest.length > 40 ? '…' : ''}"
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Box>

                  <Box sx={{ flex: 1, overflowY: 'auto' }}>
                    {(() => {
                      const currentTrace = traces.find(t => t.id === (selectedTraceId ?? traces[traces.length - 1]?.id));
                      if (!currentTrace) return null;
                      return currentTrace.steps.map(step => (
                        <TraceStepRow key={step.id} step={step} selected={selectedStepId === step.id}
                          onSelect={() => setSelectedStepId(step.id)} />
                      ));
                    })()}
                  </Box>

                  {(() => {
                    const currentTrace = traces.find(t => t.id === (selectedTraceId ?? traces[traces.length - 1]?.id));
                    if (!currentTrace) return null;
                    const sc = currentTrace.steps.filter(s => s.status === 'success').length;
                    const ec = currentTrace.steps.filter(s => s.status === 'error').length;
                    return (
                      <Box sx={{ px: 1.5, py: 1, borderTop: '1px solid #f0f0f0', bgcolor: '#fafafa', display: 'flex', gap: 1.25, fontSize: '0.65rem', color: '#9e9e9e' }}>
                        <span>{currentTrace.steps.length} steps</span>
                        <Typography sx={{ color: '#43a047', fontSize: '0.65rem' }}>✓ {sc}</Typography>
                        {ec > 0 && <Typography sx={{ color: '#e53935', fontSize: '0.65rem' }}>✗ {ec}</Typography>}
                        {currentTrace.totalDurationMs != null && (
                          <Typography sx={{ ml: 'auto', fontSize: '0.65rem', color: '#9e9e9e' }}>{(currentTrace.totalDurationMs / 1000).toFixed(1)}s</Typography>
                        )}
                      </Box>
                    );
                  })()}
                </Paper>

                {/* Step detail */}
                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  {(() => {
                    const currentTrace = traces.find(t => t.id === (selectedTraceId ?? traces[traces.length - 1]?.id));
                    const step = currentTrace?.steps.find(s => s.id === selectedStepId);
                    if (!step) {
                      return (
                        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bdbdbd' }}>
                          <Box sx={{ textAlign: 'center' }}>
                            <Typography sx={{ fontSize: '2.5rem', mb: 1 }}>🖱️</Typography>
                            <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: '#9e9e9e' }}>Select a step</Typography>
                            <Typography sx={{ fontSize: '0.72rem', mt: 0.5 }}>Click a step to view parameters, input, and output.</Typography>
                          </Box>
                        </Box>
                      );
                    }
                    return <StepDetailPanel step={step} />;
                  })()}
                </Box>
              </>
            )}
          </Box>
        )}
      </Box>

      {/* Node Parameter Drawer (n8n style) */}
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

      {/* Add Node Dialog */}
      <AddNodeDialog open={addingNode} existingNodes={activeAgent.nodes} onAdd={handleAddNode} onClose={() => setAddingNode(false)} allTools={allTools} />

      {/* Parameters Dialog */}
      <ParametersDialog
        open={editingParams}
        parameters={activeAgent.parameters ?? {}}
        isEditable={isEditable}
        onSave={isEditable ? handleSaveParams : () => {}}
        onClose={() => setEditingParams(false)}
      />
    </Box>
  );
}
