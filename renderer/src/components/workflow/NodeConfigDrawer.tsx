/**
 * NodeConfigDrawer — Right-side config panel for a selected workflow node.
 *
 * For "action" nodes it dynamically renders:
 *  1. Connector picker (all registered connectors)
 *  2. Action picker (actions from the selected connector)
 *  3. Input parameter fields (from the action's inputSchema)
 *  4. Execute button → calls connectorExecute → shows output + item count
 *
 * The Output tab now shows:
 *  - Live streaming output while a node is running
 *  - Completed output with structured data view
 *  - Errors with red error boxes (n8n-style)
 *  - Execution logs/details
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import type { Node } from '@xyflow/react';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import Typography from '@mui/material/Typography';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Divider from '@mui/material/Divider';
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Autocomplete from '@mui/material/Autocomplete';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import KeyIcon from '@mui/icons-material/Key';

import Checkbox from '@mui/material/Checkbox';
import ListItemText from '@mui/material/ListItemText';
import ListSubheader from '@mui/material/ListSubheader';

import { useBackend } from '../../context/BackendContext';
import { DataBlock, StatusIcon, countDataItems, formatDuration } from '../shared/ExecutionViewParts';
import type { WfNodeData } from './workflow.types';
import type { ConnectorTriggerDef } from './workflow.constants';

interface UpstreamNode {
  id: string;
  label: string;
  nodeType: string;
}

interface Props {
  open: boolean;
  node: Node<WfNodeData> | null;
  onClose: () => void;
  onUpdateNodeData: (nodeId: string, updates: Partial<WfNodeData>) => void;
  onDeleteNode: (nodeId: string) => void;
  upstreamNodes?: UpstreamNode[];
}

export function NodeConfigDrawer({ open, node, onClose, onUpdateNodeData, onDeleteNode, upstreamNodes = [] }: Props) {
  const backend = useBackend();
  const [execResult, setExecResult] = useState<{ success: boolean; data?: unknown; error?: string; itemCount?: number } | null>(null);
  const [executing, setExecuting] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const outputScrollRef = useRef<HTMLDivElement>(null);

  // Reset output when node changes
  useEffect(() => {
    setExecResult(null);
    setActiveTab(0);
  }, [node?.id]);

  // Auto-scroll output when live output changes
  useEffect(() => {
    if (outputScrollRef.current && node?.data?.liveOutput) {
      outputScrollRef.current.scrollTop = outputScrollRef.current.scrollHeight;
    }
  }, [node?.data?.liveOutput]);

  // Auto-switch to Output tab when node starts running
  useEffect(() => {
    if (node?.data?.status === 'running') {
      setActiveTab(1);
    }
  }, [node?.data?.status]);

  if (!node) return null;

  const cfg = node.data.config as Record<string, unknown>;
  const isRunning = node.data.status === 'running';
  const isFailed = node.data.status === 'failed';
  const isCompleted = node.data.status === 'completed';
  const hasLiveOutput = !!node.data.liveOutput;
  const hasError = !!node.data.error;
  const hasOutput = !!node.data.output;

  // ── Execute the node for real ──
  const handleExecute = async () => {
    setExecuting(true);
    setExecResult(null);
    onUpdateNodeData(node.id, { status: 'running' });

    try {
      let result: { success: boolean; data?: unknown; error?: string };

      if (node.data.nodeType === 'action') {
        const configType = cfg.type as string | undefined;
        const connectorId = cfg.connectorId as string;
        const actionId = cfg.actionId as string;

        // Tool-type sub-nodes (File Tools, Terminal) don't need a connector
        // They are capability declarations for an AI Agent hub node
        if (configType === 'tools' && !connectorId && !actionId) {
          const tools = (cfg.tools as string[]) || [];
          result = {
            success: true,
            data: {
              type: 'tool-definition',
              tools,
              message: `Tool node provides: ${tools.join(', ')}`,
            },
          };
        } else if (configType === 'memory') {
          result = {
            success: true,
            data: {
              type: 'memory-definition',
              memoryType: cfg.memoryType || 'window',
              message: 'Memory node configured',
            },
          };
        } else if (!connectorId || !actionId) {
          setExecResult({ success: false, error: 'Select a connector and action first' });
          onUpdateNodeData(node.id, { status: 'failed' });
          setExecuting(false);
          return;
        } else {
          // Collect params from cfg (everything except connectorId / actionId)
          const params: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(cfg)) {
            if (k !== 'connectorId' && k !== 'actionId' && v !== '' && v != null) {
              params[k] = v;
            }
          }
          result = await backend.connectorExecute(connectorId, actionId, params);
        }
      } else if (node.data.nodeType === 'httpRequest') {
        // Basic HTTP request execution
        const method = (cfg.method as string) || 'GET';
        const url = cfg.url as string;
        if (!url) {
          setExecResult({ success: false, error: 'URL is required' });
          onUpdateNodeData(node.id, { status: 'failed' });
          setExecuting(false);
          return;
        }
        try {
          const res = await fetch(url, { method });
          const data = await res.json().catch(() => res.text());
          result = { success: res.ok, data, error: res.ok ? undefined : `HTTP ${res.status}` };
        } catch (err: any) {
          result = { success: false, error: err.message };
        }
      } else {
        // Fallback: just mark completed for non-executable node types
        result = { success: true, data: { message: `${node.data.nodeType} step completed (simulated)` } };
      }

      // Count items in the result
      let itemCount: number | undefined;
      if (result.data != null) {
        if (Array.isArray(result.data)) {
          itemCount = result.data.length;
        } else if (typeof result.data === 'object') {
          // Look for common array-valued keys
          const obj = result.data as Record<string, unknown>;
          for (const val of Object.values(obj)) {
            if (Array.isArray(val)) {
              itemCount = val.length;
              break;
            }
          }
        }
      }

      setExecResult({ ...result, itemCount });
      onUpdateNodeData(node.id, { status: result.success ? 'completed' : 'failed' });
      if (result.success) setActiveTab(1); // auto-switch to output tab
    } catch (err: any) {
      setExecResult({ success: false, error: err.message });
      onUpdateNodeData(node.id, { status: 'failed' });
    } finally {
      setExecuting(false);
    }
  };

  return (
    <Drawer
      anchor="right"
      open={open && !!node}
      onClose={onClose}
      PaperProps={{ sx: { width: 420, pt: 2 } }}
    >
      <Box sx={{ px: 2, display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography sx={{ fontSize: 24 }}>{node.data.icon}</Typography>
            <Box>
              <Typography variant="subtitle1" fontWeight={700}>{node.data.label}</Typography>
              {node.data.status && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
                  <StatusIcon status={node.data.status} size={14} />
                  <Typography variant="caption" sx={{
                    color: isRunning ? '#3b82f6' : isFailed ? '#ef4444' : isCompleted ? '#22c55e' : '#94a3b8',
                    fontWeight: 600,
                    fontSize: 11,
                    textTransform: 'capitalize',
                  }}>
                    {node.data.status}
                  </Typography>
                  {node.data.durationMs != null && (
                    <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: 10, ml: 0.5 }}>
                      · {formatDuration(node.data.durationMs)}
                    </Typography>
                  )}
                </Box>
              )}
            </Box>
          </Box>
          <IconButton size="small" onClick={onClose}><CloseIcon /></IconButton>
        </Box>

        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          sx={{ minHeight: 32, mb: 2 }}
        >
          <Tab label="Parameters" sx={{ minHeight: 32, py: 0, fontSize: 12 }} />
          <Tab
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                Output
                {isRunning && (
                  <Box sx={{
                    width: 6, height: 6, borderRadius: '50%', bgcolor: '#3b82f6',
                    animation: 'pulse 1.5s infinite',
                    '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.3 } },
                  }} />
                )}
                {execResult?.itemCount != null && (
                  <Chip
                    label={execResult.itemCount}
                    size="small"
                    color={execResult.success ? 'success' : 'error'}
                    sx={{ height: 18, fontSize: '0.65rem' }}
                  />
                )}
                {!execResult && hasError && (
                  <Chip label="!" size="small" color="error" sx={{ height: 18, fontSize: '0.65rem', minWidth: 20 }} />
                )}
              </Box>
            }
            sx={{ minHeight: 32, py: 0, fontSize: 12 }}
          />
        </Tabs>

        <Divider sx={{ mb: 2 }} />

        {/* ── Parameters Tab ── */}
        {activeTab === 0 && (
          <Box sx={{ flex: 1, overflow: 'auto' }}>
            {/* Name */}
            <TextField
              label="Name"
              size="small"
              fullWidth
              value={node.data.label}
              onChange={(e) => onUpdateNodeData(node.id, { label: e.target.value })}
              sx={{ mb: 2 }}
            />

            {/* Type-specific config */}
            <TriggerConfig node={node} cfg={cfg} onUpdate={onUpdateNodeData} />
            <HttpRequestConfig node={node} cfg={cfg} onUpdate={onUpdateNodeData} />
            <LlmConfig node={node} cfg={cfg} onUpdate={onUpdateNodeData} upstreamNodes={upstreamNodes} />
            <DecisionConfig node={node} cfg={cfg} onUpdate={onUpdateNodeData} />
            <ActionConfig node={node} cfg={cfg} onUpdate={onUpdateNodeData} />
            <DeveloperConfig node={node} cfg={cfg} onUpdate={onUpdateNodeData} />
            <CodeRunnerConfig node={node} cfg={cfg} onUpdate={onUpdateNodeData} />
            <SubWorkflowConfig node={node} cfg={cfg} onUpdate={onUpdateNodeData} />
            <BatchProcessorConfig node={node} cfg={cfg} onUpdate={onUpdateNodeData} upstreamNodes={upstreamNodes} />
          </Box>
        )}

        {/* ── Output Tab ── */}
        {activeTab === 1 && (
          <Box ref={outputScrollRef} sx={{ flex: 1, overflow: 'auto' }}>
            {/* ── Live streaming output (while node is running) ── */}
            {isRunning && (
              <Box sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Box sx={{
                    width: 8, height: 8, borderRadius: '50%', bgcolor: '#3b82f6',
                    animation: 'pulse 1.5s infinite',
                    '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.3 } },
                  }} />
                  <Typography variant="caption" sx={{ fontWeight: 700, color: '#3b82f6', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Running…
                  </Typography>
                </Box>
                {hasLiveOutput ? (
                  <Box sx={{
                    bgcolor: '#0f172a',
                    borderRadius: 2,
                    border: '1px solid #1e3a5f',
                    overflow: 'hidden',
                  }}>
                    <Box sx={{
                      display: 'flex', alignItems: 'center', px: 1.5, py: 0.5,
                      bgcolor: '#1e293b', borderBottom: '1px solid #334155',
                    }}>
                      <Typography sx={{ fontSize: 9, fontWeight: 700, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        Live Output
                      </Typography>
                    </Box>
                    <Box sx={{ maxHeight: 300, overflow: 'auto', px: 1.5, py: 1 }}>
                      <Typography
                        component="pre"
                        sx={{
                          fontSize: 11,
                          fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          color: '#e2e8f0',
                          lineHeight: 1.6,
                          m: 0,
                        }}
                      >
                        {String(node.data.liveOutput)}
                        <Box component="span" sx={{
                          display: 'inline-block', width: 7, height: 14, bgcolor: '#3b82f6',
                          ml: 0.25, animation: 'blink 1s step-end infinite', verticalAlign: 'text-bottom',
                          '@keyframes blink': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0 } },
                        }} />
                      </Typography>
                    </Box>
                  </Box>
                ) : (
                  <Box sx={{ py: 3, textAlign: 'center' }}>
                    <CircularProgress size={24} sx={{ mb: 1 }} />
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12 }}>
                      Waiting for output…
                    </Typography>
                  </Box>
                )}
              </Box>
            )}

            {/* ── Error display (n8n-style red error box) ── */}
            {(hasError || (execResult && !execResult.success)) && (
              <Box sx={{
                mb: 2,
                borderRadius: 2,
                border: '1px solid #fca5a5',
                overflow: 'hidden',
                bgcolor: '#fef2f2',
              }}>
                <Box sx={{
                  display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 1,
                  bgcolor: '#fee2e2', borderBottom: '1px solid #fca5a5',
                }}>
                  <Alert severity="error" icon={false} sx={{ p: 0, bgcolor: 'transparent', '& .MuiAlert-message': { p: 0 } }}>
                    <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#991b1b' }}>
                      ⚠ Error
                    </Typography>
                  </Alert>
                </Box>
                <Box sx={{ px: 1.5, py: 1.5 }}>
                  <Typography sx={{
                    fontSize: 12,
                    fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                    color: '#b91c1c',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    lineHeight: 1.6,
                  }}>
                    {node.data.error || execResult?.error || 'Execution failed'}
                  </Typography>
                </Box>
              </Box>
            )}

            {/* ── Completed output (from workflow execution, not manual exec) ── */}
            {!isRunning && !execResult && hasOutput && (
              <>
                <Alert severity="success" sx={{ mb: 1, fontSize: 12 }}>
                  Execution succeeded
                  {node.data.itemCount != null && ` — ${node.data.itemCount} item${node.data.itemCount !== 1 ? 's' : ''}`}
                </Alert>
                <DataBlock
                  label="Output"
                  data={node.data.output}
                  color="#22c55e"
                  maxHeight={400}
                />
              </>
            )}

            {/* ── Completed live output (streaming finished, show final result) ── */}
            {!isRunning && hasLiveOutput && !hasOutput && !execResult && (
              <>
                {isCompleted && (
                  <Alert severity="success" sx={{ mb: 1, fontSize: 12 }}>
                    Step completed
                    {node.data.durationMs != null && ` in ${formatDuration(node.data.durationMs)}`}
                  </Alert>
                )}
                <Box sx={{
                  bgcolor: '#0f172a',
                  borderRadius: 2,
                  border: '1px solid #334155',
                  overflow: 'hidden',
                  mb: 2,
                }}>
                  <Box sx={{
                    display: 'flex', alignItems: 'center', px: 1.5, py: 0.5,
                    bgcolor: '#1e293b', borderBottom: '1px solid #334155',
                  }}>
                    <Typography sx={{ fontSize: 9, fontWeight: 700, color: '#22c55e', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Output
                    </Typography>
                  </Box>
                  <Box sx={{ maxHeight: 400, overflow: 'auto', px: 1.5, py: 1 }}>
                    <Typography
                      component="pre"
                      sx={{
                        fontSize: 11,
                        fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        color: '#e2e8f0',
                        lineHeight: 1.6,
                        m: 0,
                      }}
                    >
                      {String(node.data.liveOutput)}
                    </Typography>
                  </Box>
                </Box>
              </>
            )}

            {/* ── Manual execution result (from "Execute step" button) ── */}
            {execResult && execResult.success && (
              <>
                <Alert severity="success" sx={{ mb: 1, fontSize: 12 }}>
                  Execution succeeded
                  {execResult.itemCount != null && ` — ${execResult.itemCount} item${execResult.itemCount !== 1 ? 's' : ''}`}
                </Alert>

                <DataBlock
                  label="Output"
                  data={execResult.data}
                  color="#22c55e"
                  maxHeight={400}
                />
              </>
            )}

            {/* ── Execution details (duration, item count) ── */}
            {!isRunning && (node.data.durationMs != null || node.data.itemCount != null) && (
              <Box sx={{
                mt: 2, p: 1.5, bgcolor: '#f8fafc', borderRadius: 2,
                border: '1px solid #e2e8f0',
              }}>
                <Typography sx={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, mb: 1 }}>
                  Execution Details
                </Typography>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  {node.data.durationMs != null && (
                    <Box sx={{ textAlign: 'center', flex: 1 }}>
                      <Typography sx={{ fontSize: 16, fontWeight: 800, color: '#334155' }}>
                        {formatDuration(node.data.durationMs)}
                      </Typography>
                      <Typography sx={{ fontSize: 9, color: '#94a3b8', fontWeight: 600 }}>Duration</Typography>
                    </Box>
                  )}
                  {node.data.itemCount != null && (
                    <Box sx={{ textAlign: 'center', flex: 1 }}>
                      <Typography sx={{ fontSize: 16, fontWeight: 800, color: '#334155' }}>
                        {node.data.itemCount}
                      </Typography>
                      <Typography sx={{ fontSize: 9, color: '#94a3b8', fontWeight: 600 }}>Items</Typography>
                    </Box>
                  )}
                </Box>
              </Box>
            )}

            {/* ── No output yet ── */}
            {!isRunning && !execResult && !hasLiveOutput && !hasOutput && !hasError && (
              <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                No output yet. Click "Execute step" to run this node, or execute the full workflow.
              </Typography>
            )}
          </Box>
        )}

        {/* ── Bottom actions ── */}
        <Divider sx={{ mt: 2, mb: 1 }} />

        <Button
          variant="contained"
          size="small"
          startIcon={executing ? <CircularProgress size={14} color="inherit" /> : <PlayArrowIcon />}
          disabled={executing || isRunning}
          sx={{ mb: 1, borderRadius: 6 }}
          onClick={handleExecute}
        >
          {executing || isRunning ? 'Executing…' : 'Execute step'}
        </Button>

        <Button
          variant="outlined"
          color="error"
          size="small"
          startIcon={<DeleteIcon />}
          onClick={() => onDeleteNode(node.id)}
          sx={{ mb: 2 }}
        >
          Delete Node
        </Button>
      </Box>
    </Drawer>
  );
}

