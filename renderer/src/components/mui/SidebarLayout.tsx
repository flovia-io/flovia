/**
 * SidebarLayout - Main layout for sidebar panels
 * 
 * Provides a consistent structure for sidebar panels with header, content, and optional footer.
 */
import { Box, type SxProps, type Theme } from '@mui/material';
import type { ReactNode } from 'react';

interface SidebarLayoutProps {
  header?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  sx?: SxProps<Theme>;
}

export default function SidebarLayout({ header, children, footer, sx }: SidebarLayoutProps) {
  return (
    <Box
      component="aside"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        bgcolor: 'grey.50',
        borderRight: 1,
        borderColor: 'divider',
        ...sx,
      }}
    >
      {header}
      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
        }}
      >
        {children}
      </Box>
      {footer}
    </Box>
  );
}
