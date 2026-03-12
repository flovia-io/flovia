/**
 * NodePaletteDrawer — Drawer that lists all available node types for drag-to-add.
 */
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Drawer from '@mui/material/Drawer';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import CloseIcon from '@mui/icons-material/Close';

import { NODE_PALETTE, type NodePaletteEntry } from './workflow.constants';

interface Props {
  open: boolean;
  onClose: () => void;
  onAddNode: (item: NodePaletteEntry) => void;
}

export function NodePaletteDrawer({ open, onClose, onAddNode }: Props) {
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { width: 300, pt: 2 } }}
    >
      <Box sx={{ px: 2, pb: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="subtitle1" fontWeight={700}>Add Node</Typography>
        <IconButton size="small" onClick={onClose}><CloseIcon /></IconButton>
      </Box>
      <Divider />
      <List>
        {NODE_PALETTE.map(item => (
          <ListItemButton key={item.type} onClick={() => onAddNode(item)} sx={{ gap: 1.5 }}>
            <Box
              sx={{
                width: 36, height: 36, borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                bgcolor: `${item.color}18`, border: 1, borderColor: `${item.color}40`,
              }}
            >
              <Typography sx={{ fontSize: 18 }}>{item.icon}</Typography>
            </Box>
            <ListItemText
              primary={item.label}
              secondary={item.description}
              primaryTypographyProps={{ fontSize: 13, fontWeight: 600 }}
              secondaryTypographyProps={{ fontSize: 11 }}
            />
          </ListItemButton>
        ))}
      </List>
    </Drawer>
  );
}
