/**
 * LoadingOverlay - Loading state with spinner
 * 
 * Can be used as an overlay or inline loading indicator.
 */
import { Box, CircularProgress, Typography } from '@mui/material';

interface LoadingOverlayProps {
  message?: string;
  size?: 'small' | 'medium' | 'large';
  overlay?: boolean;
}

export default function LoadingOverlay({ 
  message, 
  size = 'medium',
  overlay = false,
}: LoadingOverlayProps) {
  const spinnerSize = size === 'small' ? 20 : size === 'large' ? 40 : 28;

  const content = (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1.5,
        py: 3,
      }}
    >
      <CircularProgress size={spinnerSize} />
      {message && (
        <Typography variant="caption" color="text.secondary">
          {message}
        </Typography>
      )}
    </Box>
  );

  if (overlay) {
    return (
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'rgba(255, 255, 255, 0.8)',
          zIndex: 10,
        }}
      >
        {content}
      </Box>
    );
  }

  return content;
}
