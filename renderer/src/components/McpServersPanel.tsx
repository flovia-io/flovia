/**
 * McpServersPanel — Sidebar panel for downloading & managing MCP servers.
 *
 * Users can browse a built-in catalog, install servers (npm), connect/disconnect,
 * and view tools + resources exposed by each server.
 * 
 * Fully refactored to use Material UI components.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Button,
  Card,
  CardContent,
  Stack,
  Collapse,
  TextField,
  Alert,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Avatar,
  Divider,
  Tooltip,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import BuildIcon from '@mui/icons-material/Build';
import DescriptionIcon from '@mui/icons-material/Description';
import HubIcon from '@mui/icons-material/Hub';
import { useBackend } from '../context/BackendContext';
import type { McpServerConfig, McpRegistryEntry } from '../types/mcp.types';
import { Panel, PanelHeader, StatusIndicator, EmptyState } from './mui';
import type { StatusType } from './mui/StatusIndicator';

// ── Built-in catalog of popular MCP servers ──────────────────────────────────

const CATALOG: McpRegistryEntry[] = [
  {
    id: 'filesystem',
    name: 'Filesystem',
    npmPackage: '@modelcontextprotocol/server-filesystem',
    description: 'Read, write, and search files on the local filesystem.',
    category: 'Utilities',
    icon: '📁',
  },
  {
    id: 'brave-search',
    name: 'Brave Search',
    npmPackage: '@modelcontextprotocol/server-brave-search',
    description: 'Web search via the Brave Search API.',
    category: 'Search',
    icon: '🔍',
  },
  {
    id: 'github',
    name: 'GitHub',
    npmPackage: '@modelcontextprotocol/server-github',
    description: 'Interact with GitHub repos, issues, PRs and more.',
    category: 'Developer',
    icon: '🐙',
  },
  {
    id: 'memory',
    name: 'Memory',
    npmPackage: '@modelcontextprotocol/server-memory',
    description: 'Persistent key-value memory for AI agents.',
    category: 'Utilities',
    icon: '🧠',
  },
  {
    id: 'postgres',
    name: 'PostgreSQL',
    npmPackage: '@modelcontextprotocol/server-postgres',
    description: 'Query and manage PostgreSQL databases.',
    category: 'Database',
    icon: '🐘',
  },
  {
    id: 'slack',
    name: 'Slack',
    npmPackage: '@modelcontextprotocol/server-slack',
    description: 'Read and send messages in Slack workspaces.',
    category: 'Communication',
    icon: '💬',
  },
  {
    id: 'fetch',
    name: 'Fetch',
    npmPackage: '@modelcontextprotocol/server-fetch',
    description: 'Fetch URLs and extract content from web pages.',
    category: 'Utilities',
    icon: '🌐',
  },
  {
    id: 'puppeteer',
    name: 'Puppeteer',
    npmPackage: '@modelcontextprotocol/server-puppeteer',
    description: 'Browser automation with headless Chrome.',
    category: 'Browser',
    icon: '🎭',
  },
];

// ── Helper to map server status to StatusIndicator type ──
const mapStatus = (status: McpServerConfig['status']): StatusType => {
  const map: Record<string, StatusType> = {
    connected: 'connected',
    installed: 'installed',
    installing: 'installing',
    connecting: 'connecting',
    error: 'error',
    stopped: 'stopped',
    'not-installed': 'not-installed',
  };
  return map[status] || 'disconnected';
};

// ── Main component ───────────────────────────────────────────────────────────

export default function McpServersPanel() {
  const backend = useBackend();
  const [servers, setServers] = useState<McpServerConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [customDialogOpen, setCustomDialogOpen] = useState(false);
  const [customPkg, setCustomPkg] = useState('');
  const [customName, setCustomName] = useState('');
  const [expandedServer, setExpandedServer] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  // ── Load servers on mount ──
  const loadServers = useCallback(async () => {
    setLoading(true);
    try {
      const result = await backend.mcpLoadServers();
      setServers(result.servers || []);
    } catch (err: unknown) {
      setError(`Failed to load servers: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [backend]);

  useEffect(() => { loadServers(); }, [loadServers]);

  // ── Helpers ──

  const setBusy = (id: string, busy: boolean) => {
    setBusyIds(prev => {
      const next = new Set(prev);
      busy ? next.add(id) : next.delete(id);
      return next;
    });
  };

  const addFromCatalog = async (entry: McpRegistryEntry) => {
    if (servers.some(s => s.id === entry.id)) return;

    const config: McpServerConfig = {
      id: entry.id,
      name: entry.name,
      npmPackage: entry.npmPackage,
      status: 'not-installed',
      addedAt: new Date().toISOString(),
    };

    setServers(prev => [...prev, config]);
    setBusy(entry.id, true);
    setError(null);
    setCatalogOpen(false);

    try {
      const result = await backend.mcpInstallServer(config);
      if (result.success && result.server) {
        setServers(prev => prev.map(s => s.id === entry.id ? result.server : s));
      } else {
        setServers(prev => prev.map(s => s.id === entry.id ? { ...s, status: 'error', lastError: result.error } : s));
        setError(result.error || 'Install failed');
      }
    } catch (err: unknown) {
      setServers(prev => prev.map(s => s.id === entry.id ? { ...s, status: 'error', lastError: (err as Error).message } : s));
      setError((err as Error).message);
    } finally {
      setBusy(entry.id, false);
    }
  };

  const addCustomServer = async () => {
    if (!customPkg.trim()) return;
    const id = customPkg.replace(/[@/]/g, '-').replace(/^-+|-+$/g, '').toLowerCase();
    if (servers.some(s => s.id === id)) { setError('Server already added'); return; }

    const config: McpServerConfig = {
      id,
      name: customName.trim() || customPkg.split('/').pop() || customPkg,
      npmPackage: customPkg.trim(),
      status: 'not-installed',
      addedAt: new Date().toISOString(),
    };

    setServers(prev => [...prev, config]);
    setCustomDialogOpen(false);
    setCustomPkg('');
    setCustomName('');
    setBusy(id, true);
    setError(null);

    try {
      const result = await backend.mcpInstallServer(config);
      if (result.success && result.server) {
        setServers(prev => prev.map(s => s.id === id ? result.server : s));
      } else {
        setServers(prev => prev.map(s => s.id === id ? { ...s, status: 'error', lastError: result.error } : s));
        setError(result.error || 'Install failed');
      }
    } catch (err: unknown) {
      setServers(prev => prev.map(s => s.id === id ? { ...s, status: 'error', lastError: (err as Error).message } : s));
      setError((err as Error).message);
    } finally {
      setBusy(id, false);
    }
  };

  const connectServer = async (id: string) => {
    setBusy(id, true);
    setError(null);
    setServers(prev => prev.map(s => s.id === id ? { ...s, status: 'connecting' } : s));

    try {
      const result = await backend.mcpConnectServer(id);
      if (result.success && result.server) {
        setServers(prev => prev.map(s => s.id === id ? result.server! : s));
      } else {
        setServers(prev => prev.map(s => s.id === id ? { ...s, status: 'error', lastError: result.error } : s));
        setError(result.error || 'Connect failed');
      }
    } catch (err: unknown) {
      setServers(prev => prev.map(s => s.id === id ? { ...s, status: 'error', lastError: (err as Error).message } : s));
      setError((err as Error).message);
    } finally {
      setBusy(id, false);
    }
  };

  const disconnectServer = async (id: string) => {
    setBusy(id, true);
    try {
      await backend.mcpDisconnectServer(id);
      setServers(prev => prev.map(s => s.id === id ? { ...s, status: 'stopped', tools: undefined, resources: undefined } : s));
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setBusy(id, false);
    }
  };

  const removeServer = async (id: string) => {
    setBusy(id, true);
    try {
      await backend.mcpUninstallServer(id);
      setServers(prev => prev.filter(s => s.id !== id));
      if (expandedServer === id) setExpandedServer(null);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setBusy(id, false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedServer(prev => prev === id ? null : id);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Panel>
      <PanelHeader
        title="MCP Servers"
        icon={<HubIcon sx={{ color: '#7c3aed' }} />}
        onRefresh={loadServers}
        refreshing={loading}
        onAdd={() => setCatalogOpen(true)}
      />

      {/* Error banner */}
      <Collapse in={!!error}>
        <Alert
          severity="error"
          onClose={() => setError(null)}
          sx={{ borderRadius: 0 }}
        >
          {error}
        </Alert>
      </Collapse>

      {/* Server list */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 1.5 }}>
        {servers.length === 0 && !loading ? (
          <EmptyState
            icon={<HubIcon sx={{ fontSize: 40 }} />}
            title="No MCP servers configured"
            description="Click + to browse the catalog or add a custom server"
            action={{ label: 'Browse Catalog', onClick: () => setCatalogOpen(true) }}
          />
        ) : (
          <Stack spacing={1.5}>
            {servers.map(server => {
              const busy = busyIds.has(server.id);
              const expanded = expandedServer === server.id;
              const canConnect = server.status === 'installed' || server.status === 'stopped' || server.status === 'error';
              const canDisconnect = server.status === 'connected';

              return (
                <Card key={server.id} variant="outlined">
                  <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                    {/* Server header */}
                    <Stack
                      direction="row"
                      alignItems="center"
                      spacing={1}
                      onClick={() => toggleExpand(server.id)}
                      sx={{ cursor: 'pointer' }}
                    >
                      <IconButton size="small" sx={{ p: 0.5 }}>
                        {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                      </IconButton>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={600} noWrap>
                          {server.name}
                        </Typography>
                        <StatusIndicator status={mapStatus(server.status)} size="small" />
                      </Box>
                      <Stack direction="row" spacing={0.5} onClick={e => e.stopPropagation()}>
                        {canConnect && (
                          <Tooltip title="Connect">
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => connectServer(server.id)}
                              disabled={busy}
                            >
                              <PlayArrowIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        {canDisconnect && (
                          <Tooltip title="Disconnect">
                            <IconButton
                              size="small"
                              onClick={() => disconnectServer(server.id)}
                              disabled={busy}
                            >
                              <StopIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        <Tooltip title="Remove">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => removeServer(server.id)}
                            disabled={busy}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </Stack>

                    {/* Expanded details */}
                    <Collapse in={expanded}>
                      <Box sx={{ mt: 1.5, pt: 1.5, borderTop: 1, borderColor: 'divider' }}>
                        <Typography variant="caption" color="text.secondary">
                          Package: <code>{server.npmPackage}</code>
                        </Typography>

                        {server.lastError && (
                          <Alert severity="error" sx={{ mt: 1, py: 0.5 }}>
                            {server.lastError}
                          </Alert>
                        )}

                        {/* Tools */}
                        {server.tools && server.tools.length > 0 && (
                          <Box sx={{ mt: 1.5 }}>
                            <Stack direction="row" alignItems="center" spacing={0.5}>
                              <BuildIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                              <Typography variant="caption" fontWeight={600}>
                                Tools ({server.tools.length})
                              </Typography>
                            </Stack>
                            <List dense disablePadding sx={{ mt: 0.5 }}>
                              {server.tools.map(tool => (
                                <ListItem key={tool.name} disablePadding sx={{ py: 0.25 }}>
                                  <ListItemText
                                    primary={tool.name}
                                    secondary={tool.description}
                                    primaryTypographyProps={{ variant: 'caption', fontWeight: 500 }}
                                    secondaryTypographyProps={{ variant: 'caption' }}
                                  />
                                </ListItem>
                              ))}
                            </List>
                          </Box>
                        )}

                        {/* Resources */}
                        {server.resources && server.resources.length > 0 && (
                          <Box sx={{ mt: 1.5 }}>
                            <Stack direction="row" alignItems="center" spacing={0.5}>
                              <DescriptionIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                              <Typography variant="caption" fontWeight={600}>
                                Resources ({server.resources.length})
                              </Typography>
                            </Stack>
                            <List dense disablePadding sx={{ mt: 0.5 }}>
                              {server.resources.map(res => (
                                <ListItem key={res.uri} disablePadding sx={{ py: 0.25 }}>
                                  <ListItemText
                                    primary={res.name}
                                    secondary={res.description}
                                    primaryTypographyProps={{ variant: 'caption', fontWeight: 500 }}
                                    secondaryTypographyProps={{ variant: 'caption' }}
                                  />
                                </ListItem>
                              ))}
                            </List>
                          </Box>
                        )}

                        {server.status === 'connected' && 
                         (!server.tools || server.tools.length === 0) && 
                         (!server.resources || server.resources.length === 0) && (
                          <Typography variant="caption" color="text.disabled" sx={{ mt: 1, display: 'block' }}>
                            No tools or resources exposed by this server.
                          </Typography>
                        )}
                      </Box>
                    </Collapse>
                  </CardContent>
                </Card>
              );
            })}
          </Stack>
        )}
      </Box>

      {/* Catalog Dialog */}
      <Dialog
        open={catalogOpen}
        onClose={() => setCatalogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          Server Catalog
          <Button size="small" onClick={() => { setCatalogOpen(false); setCustomDialogOpen(true); }}>
            Custom npm…
          </Button>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1}>
            {CATALOG.map(entry => {
              const alreadyAdded = servers.some(s => s.id === entry.id);
              return (
                <Card key={entry.id} variant="outlined">
                  <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Stack direction="row" spacing={1.5} alignItems="flex-start">
                      <Avatar sx={{ width: 32, height: 32, bgcolor: 'grey.100', fontSize: '1rem' }}>
                        {entry.icon}
                      </Avatar>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Typography variant="body2" fontWeight={600}>
                            {entry.name}
                          </Typography>
                          <Chip
                            label={entry.category}
                            size="small"
                            variant="outlined"
                            sx={{ fontSize: '0.65rem', height: 18 }}
                          />
                        </Stack>
                        <Typography variant="caption" color="text.secondary">
                          {entry.description}
                        </Typography>
                      </Box>
                      <Button
                        size="small"
                        variant={alreadyAdded ? 'text' : 'contained'}
                        onClick={() => addFromCatalog(entry)}
                        disabled={alreadyAdded || busyIds.has(entry.id)}
                        sx={{ minWidth: 80 }}
                      >
                        {alreadyAdded ? '✓ Added' : 'Install'}
                      </Button>
                    </Stack>
                  </CardContent>
                </Card>
              );
            })}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCatalogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Custom Server Dialog */}
      <Dialog
        open={customDialogOpen}
        onClose={() => setCustomDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Add Custom MCP Server</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              fullWidth
              size="small"
              label="NPM Package"
              placeholder="e.g. @org/server-name"
              value={customPkg}
              onChange={e => setCustomPkg(e.target.value)}
            />
            <TextField
              fullWidth
              size="small"
              label="Display Name (optional)"
              placeholder="My Server"
              value={customName}
              onChange={e => setCustomName(e.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCustomDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={addCustomServer}
            disabled={!customPkg.trim()}
          >
            Install
          </Button>
        </DialogActions>
      </Dialog>
    </Panel>
  );
}
