/**
 * PluginCard - Card displaying a plugin/connector
 * 
 * Shows plugin info with status, credentials configuration, and actions.
 */
import { useState } from 'react';
import {
  Card,
  CardContent,
  Box,
  Typography,
  IconButton,
  Collapse,
  Stack,
  Chip,
  Button,
  Avatar,
  Divider,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import SettingsIcon from '@mui/icons-material/Settings';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import type { ReactNode } from 'react';
import StatusIndicator, { type StatusType } from './StatusIndicator';

export interface PluginAction {
  id: string;
  name: string;
  description?: string;
}

interface PluginCardProps {
  id: string;
  name: string;
  description?: string;
  icon?: ReactNode;
  iconColor?: string;
  category?: string;
  status: StatusType;
  actions?: PluginAction[];
  onConfigure?: () => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onActionSelect?: (actionId: string) => void;
  disabled?: boolean;
  configurable?: boolean;
  connecting?: boolean;
}

export default function PluginCard({
  name,
  description,
  icon,
  iconColor = 'primary.main',
  category,
  status,
  actions = [],
  onConfigure,
  onConnect,
  onDisconnect,
  onActionSelect,
  disabled,
  configurable = true,
  connecting,
}: PluginCardProps) {
  const [expanded, setExpanded] = useState(false);

  const isConnected = status === 'connected';
  const canConnect = status === 'installed' || status === 'stopped' || status === 'disconnected' || status === 'error';
  const showActions = isConnected && actions.length > 0;

  return (
    <Card 
      variant="outlined" 
      sx={{ 
        opacity: disabled ? 0.6 : 1,
        transition: 'box-shadow 0.15s',
        '&:hover': {
          boxShadow: disabled ? 'none' : '0 2px 8px rgba(0,0,0,0.08)',
        },
      }}
    >
      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
        {/* Header */}
        <Stack direction="row" spacing={1.5} alignItems="flex-start">
          <Avatar
            sx={{
              width: 36,
              height: 36,
              bgcolor: 'grey.100',
              color: iconColor,
              fontSize: '1.2rem',
            }}
          >
            {icon || name.charAt(0).toUpperCase()}
          </Avatar>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography variant="body2" fontWeight={600} noWrap>
                {name}
              </Typography>
              {category && (
                <Chip
                  label={category}
                  size="small"
                  variant="outlined"
                  sx={{ fontSize: '0.65rem', height: 18 }}
                />
              )}
            </Stack>
            <StatusIndicator status={status} size="small" />
          </Box>

          <Stack direction="row" spacing={0.5}>
            {configurable && onConfigure && (
              <IconButton 
                size="small" 
                onClick={onConfigure}
                sx={{ color: 'text.secondary' }}
              >
                <SettingsIcon fontSize="small" />
              </IconButton>
            )}
            {showActions && (
              <IconButton 
                size="small" 
                onClick={() => setExpanded(!expanded)}
                sx={{ color: 'text.secondary' }}
              >
                {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
              </IconButton>
            )}
          </Stack>
        </Stack>

        {/* Description */}
        {description && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              mt: 1,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {description}
          </Typography>
        )}

        {/* Connection actions */}
        <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
          {canConnect && onConnect && (
            <Button
              size="small"
              variant="contained"
              onClick={onConnect}
              disabled={connecting || disabled}
              startIcon={<PlayArrowIcon />}
            >
              {connecting ? 'Connecting…' : 'Connect'}
            </Button>
          )}
          {isConnected && onDisconnect && (
            <Button
              size="small"
              variant="outlined"
              onClick={onDisconnect}
              disabled={connecting || disabled}
            >
              Disconnect
            </Button>
          )}
        </Stack>

        {/* Actions list */}
        <Collapse in={expanded && showActions}>
          <Divider sx={{ my: 1.5 }} />
          <Typography variant="caption" color="text.secondary" fontWeight={500}>
            Available Actions
          </Typography>
          <Stack spacing={0.5} sx={{ mt: 1 }}>
            {actions.map(action => (
              <Button
                key={action.id}
                size="small"
                variant="text"
                startIcon={<PlayArrowIcon />}
                onClick={() => onActionSelect?.(action.id)}
                sx={{
                  justifyContent: 'flex-start',
                  textAlign: 'left',
                  color: 'text.primary',
                  '&:hover': {
                    bgcolor: 'grey.100',
                  },
                }}
              >
                <Box>
                  <Typography variant="body2" fontWeight={500}>
                    {action.name}
                  </Typography>
                  {action.description && (
                    <Typography variant="caption" color="text.secondary">
                      {action.description}
                    </Typography>
                  )}
                </Box>
              </Button>
            ))}
          </Stack>
        </Collapse>
      </CardContent>
    </Card>
  );
}
