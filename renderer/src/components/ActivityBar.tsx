/**
 * ActivityBar - Vertical icon bar for switching sidebar panels
 * 
 * Refactored to use Material UI components.
 */
import { useState, useEffect } from 'react';
import { Box, IconButton, Badge, Tooltip, Divider, Stack } from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import SearchIcon from '@mui/icons-material/Search';
import GitHubIcon from '@mui/icons-material/GitHub';
import TerminalIcon from '@mui/icons-material/Terminal';
import TuneIcon from '@mui/icons-material/Tune';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import StorageIcon from '@mui/icons-material/Storage';
import HubIcon from '@mui/icons-material/Hub';
import EmailIcon from '@mui/icons-material/Email';
import WaterDropIcon from '@mui/icons-material/WaterDrop';
import ExtensionIcon from '@mui/icons-material/Extension';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import { useWorkspace } from '../context/WorkspaceContext';
import { useBackend } from '../context/BackendContext';
import type { SidePanel } from '../types';
import PromptSettingsModal from './PromptSettingsModal';
import {
  GitIcon,
  NpmIcon,
  SupabaseIcon,
  DatabaseIcon,
} from './icons';

// GitHub Actions Icon
const ActionsIcon = () => (
  <svg width={18} height={18} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
  </svg>
);

// Atlassian Icon
const AtlassianIcon = () => (
  <svg width={18} height={18} viewBox="0 0 24 24" fill="currentColor">
    <path d="M7.12 11.084c-.294-.375-.75-.349-1.001.074L.609 21.137c-.252.424-.053.768.44.768h6.96c.246 0 .56-.2.69-.442.892-1.632.628-5.145-1.579-10.379zM11.614 1.088c-2.886 5.14-2.479 9.122-.496 12.735.193.353.514.546.83.546H18.3c.493 0 .695-.346.44-.769L12.615 1.161c-.25-.422-.703-.447-1.001-.073z"/>
  </svg>
);

// Copilot Icon
const CopilotIcon = () => (
  <svg width={18} height={18} viewBox="0 0 24 24" fill="currentColor">
    <path d="M9.75 14a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5a.75.75 0 0 1 .75-.75Zm4.5 0a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5a.75.75 0 0 1 .75-.75Z"/>
    <path d="M12 2c2.214 0 4.248.657 5.747 1.756.136.099.268.204.397.312.584.235 1.077.546 1.474.952.85.87 1.132 2.037 1.132 3.368 0 .368-.014.733-.052 1.086l.633 1.478.043.022A4.75 4.75 0 0 1 24 15.222v1.028c0 .529-.309.987-.565 1.293-.28.336-.636.653-.966.918-.654.528-1.449.98-2.119 1.211-.36.125-.757.228-1.143.303C18.137 21.303 15.895 22 12 22s-6.137-.697-7.207-2.025a6.126 6.126 0 0 1-1.143-.303c-.67-.23-1.465-.683-2.119-1.211-.33-.265-.686-.582-.966-.918C.309 17.237 0 16.779 0 16.25v-1.028a4.75 4.75 0 0 1 2.626-4.248l.043-.022.633-1.478a10.195 10.195 0 0 1-.052-1.086c0-1.331.282-2.498 1.132-3.368.397-.406.89-.717 1.474-.952.129-.108.261-.213.397-.312C7.752 2.657 9.786 2 12 2Zm-8 9.654v6.669a17.59 17.59 0 0 0 2.073.98c.31.107.596.195.847.253a9.89 9.89 0 0 1-.12-.654c-.104-.676-.177-1.466-.177-2.343v-1.043c-.627-.416-1.073-.836-1.373-1.21-.338-.422-.594-.906-.75-1.35-.087-.25-.153-.503-.2-.702a8.146 8.146 0 0 1-.1-.573Zm16 0-.2.702c-.087.25-.153.503-.2.702-.156.444-.412.928-.75 1.35-.3.374-.746.794-1.373 1.21v1.043c0 .877-.073 1.667-.177 2.343a9.89 9.89 0 0 1-.12.654c.251-.058.537-.146.847-.253a17.59 17.59 0 0 0 2.073-.98v-6.669Z"/>
  </svg>
);