// ─── Type-specific config sub-components ─────────────────────────────────────

interface ConfigProps {
  node: Node<WfNodeData>;
  cfg: Record<string, unknown>;
  onUpdate: (nodeId: string, updates: Partial<WfNodeData>) => void;
  upstreamNodes?: UpstreamNode[];
}

function TriggerConfig({ node, cfg, onUpdate }: ConfigProps) {
  const backend = useBackend();
  const [connectorTriggers, setConnectorTriggers] = useState<ConnectorTriggerDef[]>([]);

  // Fetch connector triggers on mount
  useEffect(() => {
    if (node.data.nodeType !== 'trigger') return;
    (async () => {
      try {
        const connectors = await backend.connectorList();
        const triggers: ConnectorTriggerDef[] = [];
        for (const c of connectors) {
          try {
            const detail = await backend.connectorGet(c.id);
            if (detail?.triggers) {
              for (const t of detail.triggers as any[]) {
                triggers.push({
                  connectorId: c.id,
                  connectorName: c.name,
                  connectorIcon: c.icon,
                  triggerId: t.id,
                  triggerName: t.name,
                  triggerDescription: t.description,
                  events: t.events || [],
                  inputFields: t.inputFields || [],
                });
              }
            }
          } catch { /* skip connector */ }
        }
        setConnectorTriggers(triggers);
      } catch { /* ignore */ }
    })();
  }, [backend, node.data.nodeType]);

  if (node.data.nodeType !== 'trigger') return null;

  const triggerType = (cfg.triggerType as string) || 'manual';
  const isConnectorTrigger = triggerType.startsWith('connector:');
  const selectedConnectorTrigger = isConnectorTrigger
    ? connectorTriggers.find(ct => `connector:${ct.connectorId}:${ct.triggerId}` === triggerType)
    : null;
  const selectedEvents = (cfg.events as string[]) || [];

  return (
    <>
      {/* Trigger Type Selector */}
      <FormControl size="small" fullWidth sx={{ mb: 2 }}>
        <InputLabel>Trigger Type</InputLabel>
        <Select
          value={triggerType}
          label="Trigger Type"
          onChange={(e) => {
            const val = e.target.value as string;
            const ct = connectorTriggers.find(ct => `connector:${ct.connectorId}:${ct.triggerId}` === val);
            onUpdate(node.id, {
              config: { triggerType: val, events: [], ...(ct ? { connectorId: ct.connectorId, triggerId: ct.triggerId } : {}) },
              label: ct ? ct.triggerName : node.data.label,
              icon: ct ? getConnectorEmoji(ct.connectorId) : '⚡',
              subtitle: ct ? `${ct.connectorName}: ${ct.triggerDescription}` : val,
            });
          }}
        >
          <ListSubheader>Built-in</ListSubheader>
          <MenuItem value="manual">⚡ Manual</MenuItem>
          <MenuItem value="schedule">🕐 Schedule (Cron)</MenuItem>
          <MenuItem value="webhook">🔗 Webhook</MenuItem>
          <MenuItem value="event">📡 Event</MenuItem>
          <MenuItem value="on-chat">💬 On Chat Message</MenuItem>
          <MenuItem value="on-commit">📝 On Git Commit</MenuItem>
          <MenuItem value="chat-input">🗨️ Chat Input (interactive)</MenuItem>

          {connectorTriggers.length > 0 && <ListSubheader>Connector Triggers</ListSubheader>}
          {connectorTriggers.map(ct => (
            <MenuItem key={`connector:${ct.connectorId}:${ct.triggerId}`} value={`connector:${ct.connectorId}:${ct.triggerId}`}>
              {getConnectorEmoji(ct.connectorId)} {ct.triggerName}
              <Typography variant="caption" sx={{ ml: 1, color: 'text.secondary' }}>
                ({ct.connectorName})
              </Typography>
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* Schedule-specific: cron expression */}
      {triggerType === 'schedule' && (
        <TextField
          label="Cron Expression"
          size="small"
          fullWidth
          value={(cfg.schedule as string) || ''}
          onChange={(e) => onUpdate(node.id, { config: { ...cfg, schedule: e.target.value } })}
          placeholder="*/5 * * * *"
          helperText="e.g. */5 * * * * (every 5 minutes)"
          sx={{ mb: 2 }}
        />
      )}

      {/* Webhook-specific: path */}
      {triggerType === 'webhook' && (
        <TextField
          label="Webhook Path"
          size="small"
          fullWidth
          value={(cfg.webhookPath as string) || ''}
          onChange={(e) => onUpdate(node.id, { config: { ...cfg, webhookPath: e.target.value } })}
          placeholder="/hooks/my-workflow"
          sx={{ mb: 2 }}
        />
      )}

      {/* ── Connector Trigger Config ── */}
      {selectedConnectorTrigger && (
        <>
          <Divider sx={{ mb: 2 }} />
          <Typography variant="caption" fontWeight={700} sx={{ mb: 1, display: 'block', color: 'text.secondary' }}>
            {selectedConnectorTrigger.connectorName} — {selectedConnectorTrigger.triggerName}
          </Typography>

          {/* Input fields (owner, repository, etc.) */}
          {selectedConnectorTrigger.inputFields?.map(field => (
            <TextField
              key={field.key}
              label={`${field.label}${field.required ? ' *' : ''}`}
              size="small"
              fullWidth
              value={(cfg[field.key] as string) || ''}
              onChange={(e) => onUpdate(node.id, {
                config: { ...cfg, [field.key]: e.target.value },
                subtitle: buildTriggerSubtitle(cfg, selectedConnectorTrigger, { ...cfg, [field.key]: e.target.value }),
              })}
              placeholder={field.placeholder || ''}
              helperText={field.helpText}
              sx={{ mb: 1.5 }}
            />
          ))}

          {/* Event multi-select */}
          <FormControl size="small" fullWidth sx={{ mb: 2 }}>
            <InputLabel>Events</InputLabel>
            <Select
              multiple
              value={selectedEvents}
              label="Events"
              onChange={(e) => {
                const val = e.target.value as string[];
                onUpdate(node.id, {
                  config: { ...cfg, events: val },
                  subtitle: buildTriggerSubtitle(cfg, selectedConnectorTrigger, { ...cfg, events: val }),
                });
              }}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {(selected as string[]).map(v => {
                    const ev = selectedConnectorTrigger.events.find(e => e.value === v);
                    return <Chip key={v} label={ev?.label || v} size="small" sx={{ height: 20, fontSize: 10 }} />;
                  })}
                </Box>
              )}
            >
              {selectedConnectorTrigger.events.map(ev => (
                <MenuItem key={ev.value} value={ev.value}>
                  <Checkbox checked={selectedEvents.includes(ev.value)} size="small" />
                  <ListItemText
                    primary={ev.label}
                    secondary={ev.description}
                    primaryTypographyProps={{ variant: 'body2' }}
                    secondaryTypographyProps={{ variant: 'caption' }}
                  />
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </>
      )}
    </>
  );
}

/** Map connector IDs to emoji icons for the trigger selector */
function getConnectorEmoji(connectorId: string): string {
  const map: Record<string, string> = {
    github: '🐙',
    atlassian: '🔷',
    supabase: '⚡',
    gmail: '📧',
    digitalocean: '🌊',
  };
  return map[connectorId] || '🔌';
}

/** Build a subtitle string like "flovia-io/flovia: check_run" */
function buildTriggerSubtitle(
  cfg: Record<string, unknown>,
  ct: ConnectorTriggerDef,
  updated: Record<string, unknown>,
): string {
  const parts: string[] = [];
  const owner = (updated.owner as string) || (cfg.owner as string);
  const repo = (updated.repository as string) || (cfg.repository as string);
  if (owner && repo) parts.push(`${owner}/${repo}`);
  else if (owner) parts.push(owner);

  const events = (updated.events as string[]) || (cfg.events as string[]) || [];
  if (events.length > 0) parts.push(events.join(', '));

  return parts.length > 0 ? `${ct.connectorName}: ${parts.join(': ')}` : ct.triggerDescription;
}

function HttpRequestConfig({ node, cfg, onUpdate }: ConfigProps) {
  if (node.data.nodeType !== 'httpRequest') return null;
  return (
    <>
      <FormControl size="small" fullWidth sx={{ mb: 2 }}>
        <InputLabel>Method</InputLabel>
        <Select
          value={(cfg.method as string) || 'GET'}
          label="Method"
          onChange={(e) => onUpdate(node.id, {
            config: { ...cfg, method: e.target.value },
            subtitle: `${e.target.value}: ${(cfg.url as string) || '...'}`,
          })}
        >
          {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(m => (
            <MenuItem key={m} value={m}>{m}</MenuItem>
          ))}
        </Select>
      </FormControl>
      <TextField
        label="URL"
        size="small"
        fullWidth
        value={(cfg.url as string) || ''}
        onChange={(e) => onUpdate(node.id, {
          config: { ...cfg, url: e.target.value },
          subtitle: `${(cfg.method as string) || 'GET'}: ${e.target.value.slice(0, 40)}...`,
        })}
        sx={{ mb: 2 }}
        placeholder="https://api.example.com/..."
      />
      <FormControl size="small" fullWidth sx={{ mb: 2 }}>
        <InputLabel>Authentication</InputLabel>
        <Select
          value={(cfg.auth as string) || 'none'}
          label="Authentication"
          onChange={(e) => onUpdate(node.id, {
            config: { ...cfg, auth: e.target.value },
          })}
        >
          <MenuItem value="none">None</MenuItem>
          <MenuItem value="predefinedCredentialType">Predefined Credential Type</MenuItem>
          <MenuItem value="bearer">Bearer Token</MenuItem>
          <MenuItem value="basic">Basic Auth</MenuItem>
        </Select>
      </FormControl>
    </>
  );
}

function LlmConfig({ node, cfg, onUpdate, upstreamNodes = [] }: ConfigProps) {
  const backend = useBackend();
  const [savedPrompts, setSavedPrompts] = useState<Record<string, string> | null>(null);

  // Load saved prompts so we can offer them as templates
  useEffect(() => {
    if (node.data.nodeType !== 'llm') return;
    (async () => {
      try {
        const loaded = await backend.promptsLoad();
        setSavedPrompts(loaded as unknown as Record<string, string>);
      } catch { /* ignore */ }
    })();
  }, [backend, node.data.nodeType]);

  if (node.data.nodeType !== 'llm') return null;

  const promptKeys = savedPrompts ? Object.keys(savedPrompts) : [];

  return (
    <>
      {/* Load prompt from saved prompts */}
      {promptKeys.length > 0 && (
        <Autocomplete
          size="small"
          options={promptKeys}
          getOptionLabel={(key) => {
            const labels: Record<string, string> = {
              systemPrompt: 'System Prompt',
              researchAgentPrompt: 'Research Agent',
              checkAgentPrompt: 'Check Agent',
              actionPlannerPrompt: 'Action Planner',
              codeEditorPrompt: 'Code Editor',
              verificationPrompt: 'Verification Agent',
              commitMessagePrompt: 'Commit Message',
            };
            return labels[key] || key;
          }}
          renderInput={(params) => (
            <TextField {...params} label="Load from Saved Prompts" placeholder="Search prompts…" />
          )}
          onChange={(_, key) => {
            if (key && savedPrompts?.[key]) {
              onUpdate(node.id, {
                config: { ...cfg, systemPrompt: savedPrompts[key] },
              });
            }
          }}
          sx={{ mb: 2 }}
          clearOnEscape
        />
      )}

      <TextField
        label="System Message"
        size="small"
        fullWidth
        multiline
        rows={5}
        value={(cfg.systemPrompt as string) || ''}
        onChange={(e) => onUpdate(node.id, {
          config: { ...cfg, systemPrompt: e.target.value },
        })}
        helperText="The base persona / instructions for the AI. You can load from saved prompts above."
        sx={{ mb: 2, '& textarea': { fontFamily: '"JetBrains Mono", monospace', fontSize: 11 } }}
      />
      <TextField
        label="Prompt (User Message)"
        size="small"
        fullWidth
        multiline
        rows={3}
        value={(cfg.prompt as string) || ''}
        onChange={(e) => onUpdate(node.id, {
          config: { ...cfg, prompt: e.target.value },
        })}
        sx={{ mb: 2, '& textarea': { fontFamily: '"JetBrains Mono", monospace', fontSize: 11 } }}
        placeholder="{{input}} or {{nodes.NODE_ID.output}}"
        helperText={
          upstreamNodes.length > 0
            ? `Reference upstream nodes: ${upstreamNodes.map(n => `{{nodes.${n.id}.output}}`).join(', ')}`
            : 'Use {{input}} for the previous node\'s output.'
        }
      />

      <FormControl size="small" fullWidth sx={{ mb: 2 }}>
        <InputLabel>Model</InputLabel>
        <Select
          value={(cfg.model as string) || 'default'}
          label="Model"
          onChange={(e) => onUpdate(node.id, {
            config: { ...cfg, model: e.target.value },
          })}
        >
          <MenuItem value="default">Default (workspace setting)</MenuItem>
          <MenuItem value="gpt-4o">GPT-4o</MenuItem>
          <MenuItem value="gpt-4o-mini">GPT-4o Mini</MenuItem>
          <MenuItem value="claude-3.5-sonnet">Claude 3.5 Sonnet</MenuItem>
          <MenuItem value="claude-3-haiku">Claude 3 Haiku</MenuItem>
          <MenuItem value="gemini-pro">Gemini Pro</MenuItem>
        </Select>
      </FormControl>

      <TextField
        label="Max Iterations"
        size="small"
        type="number"
        fullWidth
        value={(cfg.maxIterations as number) || 10}
        onChange={(e) => onUpdate(node.id, {
          config: { ...cfg, maxIterations: parseInt(e.target.value) },
        })}
        sx={{ mb: 2 }}
      />

      <FormControl size="small" fullWidth sx={{ mb: 2 }}>
        <InputLabel>Streaming</InputLabel>
        <Select
          value={cfg.stream != null ? String(cfg.stream) : 'true'}
          label="Streaming"
          onChange={(e) => onUpdate(node.id, {
            config: { ...cfg, stream: e.target.value === 'true' },
          })}
        >
          <MenuItem value="true">Yes — stream tokens as they arrive</MenuItem>
          <MenuItem value="false">No — wait for complete response</MenuItem>
        </Select>
      </FormControl>
    </>
  );
}

function DecisionConfig({ node, cfg, onUpdate }: ConfigProps) {
  if (node.data.nodeType !== 'decision') return null;
  return (
    <>
      <FormControl size="small" fullWidth sx={{ mb: 2 }}>
        <InputLabel>Mode</InputLabel>
        <Select
          value={(cfg.mode as string) || 'rules'}
          label="Mode"
          onChange={(e) => onUpdate(node.id, {
            config: { ...cfg, mode: e.target.value },
            subtitle: `mode: ${e.target.value}`,
          })}
        >
          <MenuItem value="rules">Rules</MenuItem>
          <MenuItem value="expression">Expression</MenuItem>
        </Select>
      </FormControl>
      <Typography variant="caption" sx={{ mb: 1, color: 'text.secondary' }}>Routing Rules</Typography>
      <TextField
        label="Condition Expression"
        size="small"
        fullWidth
        multiline
        rows={2}
        value={(cfg.condition as string) || ''}
        onChange={(e) => onUpdate(node.id, {
          config: { ...cfg, condition: e.target.value },
        })}
        sx={{ mb: 2 }}
        placeholder={'{{ $json.body.action }}'}
      />
      <Button variant="outlined" size="small" fullWidth sx={{ mb: 2 }}>
        + Add Routing Rule
      </Button>
    </>
  );
}

function ActionConfig({ node, cfg, onUpdate }: ConfigProps) {
  const backend = useBackend();
  const [connectors, setConnectors] = useState<Array<{ id: string; name: string; icon?: string; category?: string }>>([]);
  const [actions, setActions] = useState<Array<{ id: string; name: string; description: string; inputSchema?: Record<string, unknown> }>>([]);
  const [credentialStatus, setCredentialStatus] = useState<{ status: string; error?: string } | null>(null);
  const [configFields, setConfigFields] = useState<Array<{ key: string; label: string; type: string; placeholder?: string; required: boolean; helpText?: string }>>([]);
  const [showCredentialsForm, setShowCredentialsForm] = useState(false);
  const [credentialValues, setCredentialValues] = useState<Record<string, string>>({});
  const [savingCredentials, setSavingCredentials] = useState(false);

  // Fetch all registered connectors on mount
  useEffect(() => {
    if (node.data.nodeType !== 'action') return;
    (async () => {
      try {
        const list = await backend.connectorList();
        setConnectors(list.map((c: any) => ({ id: c.id, name: c.name, icon: c.icon, category: c.category })));
      } catch { /* ignore */ }
    })();
  }, [backend, node.data.nodeType]);

  // Fetch actions + credential status whenever the selected connector changes
  useEffect(() => {
    const connectorId = cfg.connectorId as string;
    if (!connectorId || node.data.nodeType !== 'action') {
      setActions([]);
      setCredentialStatus(null);
      setConfigFields([]);
      return;
    }
    (async () => {
      try {
        const detail = await backend.connectorGet(connectorId);
        if (detail?.actions) setActions(detail.actions);
        else setActions([]);
        if (detail?.configFields) setConfigFields(detail.configFields);
        if (detail?.state) setCredentialStatus(detail.state);

        // Load existing credential values
        const saved = await backend.connectorLoadConfig(connectorId);
        if (saved) setCredentialValues(saved as Record<string, string>);
      } catch {
        setActions([]);
      }
    })();
  }, [backend, cfg.connectorId, node.data.nodeType]);

  if (node.data.nodeType !== 'action') return null;

  // ── Tool-type sub-node (File Tools, Terminal, etc.) — no connector needed ──
  const configType = cfg.type as string | undefined;
  if (configType === 'tools' && !cfg.connectorId && !cfg.actionId) {
    const tools = (cfg.tools as string[]) || [];
    const AVAILABLE_TOOLS = [
      { id: 'file-read', label: '📖 Read Files' },
      { id: 'file-write', label: '💾 Write Files' },
      { id: 'file-search', label: '🔍 Search Files' },
      { id: 'file-tree', label: '🗂️ File Tree' },
      { id: 'terminal', label: '💻 Terminal' },
      { id: 'browser', label: '🌐 Browse URLs' },
    ];

    return (
      <>
        <Alert severity="info" sx={{ mb: 2, fontSize: 11 }}>
          This is a <strong>tool sub-node</strong> — it provides capabilities to the connected AI Agent hub.
          No credentials are needed.
        </Alert>
        <Typography variant="caption" fontWeight={700} sx={{ mb: 1, display: 'block', color: 'text.secondary' }}>
          Enabled Tools
        </Typography>
        <FormControl size="small" fullWidth sx={{ mb: 2 }}>
          <InputLabel>Tools</InputLabel>
          <Select
            multiple
            value={tools}
            label="Tools"
            onChange={(e) => onUpdate(node.id, {
              config: { ...cfg, tools: e.target.value as string[] },
            })}
            renderValue={(selected) => (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {(selected as string[]).map(v => {
                  const tool = AVAILABLE_TOOLS.find(t => t.id === v);
                  return <Chip key={v} label={tool?.label || v} size="small" sx={{ height: 20, fontSize: 10 }} />;
                })}
              </Box>
            )}
          >
            {AVAILABLE_TOOLS.map(tool => (
              <MenuItem key={tool.id} value={tool.id}>
                <Checkbox checked={tools.includes(tool.id)} size="small" />
                <ListItemText primary={tool.label} />
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </>
    );
  }

  // ── Memory-type sub-node ──
  if (configType === 'memory') {
    return (
      <>
        <Alert severity="info" sx={{ mb: 2, fontSize: 11 }}>
          This is a <strong>memory sub-node</strong> — it manages conversation context for the connected AI Agent.
          No credentials are needed.
        </Alert>
        <FormControl size="small" fullWidth sx={{ mb: 2 }}>
          <InputLabel>Memory Type</InputLabel>
          <Select
            value={(cfg.memoryType as string) || 'window'}
            label="Memory Type"
            onChange={(e) => onUpdate(node.id, {
              config: { ...cfg, memoryType: e.target.value },
              subtitle: `${e.target.value} memory`,
            })}
          >
            <MenuItem value="window">Window Buffer</MenuItem>
            <MenuItem value="full">Full History</MenuItem>
            <MenuItem value="summary">Summary</MenuItem>
          </Select>
        </FormControl>
        <TextField
          label="Window Size"
          size="small"
          type="number"
          fullWidth
          value={(cfg.windowSize as number) || 20}
          onChange={(e) => onUpdate(node.id, {
            config: { ...cfg, windowSize: parseInt(e.target.value) || 20 },
          })}
          helperText="Number of recent messages to retain in context"
          sx={{ mb: 2 }}
        />
      </>
    );
  }

  const selectedConnector = connectors.find(c => c.id === (cfg.connectorId as string));
  const selectedAction = actions.find(a => a.id === (cfg.actionId as string));
  const inputSchema = (selectedAction?.inputSchema || {}) as Record<string, {
    type: string; label: string; required?: boolean; placeholder?: string;
  }>;

  const handleSaveCredentials = async () => {
    const connectorId = cfg.connectorId as string;
    if (!connectorId) return;
    setSavingCredentials(true);
    try {
      await backend.connectorSaveConfig(connectorId, credentialValues);
      const testResult = await backend.connectorTest(connectorId, credentialValues);
      setCredentialStatus({ status: testResult.success ? 'connected' : 'error', error: testResult.error });
      if (testResult.success) setShowCredentialsForm(false);
    } catch (err: any) {
      setCredentialStatus({ status: 'error', error: err.message });
    } finally {
      setSavingCredentials(false);
    }
  };

  return (
    <>
      {/* Connector selector — searchable */}
      <Autocomplete
        size="small"
        options={connectors}
        getOptionLabel={(c) => c.name}
        value={selectedConnector || null}
        onChange={(_, c) => {
          onUpdate(node.id, {
            config: { connectorId: c?.id || '', actionId: '' },
            subtitle: c?.name || '',
            icon: c?.id === 'github' ? '🐙' : c?.id === 'atlassian' ? '🔷' : c?.id === 'supabase' ? '⚡' : c?.id === 'gmail' ? '📧' : '🔧',
          });
        }}
        renderInput={(params) => (
          <TextField {...params} label="Connector" placeholder="Search connectors…" />
        )}
        renderOption={(props, c) => (
          <Box component="li" {...props} key={c.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography sx={{ fontSize: 16 }}>
              {c.id === 'github' ? '🐙' : c.id === 'atlassian' ? '🔷' : c.id === 'supabase' ? '⚡' : c.id === 'gmail' ? '📧' : c.id === 'digitalocean' ? '🌊' : '🔌'}
            </Typography>
            <Box>
              <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{c.name}</Typography>
              {c.category && <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>{c.category}</Typography>}
            </Box>
          </Box>
        )}
        sx={{ mb: 2 }}
      />

      {/* Credential status + config */}
      {(cfg.connectorId as string) && (
        <Box sx={{ mb: 2, p: 1.5, borderRadius: 2, border: '1px solid #e0e0e0', bgcolor: '#fafafa' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: showCredentialsForm ? 1.5 : 0 }}>
            <KeyIcon sx={{ fontSize: 16, color: credentialStatus?.status === 'connected' ? '#22c55e' : '#f59e0b' }} />
            <Typography sx={{ fontSize: 12, fontWeight: 600, flex: 1 }}>
              Credentials
            </Typography>
            <Chip
              label={credentialStatus?.status === 'connected' ? 'Connected' : 'Not configured'}
              size="small"
              sx={{
                height: 20, fontSize: 10, fontWeight: 600,
                bgcolor: credentialStatus?.status === 'connected' ? '#dcfce7' : '#fef3c7',
                color: credentialStatus?.status === 'connected' ? '#166534' : '#92400e',
              }}
            />
            <Button
              size="small"
              onClick={() => setShowCredentialsForm(!showCredentialsForm)}
              sx={{ fontSize: 10, textTransform: 'none', minWidth: 'auto' }}
            >
              {showCredentialsForm ? 'Hide' : 'Configure'}
            </Button>
          </Box>
          {credentialStatus?.error && (
            <Alert severity="error" sx={{ fontSize: 11, mb: 1, py: 0 }}>{credentialStatus.error}</Alert>
          )}
          {showCredentialsForm && configFields.length > 0 && (
            <Box>
              {configFields.map(field => (
                <TextField
                  key={field.key}
                  label={field.label}
                  size="small"
                  fullWidth
                  type={field.type === 'password' ? 'password' : 'text'}
                  value={credentialValues[field.key] || ''}
                  onChange={(e) => setCredentialValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                  placeholder={field.placeholder}
                  helperText={field.helpText}
                  required={field.required}
                  sx={{ mb: 1 }}
                />
              ))}
              <Button
                size="small"
                variant="contained"
                onClick={handleSaveCredentials}
                disabled={savingCredentials}
                sx={{ mt: 0.5, borderRadius: 6, fontSize: 11, textTransform: 'none' }}
                startIcon={savingCredentials ? <CircularProgress size={12} color="inherit" /> : <KeyIcon sx={{ fontSize: 14 }} />}
              >
                {savingCredentials ? 'Testing…' : 'Save & Test'}
              </Button>
            </Box>
          )}
        </Box>
      )}

      {/* Action selector — searchable */}
      <Autocomplete
        size="small"
        options={actions}
        getOptionLabel={(a) => a.name}
        value={selectedAction || null}
        onChange={(_, a) => {
          onUpdate(node.id, {
            config: { connectorId: cfg.connectorId, actionId: a?.id || '' },
            subtitle: `${(cfg.connectorId as string) || ''}:${a?.id || ''}`,
          });
        }}
        renderInput={(params) => (
          <TextField {...params} label="Action" placeholder="Search actions…" />
        )}
        renderOption={(props, a) => (
          <Box component="li" {...props} key={a.id}>
            <Box>
              <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{a.name}</Typography>
              <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>{a.description}</Typography>
            </Box>
          </Box>
        )}
        disabled={!cfg.connectorId || actions.length === 0}
        sx={{ mb: 2 }}
      />

      {/* Dynamic input fields from inputSchema */}
      {Object.keys(inputSchema).length > 0 && (
        <>
          <Divider sx={{ mb: 1.5 }} />
          <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ mb: 1, display: 'block' }}>
            Parameters
          </Typography>
          {Object.entries(inputSchema).map(([key, field]) => {
            if (field.type === 'boolean') {
              return (
                <FormControl key={key} size="small" fullWidth sx={{ mb: 1.5 }}>
                  <InputLabel>{field.label}{field.required ? ' *' : ''}</InputLabel>
                  <Select
                    value={cfg[key] != null ? String(cfg[key]) : ''}
                    label={`${field.label}${field.required ? ' *' : ''}`}
                    onChange={(e) => onUpdate(node.id, {
                      config: { ...cfg, [key]: e.target.value === 'true' },
                    })}
                  >
                    <MenuItem value="">—</MenuItem>
                    <MenuItem value="true">Yes</MenuItem>
                    <MenuItem value="false">No</MenuItem>
                  </Select>
                </FormControl>
              );
            }

            return (
              <TextField
                key={key}
                label={`${field.label}${field.required ? ' *' : ''}`}
                size="small"
                fullWidth
                type={field.type === 'number' ? 'number' : 'text'}
                placeholder={field.placeholder || ''}
                value={(cfg[key] as string) ?? ''}
                onChange={(e) => {
                  const val = field.type === 'number' && e.target.value
                    ? Number(e.target.value)
                    : e.target.value;
                  onUpdate(node.id, {
                    config: { ...cfg, [key]: val },
                  });
                }}
                sx={{ mb: 1.5 }}
              />
            );
          })}
        </>
      )}
    </>
  );
}

// ─── Developer Agent Config ─────────────────────────────────────────────────

const DEVELOPER_TOOLS = [
  { id: 'file-read', label: 'Read Files' },
  { id: 'file-write', label: 'Write Files' },
  { id: 'file-search', label: 'Search Files' },
  { id: 'file-tree', label: 'File Tree' },
  { id: 'terminal', label: 'Run Terminal Commands' },
  { id: 'browser', label: 'Browse URLs' },
];

function DeveloperConfig({ node, cfg, onUpdate }: ConfigProps) {
  const backend = useBackend();
  const [savedPrompts, setSavedPrompts] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    if (node.data.nodeType !== 'developer') return;
    (async () => {
      try {
        const loaded = await backend.promptsLoad();
        setSavedPrompts(loaded as unknown as Record<string, string>);
      } catch { /* ignore */ }
    })();
  }, [backend, node.data.nodeType]);

  if (node.data.nodeType !== 'developer') return null;

  const enabledTools = (cfg.tools as string[]) || ['file-read', 'file-write', 'file-search', 'file-tree'];
  const promptKeys = savedPrompts ? Object.keys(savedPrompts) : [];

  return (
    <>
      <FormControl size="small" fullWidth sx={{ mb: 2 }}>
        <InputLabel>Agent Mode</InputLabel>
        <Select
          value={(cfg.agentMode as string) || 'full'}
          label="Agent Mode"
          onChange={(e) => onUpdate(node.id, {
            config: { ...cfg, agentMode: e.target.value },
            subtitle: e.target.value === 'full' ? 'Plan → Edit → Verify' :
                     e.target.value === 'edit-only' ? 'Direct file editing' :
                     'Plan only (no edits)',
          })}
        >
          <MenuItem value="full">Full Agent (Plan → Edit → Verify)</MenuItem>
          <MenuItem value="edit-only">Edit Only (direct file changes)</MenuItem>
          <MenuItem value="plan-only">Plan Only (output plan, no edits)</MenuItem>
        </Select>
      </FormControl>

      <TextField
        label="Max Iterations"
        size="small"
        type="number"
        fullWidth
        value={(cfg.maxIterations as number) || 10}
        onChange={(e) => onUpdate(node.id, {
          config: { ...cfg, maxIterations: parseInt(e.target.value) || 10 },
        })}
        helperText="Maximum edit/verify cycles"
        sx={{ mb: 2 }}
      />

      <Typography variant="caption" fontWeight={700} sx={{ mb: 1, display: 'block', color: 'text.secondary' }}>
        Tools
      </Typography>
      <FormControl size="small" fullWidth sx={{ mb: 2 }}>
        <InputLabel>Enabled Tools</InputLabel>
        <Select
          multiple
          value={enabledTools}
          label="Enabled Tools"
          onChange={(e) => onUpdate(node.id, {
            config: { ...cfg, tools: e.target.value as string[] },
          })}
          renderValue={(selected) => (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {(selected as string[]).map(v => {
                const tool = DEVELOPER_TOOLS.find(t => t.id === v);
                return <Chip key={v} label={tool?.label || v} size="small" sx={{ height: 20, fontSize: 10 }} />;
              })}
            </Box>
          )}
        >
          {DEVELOPER_TOOLS.map(tool => (
            <MenuItem key={tool.id} value={tool.id}>
              <Checkbox checked={enabledTools.includes(tool.id)} size="small" />
              <ListItemText primary={tool.label} />
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl size="small" fullWidth sx={{ mb: 1.5 }}>
        <InputLabel>Plan Before Editing</InputLabel>
        <Select
          value={cfg.planFirst != null ? String(cfg.planFirst) : 'true'}
          label="Plan Before Editing"
          onChange={(e) => onUpdate(node.id, {
            config: { ...cfg, planFirst: e.target.value === 'true' },
          })}
        >
          <MenuItem value="true">Yes — create action plan first</MenuItem>
          <MenuItem value="false">No — edit files directly</MenuItem>
        </Select>
      </FormControl>

      <FormControl size="small" fullWidth sx={{ mb: 2 }}>
        <InputLabel>Verify After Changes</InputLabel>
        <Select
          value={cfg.verify != null ? String(cfg.verify) : 'true'}
          label="Verify After Changes"
          onChange={(e) => onUpdate(node.id, {
            config: { ...cfg, verify: e.target.value === 'true' },
          })}
        >
          <MenuItem value="true">Yes — verify changes satisfy the request</MenuItem>
          <MenuItem value="false">No — skip verification</MenuItem>
        </Select>
      </FormControl>

      {/* System Prompt with saved prompt loader */}
      {promptKeys.length > 0 && (
        <Autocomplete
          size="small"
          options={promptKeys}
          getOptionLabel={(key) => {
            const labels: Record<string, string> = {
              systemPrompt: 'System Prompt', researchAgentPrompt: 'Research Agent',
              checkAgentPrompt: 'Check Agent', actionPlannerPrompt: 'Action Planner',
              codeEditorPrompt: 'Code Editor', verificationPrompt: 'Verification',
              commitMessagePrompt: 'Commit Message',
            };
            return labels[key] || key;
          }}
          renderInput={(params) => (
            <TextField {...params} label="Load Prompt Template" placeholder="Search prompts…" />
          )}
          onChange={(_, key) => {
            if (key && savedPrompts?.[key]) {
              onUpdate(node.id, {
                config: { ...cfg, systemPrompt: savedPrompts[key] },
              });
            }
          }}
          sx={{ mb: 1.5 }}
          clearOnEscape
        />
      )}

      <TextField
        label="System Prompt Override"
        size="small"
        fullWidth
        multiline
        rows={4}
        value={(cfg.systemPrompt as string) || ''}
        onChange={(e) => onUpdate(node.id, {
          config: { ...cfg, systemPrompt: e.target.value },
        })}
        placeholder="(optional) Custom system prompt for this agent"
        helperText="Load from saved prompts above, or write a custom prompt."
        sx={{ mb: 2, '& textarea': { fontFamily: '"JetBrains Mono", monospace', fontSize: 11 } }}
      />
    </>
  );
}

// ─── Code Runner Config ───────────────────────────────────────────────────────

function CodeRunnerConfig({ node, cfg, onUpdate }: ConfigProps) {
  if (node.data.nodeType !== 'codeRunner') return null;
  return (
    <>
      <FormControl size="small" fullWidth sx={{ mb: 2 }}>
        <InputLabel>Language</InputLabel>
        <Select
          value={(cfg.language as string) || 'shell'}
          label="Language"
          onChange={(e) => onUpdate(node.id, {
            config: { ...cfg, language: e.target.value },
            subtitle: e.target.value,
          })}
        >
          <MenuItem value="shell">Shell (sh)</MenuItem>
          <MenuItem value="javascript">JavaScript (Node.js)</MenuItem>
          <MenuItem value="python">Python 3</MenuItem>
        </Select>
      </FormControl>

      <TextField
        label="Code"
        size="small"
        fullWidth
        multiline
        rows={8}
        value={(cfg.code as string) || ''}
        onChange={(e) => onUpdate(node.id, { config: { ...cfg, code: e.target.value } })}
        placeholder={
          (cfg.language as string) === 'javascript'
            ? 'console.log("hello from workflow");'
            : (cfg.language as string) === 'python'
            ? 'print("hello from workflow")'
            : 'echo "hello from workflow"'
        }
        helperText="Live output streams to the node bubble during execution."
        sx={{ mb: 2, '& textarea': { fontFamily: '"JetBrains Mono", monospace', fontSize: 11 } }}
      />

      <TextField
        label="Working Directory (optional)"
        size="small"
        fullWidth
        value={(cfg.cwd as string) || ''}
        onChange={(e) => onUpdate(node.id, { config: { ...cfg, cwd: e.target.value } })}
        placeholder="/workspace or leave blank for workspace root"
        sx={{ mb: 2 }}
      />

      <TextField
        label="Timeout (ms)"
        size="small"
        type="number"
        fullWidth
        value={(cfg.timeout as number) || 30000}
        onChange={(e) => onUpdate(node.id, { config: { ...cfg, timeout: parseInt(e.target.value) || 30000 } })}
        sx={{ mb: 2 }}
      />
    </>
  );
}

// ─── Sub-Workflow Config ──────────────────────────────────────────────────────

function SubWorkflowConfig({ node, cfg, onUpdate }: ConfigProps) {
  const backend = useBackend();
  const [workflows, setWorkflows] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    if (node.data.nodeType !== 'subWorkflow') return;
    (async () => {
      try {
        const all = await backend.orchestratorListEditorWorkflows() as Array<{ id: string; name?: string }>;
        setWorkflows(all.filter(w => !w.id.startsWith('builtin:')).map(w => ({ id: w.id, name: w.name || w.id })));
      } catch { /* ignore */ }
    })();
  }, [backend, node.data.nodeType]);

  if (node.data.nodeType !== 'subWorkflow') return null;

  const selected = workflows.find(w => w.id === (cfg.workflowId as string));

  return (
    <>
      <Autocomplete
        size="small"
        options={workflows}
        getOptionLabel={(w) => w.name}
        value={selected || null}
        onChange={(_, w) => onUpdate(node.id, {
          config: { ...cfg, workflowId: w?.id || '' },
          subtitle: w?.name || '',
        })}
        renderInput={(params) => (
          <TextField {...params} label="Workflow" placeholder="Select a saved workflow…" />
        )}
        sx={{ mb: 2 }}
      />

      <TextField
        label="Trigger Input (optional)"
        size="small"
        fullWidth
        value={(cfg.triggerInput as string) || ''}
        onChange={(e) => onUpdate(node.id, { config: { ...cfg, triggerInput: e.target.value } })}
        placeholder="{{input}} or {{nodes.NODE_ID.output}}"
        helperText="Expression passed as the sub-workflow's trigger input. Defaults to the current node's input."
        sx={{ mb: 2 }}
      />
    </>
  );
}

// ─── Batch Processor Config ───────────────────────────────────────────────────

function BatchProcessorConfig({ node, cfg, onUpdate, upstreamNodes = [] }: ConfigProps) {
  if (node.data.nodeType !== 'batchProcessor') return null;
  return (
    <>
      <TextField
        label="Prompt per Item"
        size="small"
        fullWidth
        multiline
        rows={4}
        value={(cfg.prompt as string) || ''}
        onChange={(e) => onUpdate(node.id, { config: { ...cfg, prompt: e.target.value } })}
        placeholder="Summarize the following item:\n\n{{item}}"
        helperText={
          upstreamNodes.length > 0
            ? `Use {{item}} for each array element, {{index}} for position. Upstream: ${upstreamNodes.map(n => n.label).join(', ')}`
            : 'Use {{item}} for each array element, {{index}} for its position.'
        }
        sx={{ mb: 2, '& textarea': { fontFamily: '"JetBrains Mono", monospace', fontSize: 11 } }}
      />

      <TextField
        label="System Prompt (optional)"
        size="small"
        fullWidth
        multiline
        rows={2}
        value={(cfg.systemPrompt as string) || ''}
        onChange={(e) => onUpdate(node.id, { config: { ...cfg, systemPrompt: e.target.value } })}
        sx={{ mb: 2 }}
      />

      <TextField
        label="Concurrency"
        size="small"
        type="number"
        fullWidth
        value={(cfg.concurrency as number) || 3}
        onChange={(e) => onUpdate(node.id, { config: { ...cfg, concurrency: Math.max(1, Math.min(10, parseInt(e.target.value) || 3)) } })}
        helperText="How many items to process in parallel (1–10)"
        sx={{ mb: 2 }}
      />

      <TextField
        label="Input Array Path (optional)"
        size="small"
        fullWidth
        value={(cfg.inputPath as string) || ''}
        onChange={(e) => onUpdate(node.id, { config: { ...cfg, inputPath: e.target.value } })}
        placeholder="results or data.items"
        helperText="Dot-path to extract the array from input. Leave blank to use root array."
        sx={{ mb: 2 }}
      />
    </>
  );
}