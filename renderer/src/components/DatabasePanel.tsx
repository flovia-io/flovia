/**
 * DatabasePanel — Database explorer with support for multiple database types.
 * Auto-detects Supabase projects and uses them as PostgreSQL connections.
 *
 * Refactored to use MUI components and shared abstractions instead of raw HTML+CSS.
 */
import { useState, useEffect, useMemo } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';

import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import StorageIcon from '@mui/icons-material/Storage';
import RefreshIcon from '@mui/icons-material/Refresh';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import TableChartIcon from '@mui/icons-material/TableChart';
import DescriptionIcon from '@mui/icons-material/Description';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import LinkIcon from '@mui/icons-material/Link';
import LinkOffIcon from '@mui/icons-material/LinkOff';

import { useWorkspace } from '../context/WorkspaceContext';
import { useBackend } from '../context/BackendContext';
import { SupabaseIcon } from './icons';

/* ─── Types ─── */
type DatabaseType = 'postgresql' | 'mysql' | 'sqlite' | 'mongodb' | 'none';

interface SqlFile {
  name: string;
  path: string;
}

interface TableInfo {
  name: string;
  schema: string;
  rowCount?: number;
}

/* ─── Database type options ─── */
const DATABASE_TYPES: { id: DatabaseType; name: string; icon: string }[] = [
  { id: 'postgresql', name: 'PostgreSQL', icon: '🐘' },
  { id: 'mysql', name: 'MySQL', icon: '🐬' },
  { id: 'sqlite', name: 'SQLite', icon: '📁' },
  { id: 'mongodb', name: 'MongoDB', icon: '🍃' },
];

/* ─── Helpers ─── */

/** Recursively find .sql files in the workspace tree */
function findSqlFiles(
  tree: Array<{ name: string; path: string; type: string; children?: Array<unknown> }>,
  basePath = '',
): SqlFile[] {
  const result: SqlFile[] = [];
  for (const entry of tree) {
    const fullPath = basePath ? `${basePath}/${entry.name}` : entry.name;
    if (entry.type === 'file' && entry.name.endsWith('.sql')) {
      result.push({ name: entry.name, path: entry.path });
    }
    if (entry.children && Array.isArray(entry.children)) {
      result.push(
        ...findSqlFiles(
          entry.children as Array<{ name: string; path: string; type: string; children?: Array<unknown> }>,
          fullPath,
        ),
      );
    }
  }
  return result;
}

/* ─── Collapsible section ─── */
interface AccordionSectionProps {
  title: string;
  icon: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  disabled?: boolean;
  badge?: number;
  children: React.ReactNode;
}

function AccordionSection({ title, icon, open, onToggle, disabled, badge, children }: AccordionSectionProps) {
  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden', opacity: disabled ? 0.5 : 1 }}>
      <Box
        onClick={disabled ? undefined : onToggle}
        sx={{
          display: 'flex', alignItems: 'center', gap: 1,
          px: 1.5, py: 1, cursor: disabled ? 'default' : 'pointer',
          bgcolor: '#fafafa',
          '&:hover': disabled ? {} : { bgcolor: '#f0f0f0' },
          transition: 'background 0.15s',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', fontSize: '1rem' }}>{icon}</Box>
        <Typography sx={{ fontWeight: 600, fontSize: '0.82rem', flex: 1, color: '#1a1a2e' }}>
          {title}
        </Typography>
        {badge != null && badge > 0 && (
          <Chip label={badge} size="small" sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700 }} />
        )}
        {open ? <ExpandMoreIcon sx={{ fontSize: 18, color: '#9e9e9e' }} /> : <ChevronRightIcon sx={{ fontSize: 18, color: '#9e9e9e' }} />}
      </Box>
      <Collapse in={open && !disabled}>
        <Box sx={{ px: 1.5, pb: 1.5, pt: 0.5 }}>{children}</Box>
      </Collapse>
    </Paper>
  );
}

/* ══════════════════════════════════════
   DatabasePanel
   ══════════════════════════════════════ */
