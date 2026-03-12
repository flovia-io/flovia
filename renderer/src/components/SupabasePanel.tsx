/**
 * SupabasePanel - Shows Supabase project info and admin features
 * 
 * Refactored to use Material UI components.
 */
import { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Stack,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Card,
  CardContent,
  Avatar,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import StorageIcon from '@mui/icons-material/Storage';
import TableChartIcon from '@mui/icons-material/TableChart';
import CodeIcon from '@mui/icons-material/Code';
import SchemaIcon from '@mui/icons-material/Schema';
import BackupIcon from '@mui/icons-material/Backup';
import PeopleIcon from '@mui/icons-material/People';
import SecurityIcon from '@mui/icons-material/Security';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import EmailIcon from '@mui/icons-material/Email';
import CloudIcon from '@mui/icons-material/Cloud';
import FolderIcon from '@mui/icons-material/Folder';
import LockIcon from '@mui/icons-material/Lock';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import ListAltIcon from '@mui/icons-material/ListAlt';
import KeyIcon from '@mui/icons-material/Key';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import SettingsIcon from '@mui/icons-material/Settings';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { useWorkspace } from '../context/WorkspaceContext';
import { useBackend } from '../context/BackendContext';
import { Panel, PanelHeader, EmptyState } from './mui';

// Supabase icon component
const SupabaseIcon = () => (
  <svg width={20} height={20} viewBox="0 0 109 113" fill="none">
    <path d="M63.7076 110.284C60.8481 113.885 55.0502 111.912 54.9813 107.314L53.9738 40.0627L99.1935 40.0627C107.384 40.0627 111.952 49.5228 106.859 55.9374L63.7076 110.284Z" fill="url(#paint0_linear)"/>
    <path d="M63.7076 110.284C60.8481 113.885 55.0502 111.912 54.9813 107.314L53.9738 40.0627L99.1935 40.0627C107.384 40.0627 111.952 49.5228 106.859 55.9374L63.7076 110.284Z" fill="url(#paint1_linear)" fillOpacity="0.2"/>
    <path d="M45.317 2.07103C48.1765 -1.53037 53.9745 0.442937 54.0434 5.041L54.4849 72.2922H9.83113C1.64038 72.2922 -2.92775 62.8321 2.1655 56.4175L45.317 2.07103Z" fill="#3ECF8E"/>
    <defs>
      <linearGradient id="paint0_linear" x1="53.9738" y1="54.974" x2="94.1635" y2="71.8295" gradientUnits="userSpaceOnUse">
        <stop stopColor="#249361"/>
        <stop offset="1" stopColor="#3ECF8E"/>
      </linearGradient>
      <linearGradient id="paint1_linear" x1="36.1558" y1="30.578" x2="54.4844" y2="65.0806" gradientUnits="userSpaceOnUse">
        <stop/>
        <stop offset="1" stopOpacity="0"/>
      </linearGradient>
    </defs>
  </svg>
);

interface ActionItemProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}

function ActionItem({ icon, title, description, onClick }: ActionItemProps) {
  return (
    <ListItemButton onClick={onClick} sx={{ borderRadius: 1, py: 0.75 }}>
      <ListItemIcon sx={{ minWidth: 36, color: 'text.secondary' }}>
        {icon}
      </ListItemIcon>
      <ListItemText
        primary={title}
        secondary={description}
        primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
        secondaryTypographyProps={{ variant: 'caption' }}
      />
    </ListItemButton>
  );
}

