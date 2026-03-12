/**
 * ConnectorsPanel - Unified panel for all connectors/plugins
 * 
 * Shows all registered connectors with a consistent UI for:
 * - Configuration (credentials)
 * - Connection status
 * - Available actions
 * - Action execution with prefill and preview
 */
import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Stack,
  Button,
  IconButton,
  Avatar,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Collapse,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DescriptionIcon from '@mui/icons-material/Description';
import ExtensionIcon from '@mui/icons-material/Extension';
import GitHubIcon from '@mui/icons-material/GitHub';
import CloudIcon from '@mui/icons-material/Cloud';
import StorageIcon from '@mui/icons-material/Storage';
import HubIcon from '@mui/icons-material/Hub';
import { Panel, PanelHeader, StatusIndicator, EmptyState, FormField } from './mui';
import type { StatusType } from './mui/StatusIndicator';
import type { FieldConfig } from './mui/FormField';

// Icons for different connector categories
const categoryIcons: Record<string, React.ReactNode> = {
  'source-control': <GitHubIcon fontSize="small" />,
  'database': <StorageIcon fontSize="small" />,
  'cloud': <CloudIcon fontSize="small" />,
  'project-management': <HubIcon fontSize="small" />,
};

// Connector type (simplified from core/connector.ts for renderer use)
interface ConnectorInfo {
  id: string;
  name: string;
  description: string;
  icon?: string;
  category: string;
  status: StatusType;
  configFields: FieldConfig[];
  actions: Array<{
    id: string;
    name: string;
    description?: string;
    inputSchema?: Record<string, unknown>;
  }>;
  credentials?: Record<string, string | boolean | number>;
}

// Mock connectors for demo - in real implementation, these would come from the backend
const DEMO_CONNECTORS: ConnectorInfo[] = [
  {
    id: 'github',
    name: 'GitHub',
    description: 'Connect to GitHub for repos, issues, and PRs',
    category: 'source-control',
    status: 'disconnected',
    configFields: [
      { key: 'token', label: 'Personal Access Token', type: 'password', required: true, helpText: 'Generate at github.com/settings/tokens' },
      { key: 'org', label: 'Organization (optional)', type: 'text', required: false },
    ],
    actions: [
      { id: 'list-repos', name: 'List Repositories', description: 'Get all accessible repositories' },
      { id: 'get-issues', name: 'Get Issues', description: 'Fetch issues from a repository' },
      { id: 'create-pr', name: 'Create PR', description: 'Create a pull request' },
    ],
  },
  {
    id: 'supabase',
    name: 'Supabase',
    description: 'PostgreSQL database with realtime and auth',
    category: 'database',
    status: 'connected',
    configFields: [
      { key: 'url', label: 'Project URL', type: 'url', required: true },
      { key: 'key', label: 'API Key', type: 'password', required: true },
    ],
    actions: [
      { id: 'list-tables', name: 'List Tables', description: 'Get all tables in the database' },
      { id: 'query', name: 'Run Query', description: 'Execute a SQL query' },
    ],
    credentials: { url: 'https://xxx.supabase.co', key: '***' },
  },
  {
    id: 'atlassian',
    name: 'Atlassian',
    description: 'Connect to Jira and Confluence',
    category: 'project-management',
    status: 'disconnected',
    configFields: [
      { key: 'domain', label: 'Domain', type: 'text', required: true, placeholder: 'yourcompany.atlassian.net' },
      { key: 'email', label: 'Email', type: 'email', required: true },
      { key: 'token', label: 'API Token', type: 'password', required: true },
    ],
    actions: [
      { id: 'list-projects', name: 'List Projects', description: 'Get all Jira projects' },
      { id: 'get-issues', name: 'Get Issues', description: 'Fetch issues from a project' },
      { id: 'create-issue', name: 'Create Issue', description: 'Create a new Jira issue' },
    ],
  },
  {
    id: 'digitalocean',
    name: 'DigitalOcean',
    description: 'App Platform — view apps, deployments, and deploy',
    category: 'cloud',
    status: 'disconnected',
    configFields: [
      { key: 'token', label: 'API Token', type: 'password', required: true, helpText: 'Generate at cloud.digitalocean.com/account/api/tokens. Needs read+write scope.' },
    ],
    actions: [
      { id: 'list-apps', name: 'List Apps', description: 'List all App Platform apps' },
      { id: 'get-app', name: 'Get App', description: 'Get details for a specific app' },
      { id: 'list-deployments', name: 'List Deployments', description: 'List deployments for an app' },
      { id: 'get-deployment', name: 'Get Deployment', description: 'Get details for a specific deployment' },
      { id: 'create-deployment', name: 'Deploy', description: 'Trigger a new deployment' },
      { id: 'cancel-deployment', name: 'Cancel Deployment', description: 'Cancel a running deployment' },
      { id: 'get-deployment-logs', name: 'Get Logs', description: 'View build logs for a deployment' },
    ],
  },
];

interface ConnectorCardProps {
  connector: ConnectorInfo;
  onConfigure: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onActionSelect: (actionId: string) => void;
  busy?: boolean;
}

