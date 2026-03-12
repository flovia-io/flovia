/**
 * Panel - Generic sidebar panel container
 * 
 * Provides consistent styling for all sidebar panels.
 */
import { Box, type SxProps, type Theme } from '@mui/material';
import type { ReactNode } from 'react';

interface PanelProps {
  children: ReactNode;
  sx?: SxProps<Theme>;
}

export default function Panel({ children, sx }: PanelProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        bgcolor: 'grey.50',
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}
