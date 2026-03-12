/**
 * StatusIndicator - Visual status indicator with color and label
 * 
 * Used to show connection status, server status, etc.
 */
import { Box, Typography, Stack } from '@mui/material';

export type StatusType = 'connected' | 'disconnected' | 'connecting' | 'error' | 'installed' | 'installing' | 'stopped' | 'not-installed';

interface StatusIndicatorProps {
  status: StatusType;
  size?: 'small' | 'medium';
  showLabel?: boolean;
}

const statusConfig: Record<StatusType, { color: string; label: string }> = {
  connected: { color: '#22c55e', label: 'Connected' },
  installed: { color: '#3b82f6', label: 'Installed' },
  installing: { color: '#f59e0b', label: 'Installing…' },
  connecting: { color: '#f59e0b', label: 'Connecting…' },
  error: { color: '#ef4444', label: 'Error' },
  stopped: { color: '#94a3b8', label: 'Stopped' },
  disconnected: { color: '#94a3b8', label: 'Disconnected' },
  'not-installed': { color: '#d1d5db', label: 'Not installed' },
};

export default function StatusIndicator({ 
  status, 
  size = 'small', 
  showLabel = true 
}: StatusIndicatorProps) {
  const config = statusConfig[status] || statusConfig.disconnected;
  const dotSize = size === 'small' ? 8 : 10;

  return (
    <Stack direction="row" alignItems="center" spacing={0.75}>
      <Box
        sx={{
          width: dotSize,
          height: dotSize,
          borderRadius: '50%',
          bgcolor: config.color,
          flexShrink: 0,
        }}
      />
      {showLabel && (
        <Typography
          variant="caption"
          sx={{
            color: 'text.secondary',
            fontSize: size === 'small' ? '0.68rem' : '0.72rem',
          }}
        >
          {config.label}
        </Typography>
      )}
    </Stack>
  );
}