// Active indicator styling constants
const ACTIVE_INDICATOR = {
  top: 8,
  bottom: 8,
  width: 2,
};

// Panel configuration
interface PanelConfig {
  id: SidePanel;
  label: string;
  icon: React.ReactNode;
  gitOnly?: boolean;
  npmOnly?: boolean;
}

const panels: PanelConfig[] = [
  { id: 'explorer', label: 'Explorer', icon: <FolderIcon fontSize="small" /> },
  { id: 'search', label: 'Search', icon: <SearchIcon fontSize="small" /> },
  { id: 'source-control', label: 'Source Control', icon: <GitIcon size={18} />, gitOnly: true },
  { id: 'npm', label: 'NPM Scripts', icon: <NpmIcon size={18} />, npmOnly: true },
  { id: 'copilot', label: 'GitHub Copilot', icon: <CopilotIcon /> },
  { id: 'supabase', label: 'Supabase', icon: <SupabaseIcon size={18} /> },
  { id: 'database', label: 'Database', icon: <DatabaseIcon size={18} /> },
  { id: 'github', label: 'GitHub Actions', icon: <ActionsIcon />, gitOnly: true },
  { id: 'atlassian', label: 'Atlassian', icon: <AtlassianIcon /> },
  { id: 'gmail', label: 'Gmail', icon: <EmailIcon fontSize="small" sx={{ color: '#EA4335' }} /> },
  { id: 'digitalocean', label: 'DigitalOcean', icon: <WaterDropIcon fontSize="small" sx={{ color: '#0080FF' }} /> },
  { id: 'mcp', label: 'MCP Servers', icon: <HubIcon fontSize="small" sx={{ color: '#7c3aed' }} /> },
];

interface ActivityBarProps {
  onToggleTerminal?: () => void;
  terminalVisible?: boolean;
}

