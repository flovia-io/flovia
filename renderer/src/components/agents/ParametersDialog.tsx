/**
 * ParametersDialog — Agent-level parameters editor dialog.
 * Covers numeric limits, prompt templates, and the continue/stop toggle.
 */
import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import MuiButton from '@mui/material/Button';
import MuiIconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Switch from '@mui/material/Switch';
import Chip from '@mui/material/Chip';
import MuiTabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Tooltip from '@mui/material/Tooltip';
import FormControlLabel from '@mui/material/FormControlLabel';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Paper from '@mui/material/Paper';
import CloseIcon from '@mui/icons-material/Close';
import SettingsIcon from '@mui/icons-material/Settings';
import RestoreIcon from '@mui/icons-material/Restore';
import type { AgentParameters } from '../../types/agent.types';
import { DEFAULT_AGENT_PARAMETERS, resolveAgentParameters } from '../../types/agent.types';
import { NUMERIC_PARAM_META, PROMPT_PARAM_META } from './agent.constants';

interface ParametersDialogProps {
  open: boolean;
  parameters: Partial<AgentParameters>;
  isEditable: boolean;
  onSave: (params: Partial<AgentParameters>) => void;
  onClose: () => void;
}

export default function ParametersDialog({ open, parameters, isEditable, onSave, onClose }: ParametersDialogProps) {
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
      {/* Header */}
      <Box sx={{ px: 2.5, py: 1.5, borderBottom: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', gap: 1.25 }}>
        <SettingsIcon sx={{ color: '#1976d2' }} />
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }}>Agent Parameters</Typography>
          <Typography sx={{ fontSize: '0.68rem', color: '#9e9e9e' }}>Customize limits, prompts, and continue/stop behavior</Typography>
        </Box>
        <MuiIconButton onClick={onClose} size="small"><CloseIcon /></MuiIconButton>
      </Box>

      {/* Tabs */}
      <MuiTabs value={tab} onChange={(_, v) => setTab(v)} sx={{
        borderBottom: '1px solid #e0e0e0', bgcolor: '#fafafa', minHeight: 40,
        '& .MuiTab-root': { minHeight: 40, fontSize: '0.76rem', textTransform: 'none' },
      }}>
        <Tab label="🔢 Numeric Limits" />
        <Tab label="📝 Prompt Templates" />
        <Tab label="🤔 Continue/Stop" />
      </MuiTabs>

      {/* Content */}
      <DialogContent sx={{ bgcolor: '#fafafa' }}>
        {/* Numeric Limits Tab */}
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
                    {isModified(meta.key) && (
                      <Chip label="MODIFIED" size="small" sx={{ height: 16, fontSize: '0.55rem', bgcolor: '#fff3e0', color: '#e65100', fontWeight: 700 }} />
                    )}
                  </Box>
                  <Typography sx={{ fontSize: '0.66rem', color: '#9e9e9e' }}>{meta.description}</Typography>
                </Box>
                <TextField
                  type="number"
                  size="small"
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

        {/* Prompt Templates Tab */}
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
                      {isModified(meta.key) && (
                        <Chip label="MODIFIED" size="small" sx={{ height: 16, fontSize: '0.55rem', bgcolor: '#fff3e0', color: '#e65100', fontWeight: 700 }} />
                      )}
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
                  disabled={!isEditable}
                  fullWidth
                  multiline
                  rows={5}
                  sx={{ '& .MuiOutlinedInput-notchedOutline': { border: 'none' }, '& textarea': { fontFamily: 'monospace', fontSize: '0.7rem', lineHeight: 1.6 } }}
                />
              </Paper>
            ))}
          </Stack>
        )}

        {/* Continue/Stop Tab */}
        {tab === 2 && (
          <Stack spacing={2}>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, border: enableContinueQuestion ? '2px solid #7c3aed' : undefined }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={enableContinueQuestion}
                    onChange={(_, v) => setEnableContinueQuestion(v)}
                    disabled={!isEditable}
                    size="small"
                    sx={{
                      '& .MuiSwitch-switchBase.Mui-checked': { color: '#7c3aed' },
                      '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#7c3aed' },
                    }}
                  />
                }
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

      {/* Footer */}
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
