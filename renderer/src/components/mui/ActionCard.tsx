/**
 * ActionCard - Card for displaying an action with description
 * 
 * Used to show available actions for a plugin/connector.
 */
import { 
  Card, 
  CardActionArea, 
  CardContent, 
  Typography, 
  Box,
  Chip,
  Stack,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import type { ReactNode } from 'react';

interface ActionCardProps {
  id: string;
  name: string;
  description?: string;
  icon?: ReactNode;
  onClick: (actionId: string) => void;
  disabled?: boolean;
  selected?: boolean;
  tags?: string[];
}

export default function ActionCard({
  id,
  name,
  description,
  icon,
  onClick,
  disabled,
  selected,
  tags,
}: ActionCardProps) {
  return (
    <Card
      sx={{
        opacity: disabled ? 0.6 : 1,
        border: selected ? 2 : 1,
        borderColor: selected ? 'primary.main' : 'divider',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        '&:hover': {
          borderColor: disabled ? 'divider' : 'primary.light',
        },
      }}
    >
      <CardActionArea
        onClick={() => !disabled && onClick(id)}
        disabled={disabled}
        sx={{ p: 0 }}
      >
        <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
          <Stack direction="row" spacing={1} alignItems="flex-start">
            {icon ? (
              <Box sx={{ color: 'primary.main', mt: 0.25 }}>{icon}</Box>
            ) : (
              <PlayArrowIcon fontSize="small" sx={{ color: 'text.secondary', mt: 0.25 }} />
            )}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" fontWeight={500}>
                {name}
              </Typography>
              {description && (
                <Typography 
                  variant="caption" 
                  color="text.secondary"
                  sx={{
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {description}
                </Typography>
              )}
              {tags && tags.length > 0 && (
                <Stack direction="row" spacing={0.5} sx={{ mt: 0.75 }}>
                  {tags.map(tag => (
                    <Chip 
                      key={tag} 
                      label={tag} 
                      size="small" 
                      variant="outlined"
                      sx={{ fontSize: '0.65rem', height: 18 }}
                    />
                  ))}
                </Stack>
              )}
            </Box>
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
