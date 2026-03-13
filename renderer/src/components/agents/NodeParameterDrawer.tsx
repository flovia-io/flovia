/**
 * NodeParameterDrawer — n8n-style slide-out drawer for editing agent node settings.
 */
import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
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
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import InputLabel from '@mui/material/InputLabel';
import InputAdornment from '@mui/material/InputAdornment';
import Checkbox from '@mui/material/Checkbox';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Collapse from '@mui/material/Collapse';
import Paper from '@mui/material/Paper';
import CloseIcon from '@mui/icons-material/Close';
import TuneIcon from '@mui/icons-material/Tune';
import BuildIcon from '@mui/icons-material/Build';
import SettingsIcon from '@mui/icons-material/Settings';
import DeleteIcon from '@mui/icons-material/Delete';
import QuestionAnswerIcon from '@mui/icons-material/QuestionAnswer';
import ReplayIcon from '@mui/icons-material/Replay';
import type { AgentNode as AgentNodeType, AgentTool, PhaseCategory } from '../../types/agent.types';
import { getCategoryColors, CATEGORY_LABELS } from './agent.constants';
import { ConfirmDialog } from '../shared';

interface NodeParameterDrawerProps {
  node: AgentNodeType;
  isEditable: boolean;
  onSave: (updated: AgentNodeType) => void;
  onDelete: (nodeId: string) => void;
  onSaveTools: (nodeId: string, tools: AgentTool[]) => void;
  onClose: () => void;
  allTools: AgentTool[];
}

export default function NodeParameterDrawer({
  node, isEditable, onSave, onDelete, onSaveTools, onClose, allTools,
}: NodeParameterDrawerProps) {
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
  const colors = getCategoryColors(node.category);

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
          <Chip label={CATEGORY_LABELS[category]} size="small"
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
                    {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                      <MenuItem key={k} value={k}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: getCategoryColors(k).border }} />
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
              {([
                ['Node ID', node.id],
                ['Position', `x: ${node.position.x}, y: ${node.position.y}`],
                ['Inputs', node.inputs?.join(' → ') || 'None'],
                ['Outputs', node.outputs?.join(' → ') || 'None'],
              ] as const).map(([lbl, val]) => (
                <Box key={lbl} sx={{ mb: 1 }}>
                  <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: '#9e9e9e', textTransform: 'uppercase' }}>{lbl}</Typography>
                  <Typography sx={{ fontSize: '0.76rem', fontFamily: 'monospace', color: '#333' }}>{val}</Typography>
                </Box>
              ))}
            </Paper>
            {isEditable && (
              <MuiButton variant="outlined" color="error" startIcon={<DeleteIcon />}
                onClick={() => setConfirmDelete(true)} fullWidth sx={{ textTransform: 'none' }}>
                Delete Node
              </MuiButton>
            )}
            <ConfirmDialog
              open={confirmDelete}
              title={`Delete "${node.label}"?`}
              message="This will remove the node and all connected edges."
              confirmLabel="Delete"
              confirmColor="error"
              onConfirm={() => { onDelete(node.id); onClose(); }}
              onCancel={() => setConfirmDelete(false)}
            />
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
