/**
 * Sidebar - Main sidebar container that switches between different panels
 * 
 * Refactored to use Material UI components.
 */
import { Box, Typography, Button, IconButton, Tooltip, Chip } from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import { useWorkspace } from '../context/WorkspaceContext';
import FileTree from './FileTree';
import SearchPanel from './SearchPanel';
import SourceControlPanel from './SourceControlPanel';
import NpmPanel from './NpmPanel';
import SupabasePanel from './SupabasePanel';
import DatabasePanel from './DatabasePanel';
import GitHubActionsTab from './GitHubActionsTab';
import AtlassianPanel from './AtlassianPanel';
import McpServersPanel from './McpServersPanel';
import CliProvidersPanel from './CliProvidersPanel';
import GmailPanel from './GmailPanel';
import DigitalOceanPanel from './DigitalOceanPanel';
import ExplorerGitControls from './ExplorerGitControls';
import { Panel, PanelHeader } from './mui';

interface SidebarProps {
  onCollapse?: () => void;
}

export default function Sidebar({ onCollapse }: SidebarProps) {
  const { importFolder, folderName, folderPath, tree, activePanel } = useWorkspace();

  // Render different panels based on activePanel
  if (activePanel === 'search') return <SearchPanel />;
  if (activePanel === 'source-control') return <SourceControlPanel />;
  if (activePanel === 'npm') return <NpmPanel />;
  if (activePanel === 'supabase') return <SupabasePanel />;
  if (activePanel === 'database') return <DatabasePanel />;
  if (activePanel === 'github') return <GitHubActionsTab />;
  if (activePanel === 'atlassian') return <AtlassianPanel />;
  if (activePanel === 'mcp') return <McpServersPanel />;
  if (activePanel === 'copilot') return <CliProvidersPanel />;
  if (activePanel === 'gmail') return <GmailPanel />;
  if (activePanel === 'digitalocean') return <DigitalOceanPanel />;

  // Default: Explorer panel
  return (
    <Panel>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 1.5,
          py: 1,
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <FolderIcon fontSize="small" sx={{ color: 'primary.main' }} />
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Explorer
          </Typography>
        </Box>
        {onCollapse && (
          <Tooltip title="Collapse sidebar">
            <IconButton size="small" onClick={onCollapse} sx={{ color: 'text.secondary' }}>
              <ChevronLeftIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {/* Import folder action */}
      <Box sx={{ p: 1 }}>
        <Button
          variant="outlined"
          fullWidth
          startIcon={<FolderOpenIcon />}
          onClick={importFolder}
          sx={{
            borderStyle: 'dashed',
            color: 'text.secondary',
            borderColor: 'divider',
            '&:hover': {
              borderStyle: 'dashed',
              borderColor: 'grey.400',
              bgcolor: 'rgba(0,0,0,0.02)',
            },
          }}
        >
          Import Folder
        </Button>
      </Box>

      {/* Folder name */}
      {folderName && (
        <Box
          sx={{
            px: 1.5,
            py: 0.75,
            bgcolor: 'rgba(0,0,0,0.02)',
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <Chip
            icon={<FolderIcon fontSize="small" />}
            label={folderName}
            size="small"
            variant="outlined"
            sx={{
              maxWidth: '100%',
              '& .MuiChip-label': {
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              },
            }}
          />
        </Box>
      )}

      {/* Git controls */}
      <ExplorerGitControls />

      {/* File tree */}
      <Box sx={{ flex: 1, overflow: 'auto', py: 0.5 }}>
        <FileTree items={tree} depth={0} folderPath={folderPath || undefined} />
      </Box>
    </Panel>
  );
}