export default function DatabasePanel() {
  const { tree, folderPath, openFile, supabaseConfig, openSqlQueryTab } = useWorkspace();
  const backend = useBackend();

  const [selectedDb, setSelectedDb] = useState<DatabaseType>('none');
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['connection', 'sql-files']));
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [isLoadingTables, setIsLoadingTables] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [queryInput, setQueryInput] = useState('SELECT * FROM ');
  const [showQueryInput, setShowQueryInput] = useState(false);

  /* ── Derived ── */
  const isSupabaseDetected = supabaseConfig?.detected && supabaseConfig?.projectUrl;
  const isConnected = Boolean(isSupabaseDetected);

  /* Auto-select PostgreSQL when Supabase is detected */
  useEffect(() => {
    if (isSupabaseDetected) setSelectedDb('postgresql');
  }, [isSupabaseDetected]);

  /* SQL files from the workspace tree */
  const sqlFiles = useMemo(() => {
    if (!tree || tree.length === 0) return [];
    return findSqlFiles(tree as Array<{ name: string; path: string; type: string; children?: Array<unknown> }>);
  }, [tree]);

  /* ── Fetch tables ── */
  const fetchTables = async () => {
    if (!supabaseConfig?.projectUrl || !supabaseConfig?.serviceRoleKey) {
      setConnectionError('Missing Supabase credentials');
      return;
    }
    setIsLoadingTables(true);
    setConnectionError(null);
    try {
      const result = await backend.supabaseGetTables(supabaseConfig.projectUrl, supabaseConfig.serviceRoleKey);
      if (result.success) {
        setTables(result.tables.map((t: { table_name: string; table_schema: string }) => ({ name: t.table_name, schema: t.table_schema })));
      } else {
        setConnectionError(result.error || 'Failed to fetch tables');
      }
    } catch (err) {
      setConnectionError(err instanceof Error ? err.message : 'Failed to fetch tables');
    } finally {
      setIsLoadingTables(false);
    }
  };

  /* Auto-load tables when Supabase connected */
  useEffect(() => {
    if (isSupabaseDetected && supabaseConfig?.serviceRoleKey) fetchTables();
  }, [isSupabaseDetected, supabaseConfig?.serviceRoleKey]);

  const toggleSection = (section: string) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      next.has(section) ? next.delete(section) : next.add(section);
      return next;
    });
  };

  const openSupabaseDashboard = () => {
    if (supabaseConfig?.projectRef) {
      window.open(`https://supabase.com/dashboard/project/${supabaseConfig.projectRef}`, '_blank');
    }
  };

  /* ══════════════════════════════
     Render
     ══════════════════════════════ */
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1.25, borderBottom: '1px solid #e0e0e0' }}>
        <StorageIcon sx={{ fontSize: 20, color: '#1976d2' }} />
        <Typography sx={{ fontWeight: 700, fontSize: '0.92rem', color: '#1a1a2e' }}>Database</Typography>
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, overflowY: 'auto', p: 1.5 }}>
        <Stack spacing={1.5}>
          {/* ── Connection ── */}
          <AccordionSection
            title="Connection"
            icon={isSupabaseDetected ? <SupabaseIcon size={16} /> : <LinkIcon sx={{ fontSize: 16, color: '#9e9e9e' }} />}
            open={openSections.has('connection')}
            onToggle={() => toggleSection('connection')}
          >
            {/* Status chip */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: isConnected ? '#43a047' : '#bdbdbd' }} />
              <Typography sx={{ fontSize: '0.76rem', fontWeight: 600, color: isConnected ? '#2e7d32' : '#9e9e9e' }}>
                {isConnected ? 'Connected via Supabase' : 'Not Connected'}
              </Typography>
            </Box>

            {isSupabaseDetected ? (
              <Stack spacing={1.5}>
                {/* Supabase card */}
                <Paper variant="outlined" sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, borderRadius: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 1, bgcolor: '#e8f5e9' }}>
                    <SupabaseIcon size={20} />
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography sx={{ fontWeight: 600, fontSize: '0.8rem' }}>
                      {supabaseConfig?.projectRef || 'Supabase Project'}
                    </Typography>
                    <Typography sx={{ fontSize: '0.66rem', color: '#9e9e9e' }}>PostgreSQL</Typography>
                  </Box>
                </Paper>

                {supabaseConfig?.projectRef && (
                  <Button
                    variant="outlined"
                    size="small"
                    endIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
                    onClick={openSupabaseDashboard}
                    sx={{ textTransform: 'none', fontSize: '0.72rem' }}
                  >
                    Open Dashboard
                  </Button>
                )}

                {!supabaseConfig?.serviceRoleKey && (
                  <Alert severity="warning" icon={<WarningAmberIcon fontSize="small" />} sx={{ fontSize: '0.72rem' }}>
                    Add <code>SUPABASE_SERVICE_ROLE_KEY</code> to your <code>.env</code> file to enable full database access.
                  </Alert>
                )}
              </Stack>
            ) : (
              <Stack spacing={1.5}>
                <FormControl size="small" fullWidth disabled>
                  <InputLabel>Database Type</InputLabel>
                  <Select value={selectedDb} label="Database Type" onChange={e => setSelectedDb(e.target.value as DatabaseType)}>
                    <MenuItem value="none">Select database type…</MenuItem>
                    {DATABASE_TYPES.map(db => (
                      <MenuItem key={db.id} value={db.id}>{db.icon} {db.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Alert severity="info" icon={<InfoOutlinedIcon fontSize="small" />} sx={{ fontSize: '0.72rem' }}>
                  Database connection coming soon. Configure your connection string to enable database features.
                </Alert>
              </Stack>
            )}
          </AccordionSection>

          {/* ── Tables ── */}
          <AccordionSection
            title="Tables"
            icon={<TableChartIcon sx={{ fontSize: 16, color: '#546e7a' }} />}
            open={openSections.has('tables')}
            onToggle={() => toggleSection('tables')}
            disabled={!isConnected}
            badge={tables.length || undefined}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography sx={{ fontSize: '0.7rem', color: '#9e9e9e' }}>{tables.length} tables</Typography>
              <Tooltip title="Refresh tables">
                <span>
                  <IconButton
                    size="small"
                    onClick={fetchTables}
                    disabled={!supabaseConfig?.serviceRoleKey || isLoadingTables}
                  >
                    {isLoadingTables
                      ? <CircularProgress size={14} />
                      : <RefreshIcon sx={{ fontSize: 16 }} />}
                  </IconButton>
                </span>
              </Tooltip>
            </Box>

            {connectionError && (
              <Alert severity="error" sx={{ fontSize: '0.72rem', mb: 1 }}>{connectionError}</Alert>
            )}

            {tables.length === 0 && !connectionError ? (
              <Typography sx={{ fontSize: '0.72rem', color: '#bdbdbd', textAlign: 'center', py: 2 }}>
                {supabaseConfig?.serviceRoleKey ? 'Click refresh to load tables' : 'Add service role key to view tables'}
              </Typography>
            ) : (
              <List dense disablePadding>
                {tables.map(table => (
                  <ListItemButton key={`${table.schema}.${table.name}`} sx={{ borderRadius: 1, py: 0.25 }}>
                    <ListItemIcon sx={{ minWidth: 28 }}>
                      <TableChartIcon sx={{ fontSize: 14, color: '#1976d2' }} />
                    </ListItemIcon>
                    <ListItemText
                      primary={table.name}
                      secondary={table.schema}
                      primaryTypographyProps={{ fontSize: '0.76rem', fontWeight: 500 }}
                      secondaryTypographyProps={{ fontSize: '0.6rem' }}
                    />
                  </ListItemButton>
                ))}
              </List>
            )}
          </AccordionSection>

          {/* ── Operations ── */}
          <AccordionSection
            title="Operations"
            icon="⚡"
            open={openSections.has('operations')}
            onToggle={() => toggleSection('operations')}
            disabled={!isConnected}
          >
            <Stack spacing={1}>
              <Button
                variant="outlined"
                size="small"
                fullWidth
                startIcon={<TableChartIcon sx={{ fontSize: 14 }} />}
                onClick={fetchTables}
                disabled={!supabaseConfig?.serviceRoleKey}
                sx={{ textTransform: 'none', fontSize: '0.72rem', justifyContent: 'flex-start' }}
              >
                List Tables
              </Button>

              <Button
                variant="outlined"
                size="small"
                fullWidth
                startIcon={<Typography sx={{ fontSize: '0.9rem' }}>💻</Typography>}
                onClick={() => setShowQueryInput(!showQueryInput)}
                disabled={!supabaseConfig?.serviceRoleKey}
                sx={{ textTransform: 'none', fontSize: '0.72rem', justifyContent: 'flex-start' }}
              >
                Execute Query
              </Button>

              <Collapse in={showQueryInput}>
                <Stack spacing={1} sx={{ mt: 0.5 }}>
                  <TextField
                    multiline
                    rows={3}
                    size="small"
                    fullWidth
                    value={queryInput}
                    onChange={e => setQueryInput(e.target.value)}
                    placeholder="SELECT * FROM table_name"
                    sx={{ '& textarea': { fontFamily: 'monospace', fontSize: '0.72rem' } }}
                  />
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<PlayArrowIcon sx={{ fontSize: 14 }} />}
                    onClick={() => { if (queryInput.trim()) openSqlQueryTab(queryInput.trim()); }}
                    disabled={!queryInput.trim()}
                    sx={{ textTransform: 'none', fontSize: '0.72rem', alignSelf: 'flex-end' }}
                  >
                    Run Query
                  </Button>
                </Stack>
              </Collapse>

              <Button
                variant="outlined"
                size="small"
                fullWidth
                disabled
                startIcon={<Typography sx={{ fontSize: '0.9rem' }}>📊</Typography>}
                sx={{ textTransform: 'none', fontSize: '0.72rem', justifyContent: 'flex-start' }}
              >
                Schema Info
              </Button>
            </Stack>
          </AccordionSection>

          {/* ── SQL Files ── */}
          <AccordionSection
            title="SQL Files"
            icon={<DescriptionIcon sx={{ fontSize: 16, color: '#f57c00' }} />}
            open={openSections.has('sql-files')}
            onToggle={() => toggleSection('sql-files')}
            badge={sqlFiles.length}
          >
            {sqlFiles.length === 0 ? (
              <Typography sx={{ fontSize: '0.72rem', color: '#bdbdbd', textAlign: 'center', py: 2 }}>
                No .sql files found in workspace
              </Typography>
            ) : (
              <List dense disablePadding>
                {sqlFiles.map(file => (
                  <ListItemButton
                    key={file.path}
                    onClick={() => openFile(file.name, file.path)}
                    title={file.path.replace(folderPath || '', '').replace(/^\//, '')}
                    sx={{ borderRadius: 1, py: 0.25, pr: 0.5 }}
                  >
                    <ListItemIcon sx={{ minWidth: 28 }}>
                      <DescriptionIcon sx={{ fontSize: 14, color: '#f57c00' }} />
                    </ListItemIcon>
                    <ListItemText
                      primary={file.name}
                      primaryTypographyProps={{ fontSize: '0.76rem', fontWeight: 500 }}
                    />
                    <Tooltip title={isConnected ? 'Run SQL file' : 'Connect to database to run'}>
                      <span>
                        <IconButton
                          size="small"
                          disabled={!isConnected}
                          onClick={e => { e.stopPropagation(); openFile(file.name, file.path); }}
                        >
                          <PlayArrowIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </ListItemButton>
                ))}
              </List>
            )}
          </AccordionSection>
        </Stack>
      </Box>
    </Box>
  );
}
