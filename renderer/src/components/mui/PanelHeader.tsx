/**
 * PanelHeader - Consistent header for sidebar panels
 * 
 * Includes title, optional icon, and action buttons.
 */
import { Box, Typography, IconButton, Stack } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import AddIcon from '@mui/icons-material/Add';
import type { ReactNode } from 'react';

interface PanelHeaderProps {
  title: string;
  icon?: ReactNode;
  onRefresh?: () => void;
  onAdd?: () => void;
  refreshing?: boolean;
  actions?: ReactNode;
}

export default function PanelHeader({
  title,
  icon,
  onRefresh,
  onAdd,
  refreshing,
  actions,
}: PanelHeaderProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 1.5,
        py: 1,
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      {icon && (
        <Box sx={{ display: 'flex', alignItems: 'center', color: 'primary.main' }}>
          {icon}
        </Box>
      )}
      <Typography variant="h6" sx={{ flex: 1, fontWeight: 600 }}>
        {title}
      </Typography>
      <Stack direction="row" spacing={0.5}>
        {onRefresh && (
          <IconButton
            size="small"
            onClick={onRefresh}
            disabled={refreshing}
            sx={{
              color: 'text.secondary',
              animation: refreshing ? 'spin 1s linear infinite' : 'none',
              '@keyframes spin': {
                from: { transform: 'rotate(0deg)' },
                to: { transform: 'rotate(360deg)' },
              },
            }}
          >
            <RefreshIcon fontSize="small" />
          </IconButton>
        )}
        {onAdd && (
          <IconButton size="small" onClick={onAdd} sx={{ color: 'text.secondary' }}>
            <AddIcon fontSize="small" />
          </IconButton>
        )}
        {actions}
      </Stack>
    </Box>
  );
}
