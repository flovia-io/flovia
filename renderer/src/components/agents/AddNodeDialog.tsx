/**
 * AddNodeDialog — Dialog for adding a new agent node to the pipeline.
 */
import { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import MuiButton from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Switch from '@mui/material/Switch';
import Slider from '@mui/material/Slider';
import Checkbox from '@mui/material/Checkbox';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import InputLabel from '@mui/material/InputLabel';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import AddIcon from '@mui/icons-material/Add';
import type { AgentNode as AgentNodeType, AgentTool, PhaseCategory } from '../../types/agent.types';
import { getCategoryColors, CATEGORY_LABELS } from './agent.constants';

interface AddNodeDialogProps {
  open: boolean;
  onAdd: (node: AgentNodeType) => void;
  onClose: () => void;
  existingNodes: AgentNodeType[];
  allTools: AgentTool[];
}

export default function AddNodeDialog({ open, onAdd, onClose, existingNodes, allTools }: AddNodeDialogProps) {
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
      category,
      icon,
      enabled: true,
      position: { x: 200, y: maxY + 160 },
      tools: hasTools ? allTools.map(t => ({ ...t, enabled: false })) : undefined,
      continueQuestion: continueQuestion || undefined,
      maxRetries: maxRetries > 0 ? maxRetries : undefined,
    };
    onAdd(newNode);
    // Reset form
    setLabel('');
    setDescription('');
    setIcon('⚡');
    setCategory('execution');
    setHasTools(false);
    setContinueQuestion(false);
    setMaxRetries(0);
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
            <TextField
              label="Icon"
              value={icon}
              onChange={e => setIcon(e.target.value)}
              size="small"
              sx={{ width: 70 }}
              inputProps={{ style: { textAlign: 'center', fontSize: '1.2rem' } }}
            />
            <TextField
              label="Name"
              value={label}
              onChange={e => setLabel(e.target.value)}
              size="small"
              fullWidth
              autoFocus
            />
          </Box>
          <TextField
            label="Description"
            value={description}
            onChange={e => setDescription(e.target.value)}
            size="small"
            fullWidth
            multiline
            rows={2}
            placeholder="What does this node do?"
          />
          <FormControl size="small" fullWidth>
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
          <Divider />
          <FormControlLabel
            control={<Checkbox checked={hasTools} onChange={e => setHasTools(e.target.checked)} size="small" />}
            label={<Typography sx={{ fontSize: '0.82rem' }}>Enable tool selection</Typography>}
          />
          <FormControlLabel
            control={
              <Switch
                checked={continueQuestion}
                onChange={(_, v) => setContinueQuestion(v)}
                size="small"
                sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: '#7c3aed' } }}
              />
            }
            label={<Typography sx={{ fontSize: '0.82rem' }}>Ask "continue or stop?" after this node</Typography>}
          />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography sx={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}>Max Retries:</Typography>
            <Slider
              value={maxRetries}
              onChange={(_, v) => setMaxRetries(v as number)}
              min={0}
              max={10}
              step={1}
              sx={{ flex: 1 }}
              valueLabelDisplay="auto"
            />
            <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', minWidth: 20, textAlign: 'center' }}>
              {maxRetries}
            </Typography>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <MuiButton onClick={onClose} sx={{ textTransform: 'none' }}>Cancel</MuiButton>
        <MuiButton variant="contained" onClick={handleAdd} disabled={!label.trim()} sx={{ textTransform: 'none' }}>
          Add Node
        </MuiButton>
      </DialogActions>
    </Dialog>
  );
}