export default function ActivityBar({ onToggleTerminal, terminalVisible }: ActivityBarProps) {
  const { activePanel, setActivePanel, hasGit, npmProjects, gitSplitChanges, openAgentsTab, openWorkflowEditor, openDebugTraceTab } = useWorkspace();
  const backend = useBackend();
  const [promptSettingsOpen, setPromptSettingsOpen] = useState(false);

  // Listen for menu-triggered open prompts
  useEffect(() => {
    const cleanup = backend.onOpenPrompts(() => {
      setPromptSettingsOpen(true);
    });
    return cleanup;
  }, []);

  // Listen for menu-triggered open debug — now opens inline debug trace tab
  useEffect(() => {
    const cleanup = backend.onOpenDebug(async () => {
      try {
        openDebugTraceTab();
      } catch (err) {
        console.error('Failed to open debug trace tab:', err);
      }
    });
    return cleanup;
  }, [openDebugTraceTab]);

  // Listen for menu-triggered open agents
  useEffect(() => {
    const cleanup = backend.onOpenAgents(() => {
      openAgentsTab();
    });
    return cleanup;
  }, [openAgentsTab]);

  const handleNewWindow = async () => {
    try {
      await backend.newWindow();
    } catch (err) {
      console.error('Failed to open new window:', err);
    }
  };

  return (
    <Box
      sx={{
        width: 48,
        minWidth: 48,
        bgcolor: 'grey.100',
        borderRight: 1,
        borderColor: 'divider',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        py: 0.5,
        height: '100%',
      }}
    >
      {/* Main panel buttons */}
      <Stack spacing={0.25} sx={{ flex: 1, alignItems: 'center' }}>
        {panels.map(p => {
          if (p.gitOnly && !hasGit) return null;
          if (p.npmOnly && npmProjects.length === 0) return null;
          
          const isActive = activePanel === p.id;
          const badgeCount = 
            p.id === 'source-control' ? gitSplitChanges.length :
            p.id === 'npm' ? npmProjects.length : 0;

          return (
            <Tooltip key={p.id} title={p.label} placement="right">
              <IconButton
                onClick={() => setActivePanel(p.id)}
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: 1.5,
                  color: isActive ? 'text.primary' : 'text.secondary',
                  bgcolor: isActive ? 'rgba(0,0,0,0.07)' : 'transparent',
                  position: 'relative',
                  '&:hover': {
                    bgcolor: 'rgba(0,0,0,0.05)',
                    color: 'text.primary',
                  },
                  '&::before': isActive ? {
                    content: '""',
                    position: 'absolute',
                    left: 0,
                    top: ACTIVE_INDICATOR.top,
                    bottom: ACTIVE_INDICATOR.bottom,
                    width: ACTIVE_INDICATOR.width,
                    bgcolor: 'text.primary',
                    borderRadius: 1,
                  } : undefined,
                }}
              >
                {badgeCount > 0 ? (
                  <Badge
                    badgeContent={badgeCount}
                    color="default"
                    sx={{
                      '& .MuiBadge-badge': {
                        bgcolor: '#555',
                        color: '#fff',
                        fontSize: '0.6rem',
                        minWidth: 16,
                        height: 16,
                      },
                    }}
                  >
                    {p.icon}
                  </Badge>
                ) : (
                  p.icon
                )}
              </IconButton>
            </Tooltip>
          );
        })}
      </Stack>

      {/* Bottom section */}
      <Divider sx={{ width: '80%', my: 1 }} />
      <Stack spacing={0.25} sx={{ alignItems: 'center', pb: 0.5 }}>
        {/* Terminal toggle */}
        {onToggleTerminal && (
          <Tooltip title="Terminal" placement="right">
            <IconButton
              onClick={onToggleTerminal}
              sx={{
                width: 40,
                height: 40,
                borderRadius: 1.5,
                color: terminalVisible ? 'text.primary' : 'text.secondary',
                bgcolor: terminalVisible ? 'rgba(0,0,0,0.07)' : 'transparent',
                '&:hover': {
                  bgcolor: 'rgba(0,0,0,0.05)',
                  color: 'text.primary',
                },
              }}
            >
              <TerminalIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}

        {/* Agent Prompts */}
        <Tooltip title="Agent Prompts" placement="right">
          <IconButton
            onClick={() => setPromptSettingsOpen(true)}
            sx={{
              width: 40,
              height: 40,
              borderRadius: 1.5,
              color: 'text.secondary',
              '&:hover': {
                bgcolor: 'rgba(0,0,0,0.05)',
                color: 'text.primary',
              },
            }}
          >
            <TuneIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        {/* Workflow Editor */}
        <Tooltip title="Workflow Editor" placement="right">
          <IconButton
            onClick={() => openWorkflowEditor()}
            sx={{
              width: 40,
              height: 40,
              borderRadius: 1.5,
              color: 'text.secondary',
              '&:hover': {
                bgcolor: 'rgba(0,0,0,0.05)',
                color: 'text.primary',
              },
            }}
          >
            <AccountTreeIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        {/* AI Debug Trace */}
        <Tooltip title="AI Debug — view all agent calls" placement="right">
          <IconButton
            onClick={() => openDebugTraceTab()}
            sx={{
              width: 40,
              height: 40,
              borderRadius: 1.5,
              color: 'text.secondary',
              '&:hover': {
                bgcolor: 'rgba(0,0,0,0.05)',
                color: 'text.primary',
              },
            }}
          >
            <span style={{ fontSize: 18 }}>🐛</span>
          </IconButton>
        </Tooltip>

        {/* New Window */}
        <Tooltip title="New Window" placement="right">
          <IconButton
            onClick={handleNewWindow}
            sx={{
              width: 40,
              height: 40,
              borderRadius: 1.5,
              color: 'text.secondary',
              '&:hover': {
                bgcolor: 'rgba(0,0,0,0.05)',
                color: 'text.primary',
              },
            }}
          >
            <OpenInNewIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>

      <PromptSettingsModal 
        isOpen={promptSettingsOpen} 
        onClose={() => setPromptSettingsOpen(false)} 
      />
    </Box>
  );
}
