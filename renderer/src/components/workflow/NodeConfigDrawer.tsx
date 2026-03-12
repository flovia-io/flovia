/**
 * NodeConfigDrawer — Right-side config panel for a selected workflow node.
 *
 * For "action" nodes it dynamically renders:
 *  1. Connector picker (all registered connectors)
 *  2. Action picker (actions from the selected connector)
 *  3. Input parameter fields (from the action's inputSchema)
 *  4. Execute button → calls connectorExecute → shows output + item count
 */
import { useState, useEffect, useCallback } from 'react';
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
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';

import { useBackend } from '../../context/BackendContext';
import type { WfNodeData } from './workflow.types';

interface Props {
  open: boolean;
  node: Node<WfNodeData> | null;
  onClose: () => void;
  onUpdateNodeData: (nodeId: string, updates: Partial<WfNodeData>) => void;
  onDeleteNode: (nodeId: string) => void;
}

export function NodeConfigDrawer({ open, node, onClose, onUpdateNodeData, onDeleteNode }: Props) {
  const backend = useBackend();
  const [execResult, setExecResult] = useState<{ success: boolean; data?: unknown; error?: string; itemCount?: number } | null>(null);
  const [executing, setExecuting] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  // Reset output when node changes
  useEffect(() => {
    setExecResult(null);
    setActiveTab(0);
  }, [node?.id]);

  if (!node) return null;

  const cfg = node.data.config as Record<string, unknown>;

  // ── Execute the node for real ──
  const handleExecute = async () => {
    setExecuting(true);
    setExecResult(null);
    onUpdateNodeData(node.id, { status: 'running' });

    try {
      let result: { success: boolean; data?: unknown; error?: string };

      if (node.data.nodeType === 'action') {
        const connectorId = cfg.connectorId as string;
        const actionId = cfg.actionId as string;
        if (!connectorId || !actionId) {
          setExecResult({ success: false, error: 'Select a connector and action first' });
          onUpdateNodeData(node.id, { status: 'failed' });
          setExecuting(false);
          return;
        }
        // Collect params from cfg (everything except connectorId / actionId)
        const params: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(cfg)) {
          if (k !== 'connectorId' && k !== 'actionId' && v !== '' && v != null) {
            params[k] = v;
          }
        }
        result = await backend.connectorExecute(connectorId, actionId, params);
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
            <Typography variant="subtitle1" fontWeight={700}>{node.data.label}</Typography>
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
                {execResult?.itemCount != null && (
                  <Chip
                    label={execResult.itemCount}
                    size="small"
                    color={execResult.success ? 'success' : 'error'}
                    sx={{ height: 18, fontSize: '0.65rem' }}
                  />
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
            <LlmConfig node={node} cfg={cfg} onUpdate={onUpdateNodeData} />
            <DecisionConfig node={node} cfg={cfg} onUpdate={onUpdateNodeData} />
            <ActionConfig node={node} cfg={cfg} onUpdate={onUpdateNodeData} />
          </Box>
        )}

        {/* ── Output Tab ── */}
        {activeTab === 1 && (
          <Box sx={{ flex: 1, overflow: 'auto' }}>
            {!execResult && (
              <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                No output yet. Click "Execute step" to run this node.
              </Typography>
            )}

            {execResult && !execResult.success && (
              <Alert severity="error" sx={{ mb: 2, fontSize: 12 }}>
                {execResult.error || 'Execution failed'}
              </Alert>
            )}

            {execResult && execResult.success && (
              <>
                <Alert severity="success" sx={{ mb: 1, fontSize: 12 }}>
                  Execution succeeded
                  {execResult.itemCount != null && ` — ${execResult.itemCount} item${execResult.itemCount !== 1 ? 's' : ''}`}
                </Alert>

                <Box
                  sx={{
                    mt: 1,
                    p: 1.5,
                    bgcolor: '#f5f5f5',
                    borderRadius: 1,
                    fontFamily: 'monospace',
                    fontSize: 11,
                    lineHeight: 1.5,
                    overflow: 'auto',
                    maxHeight: 400,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    border: '1px solid #e0e0e0',
                  }}
                >
                  {JSON.stringify(execResult.data, null, 2)}
                </Box>
              </>
            )}
          </Box>
        )}

        {/* ── Bottom actions ── */}
        <Divider sx={{ mt: 2, mb: 1 }} />

        <Button
          variant="contained"
          size="small"
          startIcon={executing ? <CircularProgress size={14} color="inherit" /> : <PlayArrowIcon />}
          disabled={executing}
          sx={{ mb: 1, borderRadius: 6 }}
          onClick={handleExecute}
        >
          {executing ? 'Executing…' : 'Execute step'}
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
}

function TriggerConfig({ node, cfg, onUpdate }: ConfigProps) {
  if (node.data.nodeType !== 'trigger') return null;
  return (
    <FormControl size="small" fullWidth sx={{ mb: 2 }}>
      <InputLabel>Trigger Type</InputLabel>
      <Select
        value={(cfg.triggerType as string) || 'manual'}
        label="Trigger Type"
        onChange={(e) => onUpdate(node.id, {
          config: { ...cfg, triggerType: e.target.value },
          subtitle: e.target.value as string,
        })}
      >
        <MenuItem value="manual">Manual</MenuItem>
        <MenuItem value="schedule">Schedule (Cron)</MenuItem>
        <MenuItem value="webhook">Webhook</MenuItem>
        <MenuItem value="event">Event</MenuItem>
        <MenuItem value="on-chat">On Chat Message</MenuItem>
        <MenuItem value="on-commit">On Git Commit</MenuItem>
        <MenuItem value="chat-input">Chat Input (interactive)</MenuItem>
      </Select>
    </FormControl>
  );
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

function LlmConfig({ node, cfg, onUpdate }: ConfigProps) {
  if (node.data.nodeType !== 'llm') return null;
  return (
    <>
      <TextField
        label="System Message"
        size="small"
        fullWidth
        multiline
        rows={4}
        value={(cfg.systemPrompt as string) || ''}
        onChange={(e) => onUpdate(node.id, {
          config: { ...cfg, systemPrompt: e.target.value },
        })}
        sx={{ mb: 2 }}
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
        sx={{ mb: 2 }}
        placeholder="{{ $json.prompt }}"
      />
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
  const [connectors, setConnectors] = useState<Array<{ id: string; name: string }>>([]);
  const [actions, setActions] = useState<Array<{ id: string; name: string; description: string; inputSchema?: Record<string, unknown> }>>([]);

  // Fetch all registered connectors on mount
  useEffect(() => {
    if (node.data.nodeType !== 'action') return;
    (async () => {
      try {
        const list = await backend.connectorList();
        setConnectors(list.map((c: any) => ({ id: c.id, name: c.name })));
      } catch { /* ignore */ }
    })();
  }, [backend, node.data.nodeType]);

  // Fetch actions whenever the selected connector changes
  useEffect(() => {
    const connectorId = cfg.connectorId as string;
    if (!connectorId || node.data.nodeType !== 'action') {
      setActions([]);
      return;
    }
    (async () => {
      try {
        const detail = await backend.connectorGet(connectorId);
        if (detail?.actions) {
          setActions(detail.actions);
        } else {
          setActions([]);
        }
      } catch {
        setActions([]);
      }
    })();
  }, [backend, cfg.connectorId, node.data.nodeType]);

  if (node.data.nodeType !== 'action') return null;

  const selectedAction = actions.find(a => a.id === (cfg.actionId as string));
  const inputSchema = (selectedAction?.inputSchema || {}) as Record<string, {
    type: string; label: string; required?: boolean; placeholder?: string;
  }>;

  return (
    <>
      {/* Connector selector */}
      <FormControl size="small" fullWidth sx={{ mb: 2 }}>
        <InputLabel>Connector</InputLabel>
        <Select
          value={(cfg.connectorId as string) || ''}
          label="Connector"
          onChange={(e) => onUpdate(node.id, {
            config: { connectorId: e.target.value, actionId: '' },
            subtitle: e.target.value as string,
          })}
        >
          {connectors.map(c => (
            <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* Action selector */}
      <FormControl size="small" fullWidth sx={{ mb: 2 }}>
        <InputLabel>Action</InputLabel>
        <Select
          value={(cfg.actionId as string) || ''}
          label="Action"
          onChange={(e) => {
            // Clear old param values when switching actions, keep connector & action
            onUpdate(node.id, {
              config: { connectorId: cfg.connectorId, actionId: e.target.value },
              subtitle: `${(cfg.connectorId as string) || ''}:${e.target.value}`,
            });
          }}
        >
          {actions.map(a => (
            <MenuItem key={a.id} value={a.id}>
              <Box>
                <Typography variant="body2">{a.name}</Typography>
                <Typography variant="caption" color="text.secondary">{a.description}</Typography>
              </Box>
            </MenuItem>
          ))}
        </Select>
      </FormControl>

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