function ConnectorCard({
  connector,
  onConfigure,
  onConnect,
  onDisconnect,
  onActionSelect,
  busy,
}: ConnectorCardProps) {
  const [expanded, setExpanded] = useState(false);
  const isConnected = connector.status === 'connected';
  const canConnect = connector.status === 'disconnected' || connector.status === 'error';

  return (
    <Card variant="outlined">
      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
        {/* Header */}
        <Stack direction="row" spacing={1.5} alignItems="flex-start">
          <Avatar
            sx={{
              width: 36,
              height: 36,
              bgcolor: 'grey.100',
              color: 'primary.main',
              fontSize: '1.2rem',
            }}
          >
            {categoryIcons[connector.category] || <ExtensionIcon fontSize="small" />}
          </Avatar>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography variant="body2" fontWeight={600} noWrap>
                {connector.name}
              </Typography>
              <Chip
                label={connector.category}
                size="small"
                variant="outlined"
                sx={{ fontSize: '0.65rem', height: 18 }}
              />
            </Stack>
            <StatusIndicator status={connector.status} size="small" />
          </Box>

          <Stack direction="row" spacing={0.5}>
            <Tooltip title="Configure">
              <IconButton size="small" onClick={onConfigure}>
                <SettingsIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            {isConnected && connector.actions.length > 0 && (
              <IconButton size="small" onClick={() => setExpanded(!expanded)}>
                {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
              </IconButton>
            )}
          </Stack>
        </Stack>

        {/* Description */}
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          {connector.description}
        </Typography>

        {/* Connection actions */}
        <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
          {canConnect && (
            <Button
              size="small"
              variant="contained"
              onClick={onConnect}
              disabled={busy}
              startIcon={busy ? <CircularProgress size={14} /> : <PlayArrowIcon />}
            >
              Connect
            </Button>
          )}
          {isConnected && (
            <Button
              size="small"
              variant="outlined"
              onClick={onDisconnect}
              disabled={busy}
              startIcon={<StopIcon />}
            >
              Disconnect
            </Button>
          )}
        </Stack>

        {/* Actions list */}
        <Collapse in={expanded && isConnected}>
          <Divider sx={{ my: 1.5 }} />
          <Typography variant="caption" color="text.secondary" fontWeight={500}>
            Available Actions
          </Typography>
          <List dense disablePadding sx={{ mt: 0.5 }}>
            {connector.actions.map(action => (
              <ListItemButton
                key={action.id}
                onClick={() => onActionSelect(action.id)}
                sx={{ borderRadius: 1, py: 0.5 }}
              >
                <ListItemIcon sx={{ minWidth: 28 }}>
                  <PlayArrowIcon fontSize="small" sx={{ color: 'primary.main' }} />
                </ListItemIcon>
                <ListItemText
                  primary={action.name}
                  secondary={action.description}
                  primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                  secondaryTypographyProps={{ variant: 'caption' }}
                />
              </ListItemButton>
            ))}
          </List>
        </Collapse>
      </CardContent>
    </Card>
  );
}

export default function ConnectorsPanel() {
  const [connectors, setConnectors] = useState<ConnectorInfo[]>(DEMO_CONNECTORS);
  const [loading, setLoading] = useState(false);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  
  // Dialog states
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [resultDialogOpen, setResultDialogOpen] = useState(false);
  const [selectedConnector, setSelectedConnector] = useState<ConnectorInfo | null>(null);
  const [selectedAction, setSelectedAction] = useState<ConnectorInfo['actions'][0] | null>(null);
  const [actionResult, setActionResult] = useState<{ success: boolean; data?: unknown; error?: string } | null>(null);
  
  // Form states
  const [credentials, setCredentials] = useState<Record<string, string | boolean | number>>({});
  const [actionParams, setActionParams] = useState<Record<string, string | boolean | number>>({});
  const [executing, setExecuting] = useState(false);

  const setBusy = (id: string, busy: boolean) => {
    setBusyIds(prev => {
      const next = new Set(prev);
      busy ? next.add(id) : next.delete(id);
      return next;
    });
  };

  const handleConfigure = (connector: ConnectorInfo) => {
    setSelectedConnector(connector);
    setCredentials(connector.credentials || {});
    setConfigDialogOpen(true);
  };

  const handleConnect = async (connectorId: string) => {
    setBusy(connectorId, true);
    // Simulate connection
    await new Promise(resolve => setTimeout(resolve, 1000));
    setConnectors(prev =>
      prev.map(c => c.id === connectorId ? { ...c, status: 'connected' as StatusType } : c)
    );
    setBusy(connectorId, false);
  };

  const handleDisconnect = async (connectorId: string) => {
    setBusy(connectorId, true);
    // Simulate disconnection
    await new Promise(resolve => setTimeout(resolve, 500));
    setConnectors(prev =>
      prev.map(c => c.id === connectorId ? { ...c, status: 'disconnected' as StatusType } : c)
    );
    setBusy(connectorId, false);
  };

  const handleActionSelect = (connector: ConnectorInfo, actionId: string) => {
    const action = connector.actions.find(a => a.id === actionId);
    if (!action) return;
    setSelectedConnector(connector);
    setSelectedAction(action);
    setActionParams({});
    setActionDialogOpen(true);
  };

  const handleSaveCredentials = async () => {
    if (!selectedConnector) return;
    // Save credentials and connect
    setConnectors(prev =>
      prev.map(c => c.id === selectedConnector.id ? { ...c, credentials, status: 'connected' as StatusType } : c)
    );
    setConfigDialogOpen(false);
  };

  const handleExecuteAction = async () => {
    if (!selectedConnector || !selectedAction) return;
    setExecuting(true);
    
    // Simulate action execution
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Example result
    const result = {
      success: true,
      data: {
        action: selectedAction.name,
        connector: selectedConnector.name,
        params: actionParams,
        timestamp: new Date().toISOString(),
        result: 'Action completed successfully',
        items: [
          { id: 1, name: 'Item 1' },
          { id: 2, name: 'Item 2' },
          { id: 3, name: 'Item 3' },
        ],
      },
    };
    
    setActionResult(result);
    setExecuting(false);
    setActionDialogOpen(false);
    setResultDialogOpen(true);
  };

  const handleFieldChange = useCallback((key: string, value: string | boolean | number) => {
    setCredentials(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleParamChange = useCallback((key: string, value: string | boolean | number) => {
    setActionParams(prev => ({ ...prev, [key]: value }));
  }, []);

  const copyResult = async () => {
    if (actionResult) {
      await navigator.clipboard.writeText(JSON.stringify(actionResult.data, null, 2));
    }
  };

  return (
    <Panel>
      <PanelHeader
        title="Connectors"
        icon={<ExtensionIcon sx={{ color: 'primary.main' }} />}
        onRefresh={() => setLoading(true)}
        refreshing={loading}
      />

      <Box sx={{ flex: 1, overflow: 'auto', p: 1.5 }}>
        {connectors.length === 0 ? (
          <EmptyState
            icon={<ExtensionIcon sx={{ fontSize: 40 }} />}
            title="No connectors available"
            description="Add connectors to integrate with external services"
          />
        ) : (
          <Stack spacing={1.5}>
            {connectors.map(connector => (
              <ConnectorCard
                key={connector.id}
                connector={connector}
                onConfigure={() => handleConfigure(connector)}
                onConnect={() => handleConnect(connector.id)}
                onDisconnect={() => handleDisconnect(connector.id)}
                onActionSelect={(actionId) => handleActionSelect(connector, actionId)}
                busy={busyIds.has(connector.id)}
              />
            ))}
          </Stack>
        )}
      </Box>

      {/* Configure Dialog */}
      <Dialog
        open={configDialogOpen}
        onClose={() => setConfigDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          Configure {selectedConnector?.name}
          <IconButton size="small" onClick={() => setConfigDialogOpen(false)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {selectedConnector && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              {selectedConnector.configFields.map(field => (
                <FormField
                  key={field.key}
                  field={field}
                  value={credentials[field.key] ?? ''}
                  onChange={handleFieldChange}
                />
              ))}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfigDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveCredentials}>
            Save & Connect
          </Button>
        </DialogActions>
      </Dialog>

      {/* Action Input Dialog */}
      <Dialog
        open={actionDialogOpen}
        onClose={() => setActionDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <PlayArrowIcon sx={{ color: 'primary.main' }} />
            <span>{selectedAction?.name}</span>
          </Stack>
          <IconButton size="small" onClick={() => setActionDialogOpen(false)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {selectedAction && (
            <Box sx={{ mt: 1 }}>
              {selectedAction.description && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {selectedAction.description}
                </Typography>
              )}
              <Alert severity="info" sx={{ mb: 2 }}>
                This action has no additional input parameters.
              </Alert>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setActionDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleExecuteAction}
            disabled={executing}
            startIcon={executing ? <CircularProgress size={14} /> : <PlayArrowIcon />}
          >
            {executing ? 'Executing…' : 'Execute'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Result Dialog */}
      <Dialog
        open={resultDialogOpen}
        onClose={() => setResultDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <DescriptionIcon sx={{ color: 'primary.main' }} />
            <span>{selectedAction?.name} Result</span>
          </Stack>
          <Stack direction="row" spacing={1}>
            <Tooltip title="Copy to clipboard">
              <IconButton size="small" onClick={copyResult}>
                <ContentCopyIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <IconButton size="small" onClick={() => setResultDialogOpen(false)}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          {actionResult && (
            <Box
              sx={{
                bgcolor: 'grey.900',
                maxHeight: 400,
                overflow: 'auto',
              }}
            >
              <Box
                component="pre"
                sx={{
                  m: 0,
                  p: 2,
                  fontSize: '0.75rem',
                  fontFamily: '"SF Mono", "Fira Code", monospace',
                  color: actionResult.success ? '#e0e0e0' : '#ef9a9a',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {JSON.stringify(actionResult.data, null, 2)}
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResultDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Panel>
  );
}