export default function SupabasePanel() {
  const { supabaseConfig, folderPath, openSupabaseTab } = useWorkspace();
  const backend = useBackend();
  const [expanded, setExpanded] = useState<string | false>('project');

  const handleExpand = (panel: string) => (_: React.SyntheticEvent, isExpanded: boolean) => {
    setExpanded(isExpanded ? panel : false);
  };

  if (!supabaseConfig || !supabaseConfig.detected) {
    return (
      <Panel>
        <PanelHeader title="Supabase" icon={<SupabaseIcon />} />
        <Box sx={{ p: 2 }}>
          <EmptyState
            title="No Supabase configuration detected"
            description='Add "supabase" to any .env file in your project to connect.'
            action={{
              label: 'Open Documentation',
              onClick: () => backend.shellOpenExternal('https://supabase.com/docs'),
            }}
          />
          <Stack direction="row" spacing={1} justifyContent="center" sx={{ mt: 2 }}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<MenuBookIcon />}
              onClick={() => backend.shellOpenExternal('https://supabase.com/docs')}
            >
              Docs
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<OpenInNewIcon />}
              onClick={() => backend.shellOpenExternal('https://supabase.com/dashboard')}
            >
              Dashboard
            </Button>
          </Stack>
        </Box>
      </Panel>
    );
  }

  const { projectUrl, projectRef, sourceFile } = supabaseConfig;
  const projectName = projectRef || 'Unknown Project';
  const dashboardUrl = projectRef 
    ? `https://supabase.com/dashboard/project/${projectRef}`
    : 'https://supabase.com/dashboard';

  const openDashboardSection = (section: string) => {
    if (projectRef) {
      backend.shellOpenExternal(`https://supabase.com/dashboard/project/${projectRef}/${section}`);
    }
  };

  return (
    <Panel>
      <PanelHeader title="Supabase" icon={<SupabaseIcon />} />

      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {/* Project Info */}
        <Accordion expanded={expanded === 'project'} onChange={handleExpand('project')}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <StorageIcon fontSize="small" sx={{ color: 'text.secondary' }} />
              <Typography variant="body2" fontWeight={500}>Project</Typography>
            </Stack>
          </AccordionSummary>
          <AccordionDetails>
            <Card variant="outlined" sx={{ mb: 2 }}>
              <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Avatar sx={{ bgcolor: '#3ECF8E', width: 36, height: 36 }}>
                    <SupabaseIcon />
                  </Avatar>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={600} noWrap>
                      {projectName}
                    </Typography>
                    {projectUrl && (
                      <Typography variant="caption" color="text.secondary" noWrap>
                        {projectUrl}
                      </Typography>
                    )}
                  </Box>
                </Stack>
              </CardContent>
            </Card>
            {sourceFile && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                Config: <code>{sourceFile.replace(folderPath || '', '').replace(/^\//, '')}</code>
              </Typography>
            )}
            <Button
              size="small"
              variant="contained"
              startIcon={<OpenInNewIcon />}
              onClick={() => backend.shellOpenExternal(dashboardUrl)}
              fullWidth
            >
              Open Dashboard
            </Button>
          </AccordionDetails>
        </Accordion>

        {/* Database */}
        <Accordion expanded={expanded === 'database'} onChange={handleExpand('database')}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <TableChartIcon fontSize="small" sx={{ color: 'text.secondary' }} />
              <Typography variant="body2" fontWeight={500}>Database</Typography>
            </Stack>
          </AccordionSummary>
          <AccordionDetails sx={{ p: 0 }}>
            <List dense disablePadding>
              <ActionItem
                icon={<TableChartIcon fontSize="small" />}
                title="Table Editor"
                description="View and edit tables"
                onClick={() => openDashboardSection('editor')}
              />
              <ActionItem
                icon={<CodeIcon fontSize="small" />}
                title="SQL Editor"
                description="Run SQL queries"
                onClick={() => openDashboardSection('sql')}
              />
              <ActionItem
                icon={<SchemaIcon fontSize="small" />}
                title="Database Settings"
                description="Schema, roles & extensions"
                onClick={() => openDashboardSection('database/tables')}
              />
              <ActionItem
                icon={<BackupIcon fontSize="small" />}
                title="Backups"
                description="Database backups"
                onClick={() => openDashboardSection('database/backups')}
              />
            </List>
          </AccordionDetails>
        </Accordion>

        {/* Authentication */}
        <Accordion expanded={expanded === 'auth'} onChange={handleExpand('auth')}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <LockIcon fontSize="small" sx={{ color: 'text.secondary' }} />
              <Typography variant="body2" fontWeight={500}>Authentication</Typography>
            </Stack>
          </AccordionSummary>
          <AccordionDetails sx={{ p: 0 }}>
            <List dense disablePadding>
              <ActionItem
                icon={<PeopleIcon fontSize="small" />}
                title="Users"
                description="Manage users"
                onClick={() => openSupabaseTab('users')}
              />
              <ActionItem
                icon={<SecurityIcon fontSize="small" />}
                title="Policies"
                description="Row Level Security"
                onClick={() => openDashboardSection('auth/policies')}
              />
              <ActionItem
                icon={<VpnKeyIcon fontSize="small" />}
                title="Providers"
                description="OAuth & SSO settings"
                onClick={() => openDashboardSection('auth/providers')}
              />
              <ActionItem
                icon={<EmailIcon fontSize="small" />}
                title="Email Templates"
                description="Auth emails"
                onClick={() => openDashboardSection('auth/templates')}
              />
            </List>
          </AccordionDetails>
        </Accordion>

        {/* Storage */}
        <Accordion expanded={expanded === 'storage'} onChange={handleExpand('storage')}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <CloudIcon fontSize="small" sx={{ color: 'text.secondary' }} />
              <Typography variant="body2" fontWeight={500}>Storage</Typography>
            </Stack>
          </AccordionSummary>
          <AccordionDetails sx={{ p: 0 }}>
            <List dense disablePadding>
              <ActionItem
                icon={<FolderIcon fontSize="small" />}
                title="Buckets"
                description="View storage buckets"
                onClick={() => openSupabaseTab('storage')}
              />
              <ActionItem
                icon={<LockIcon fontSize="small" />}
                title="Policies"
                description="Storage access rules"
                onClick={() => openDashboardSection('storage/policies')}
              />
            </List>
          </AccordionDetails>
        </Accordion>

        {/* Edge Functions */}
        <Accordion expanded={expanded === 'functions'} onChange={handleExpand('functions')}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <RocketLaunchIcon fontSize="small" sx={{ color: 'text.secondary' }} />
              <Typography variant="body2" fontWeight={500}>Edge Functions</Typography>
            </Stack>
          </AccordionSummary>
          <AccordionDetails sx={{ p: 0 }}>
            <List dense disablePadding>
              <ActionItem
                icon={<RocketLaunchIcon fontSize="small" />}
                title="Functions"
                description="Deploy & manage functions"
                onClick={() => openDashboardSection('functions')}
              />
              <ActionItem
                icon={<ListAltIcon fontSize="small" />}
                title="Logs"
                description="Function execution logs"
                onClick={() => openDashboardSection('logs/edge-logs')}
              />
            </List>
          </AccordionDetails>
        </Accordion>

        {/* API & Settings */}
        <Accordion expanded={expanded === 'settings'} onChange={handleExpand('settings')}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <SettingsIcon fontSize="small" sx={{ color: 'text.secondary' }} />
              <Typography variant="body2" fontWeight={500}>API & Settings</Typography>
            </Stack>
          </AccordionSummary>
          <AccordionDetails sx={{ p: 0 }}>
            <List dense disablePadding>
              <ActionItem
                icon={<KeyIcon fontSize="small" />}
                title="API Keys"
                description="Project API credentials"
                onClick={() => openDashboardSection('settings/api')}
              />
              <ActionItem
                icon={<MenuBookIcon fontSize="small" />}
                title="API Docs"
                description="Auto-generated API docs"
                onClick={() => openDashboardSection('api')}
              />
              <ActionItem
                icon={<SettingsIcon fontSize="small" />}
                title="Project Settings"
                description="General configuration"
                onClick={() => openDashboardSection('settings/general')}
              />
            </List>
          </AccordionDetails>
        </Accordion>

        {/* Documentation Link */}
        <Box sx={{ p: 2 }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<MenuBookIcon />}
            onClick={() => backend.shellOpenExternal('https://supabase.com/docs')}
            fullWidth
          >
            Documentation
          </Button>
        </Box>
      </Box>
    </Panel>
  );
}
