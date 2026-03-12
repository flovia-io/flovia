/**
 * EmptyState - Placeholder for empty lists/panels
 * 
 * Provides consistent styling for empty states with optional icon and action.
 */
import { Box, Typography, Button, Stack } from '@mui/material';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        py: 4,
        px: 2,
        textAlign: 'center',
      }}
    >
      {icon && (
        <Box sx={{ mb: 2, color: 'text.disabled', fontSize: 40 }}>
          {icon}
        </Box>
      )}
      <Typography variant="body2" color="text.secondary" fontWeight={500}>
        {title}
      </Typography>
      {description && (
        <Typography variant="caption" color="text.disabled" sx={{ mt: 0.5 }}>
          {description}
        </Typography>
      )}
      {action && (
        <Button
          variant="outlined"
          size="small"
          onClick={action.onClick}
          sx={{ mt: 2 }}
        >
          {action.label}
        </Button>
      )}
    </Box>
  );
}
