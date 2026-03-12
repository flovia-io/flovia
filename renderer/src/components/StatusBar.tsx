/**
 * StatusBar - Application status bar at the top
 * 
 * Refactored to use Material UI components.
 */
import { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Chip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Tooltip,
  CircularProgress,
  Fade,
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import CheckIcon from '@mui/icons-material/Check';
import { useWorkspace } from '../context/WorkspaceContext';
import SettingsModal from './SettingsModal';
import { GitIcon, NpmIcon } from './icons';

// Window control padding for macOS
const MAC_WINDOW_CONTROL_PADDING = 10; // 80px (10 * 8px spacing)

export default function StatusBar() {
  const {
    hasGit, hasPackageJson, packageName, folderPath, folderName,
    gitBranchInfo, gitPush, gitPull, gitCheckout, closeWorkspace,
  } = useWorkspace();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [branchAnchor, setBranchAnchor] = useState<HTMLElement | null>(null);
  const [pushing, setPushing] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [opMsg, setOpMsg] = useState<{ text: string; isError: boolean } | null>(null);

  // Auto-clear op message
  useEffect(() => {
    if (!opMsg) return;
    const t = setTimeout(() => setOpMsg(null), 4000);
    return () => clearTimeout(t);
  }, [opMsg]);

  const handlePush = async () => {
    setPushing(true);
    const r = await gitPush();
    setPushing(false);
    setOpMsg({ text: r.success ? '✓ Pushed' : `✗ ${r.error ?? 'Push failed'}`, isError: !r.success });
  };

  const handlePull = async () => {
    setPulling(true);
    const r = await gitPull();
    setPulling(false);
    setOpMsg({ text: r.success ? '✓ Pulled' : `✗ ${r.error ?? 'Pull failed'}`, isError: !r.success });
  };

  const handleCheckout = async (branch: string) => {
    setBranchAnchor(null);
    const r = await gitCheckout(branch);
    if (!r.success) setOpMsg({ text: `✗ ${r.error ?? 'Checkout failed'}`, isError: true });
  };

  const bi = gitBranchInfo;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 32,
        px: 1.5,
        pl: MAC_WINDOW_CONTROL_PADDING, // Space for macOS window controls
        bgcolor: 'grey.100',
        borderBottom: 1,
        borderColor: 'divider',
        WebkitAppRegion: 'drag',
        userSelect: 'none',
      }}
    >
      {/* Left section */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, WebkitAppRegion: 'no-drag' }}>
        {folderPath ? (
          <>
            <Tooltip title="Close project">
              <IconButton
                size="small"
                onClick={closeWorkspace}
                sx={{ width: 22, height: 22, color: 'text.secondary' }}
              >
                <ArrowBackIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Tooltip>
            <Typography variant="body2" fontWeight={700} sx={{ color: 'text.primary' }}>
              {folderName}
            </Typography>
          </>
        ) : (
          <Typography variant="body2" fontWeight={700} sx={{ color: 'text.primary' }}>
            mydev.flovia.io
          </Typography>
        )}
        {hasGit && (
          <Chip
            icon={<GitIcon size={12} />}
            label="Git"
            size="small"
            sx={{
              height: 20,
              fontSize: '0.68rem',
              bgcolor: 'rgba(0,0,0,0.04)',
              color: '#e67e22',
              '& .MuiChip-icon': { color: '#e67e22' },
            }}
          />
        )}
        {hasPackageJson && (
          <Chip
            icon={<NpmIcon size={12} />}
            label={packageName ?? 'npm'}
            size="small"
            sx={{
              height: 20,
              fontSize: '0.68rem',
              bgcolor: 'rgba(0,0,0,0.04)',
              color: '#c0392b',
              '& .MuiChip-icon': { color: '#c0392b' },
            }}
          />
        )}
      </Box>

      {/* Right section */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, WebkitAppRegion: 'no-drag' }}>
        {/* Git branch info */}
        {hasGit && bi && (
          <>
            {/* Branch selector */}
            <Chip
              icon={<Box component="span" sx={{ fontSize: '0.85rem' }}>⑂</Box>}
              label={bi.current || 'HEAD'}
              size="small"
              onClick={(e) => setBranchAnchor(e.currentTarget)}
              sx={{
                height: 22,
                fontSize: '0.72rem',
                fontWeight: 600,
                cursor: 'pointer',
                bgcolor: 'transparent',
                '&:hover': { bgcolor: 'rgba(0,0,0,0.04)' },
              }}
            />
            <Menu
              anchorEl={branchAnchor}
              open={Boolean(branchAnchor)}
              onClose={() => setBranchAnchor(null)}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
              <MenuItem disabled sx={{ fontSize: '0.68rem', fontWeight: 600, opacity: 1 }}>
                Switch Branch
              </MenuItem>
              {bi.branches.map(b => (
                <MenuItem
                  key={b}
                  onClick={() => handleCheckout(b)}
                  selected={b === bi.current}
                  sx={{ fontSize: '0.78rem' }}
                >
                  {b === bi.current && (
                    <ListItemIcon sx={{ minWidth: 24 }}>
                      <CheckIcon fontSize="small" sx={{ color: 'success.main' }} />
                    </ListItemIcon>
                  )}
                  <ListItemText inset={b !== bi.current}>{b}</ListItemText>
                </MenuItem>
              ))}
            </Menu>

            {/* Ahead / Behind */}
            {bi.hasRemote && (bi.ahead > 0 || bi.behind > 0) && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontSize: '0.7rem', fontWeight: 600, color: 'text.secondary' }}>
                {bi.behind > 0 && <span>↓{bi.behind}</span>}
                {bi.ahead > 0 && <span>↑{bi.ahead}</span>}
              </Box>
            )}

            {/* Pull */}
            {bi.hasRemote && (
              <Tooltip title="Pull">
                <IconButton
                  size="small"
                  onClick={handlePull}
                  disabled={pulling}
                  sx={{ width: 22, height: 22, color: 'text.secondary' }}
                >
                  {pulling ? <CircularProgress size={12} /> : <ArrowDownwardIcon sx={{ fontSize: 14 }} />}
                </IconButton>
              </Tooltip>
            )}

            {/* Push */}
            {bi.hasRemote && (
              <Tooltip title="Push">
                <IconButton
                  size="small"
                  onClick={handlePush}
                  disabled={pushing}
                  sx={{ width: 22, height: 22, color: 'text.secondary' }}
                >
                  {pushing ? <CircularProgress size={12} /> : <ArrowUpwardIcon sx={{ fontSize: 14 }} />}
                </IconButton>
              </Tooltip>
            )}
          </>
        )}

        {/* Op feedback */}
        <Fade in={!!opMsg}>
          <Chip
            label={opMsg?.text || ''}
            size="small"
            color={opMsg?.isError ? 'error' : 'success'}
            sx={{
              height: 20,
              fontSize: '0.68rem',
              fontWeight: 600,
              display: opMsg ? 'inline-flex' : 'none',
            }}
          />
        </Fade>

        {/* Folder path */}
        {folderPath && (
          <Typography
            variant="caption"
            sx={{
              color: 'text.disabled',
              fontFamily: '"SF Mono", "Fira Code", monospace',
              maxWidth: 400,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {folderPath}
          </Typography>
        )}

        {/* Settings */}
        <Tooltip title="AI Settings">
          <IconButton
            size="small"
            onClick={() => setSettingsOpen(true)}
            sx={{ width: 22, height: 22, color: 'text.secondary' }}
          >
            <SettingsIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
      </Box>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} onSaved={() => setSettingsOpen(false)} />
    </Box>
  );
}
