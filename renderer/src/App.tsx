/**
 * App.tsx - Main application layout
 * 
 * Refactored to use Material UI components for core layout.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { WorkspaceProvider, useWorkspace } from './context/WorkspaceContext';
import { StreamingBridgeProvider } from './context/StreamingBridgeContext';
import { useBackend } from './context/BackendContext';
import { AgentExecutionProvider } from './context/AgentExecutionContext';
import StatusBar from './components/StatusBar';
import ActivityBar from './components/ActivityBar';
import Sidebar from './components/Sidebar';
import Editor from './components/Editor';
import ChatPanel from './components/ChatPanel';
import Welcome from './components/Welcome';
import TerminalPanel from './components/TerminalPanel';

const SIDEBAR_MIN = 180;
const SIDEBAR_MAX = 600;
const SIDEBAR_DEFAULT = 260;
const CHAT_MIN = 250;
const CHAT_MAX = 700;
const CHAT_DEFAULT = 320;

function AppLayout() {
  const { openTabs, folderPath } = useWorkspace();
  const backend = useBackend();
  const [terminalVisible, setTerminalVisible] = useState(false);

  // ── Panel widths & collapsed state ──
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT);
  const [chatWidth, setChatWidth] = useState(CHAT_DEFAULT);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [chatCollapsed, setChatCollapsed] = useState(false);

  // Refs for drag resize
  const draggingSidebar = useRef(false);
  const draggingChat = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const toggleTerminal = useCallback(() => {
    if (folderPath) setTerminalVisible(prev => !prev);
  }, [folderPath]);

  // Listen for menu-triggered toggle
  useEffect(() => {
    const cleanup = backend.onToggleTerminal(toggleTerminal);
    return cleanup;
  }, [toggleTerminal]);

  // Listen for show-terminal event (e.g. from npm script run)
  useEffect(() => {
    const handler = () => {
      if (folderPath) setTerminalVisible(true);
    };
    window.addEventListener('show-terminal', handler);
    return () => window.removeEventListener('show-terminal', handler);
  }, [folderPath]);

  // Keyboard shortcut: Ctrl/Cmd + `
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '`') {
        e.preventDefault();
        toggleTerminal();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggleTerminal]);

  // ── Mouse drag handlers (global, so they work even when cursor leaves the handle) ──
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (draggingSidebar.current) {
        const delta = e.clientX - startX.current;
        const newW = Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, startWidth.current + delta));
        setSidebarWidth(newW);
      }
      if (draggingChat.current) {
        // Chat is on the right side — dragging left increases width
        const delta = startX.current - e.clientX;
        const newW = Math.max(CHAT_MIN, Math.min(CHAT_MAX, startWidth.current + delta));
        setChatWidth(newW);
      }
    };
    const onMouseUp = () => {
      draggingSidebar.current = false;
      draggingChat.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  const onSidebarResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    draggingSidebar.current = true;
    startX.current = e.clientX;
    startWidth.current = sidebarWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [sidebarWidth]);

  const onChatResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    draggingChat.current = true;
    startX.current = e.clientX;
    startWidth.current = chatWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [chatWidth]);

  // No folder loaded → full-screen welcome
  if (!folderPath) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        <StatusBar />
        <Box component="main" sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', bgcolor: 'background.paper' }}>
          <Welcome />
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <StatusBar />
      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <ActivityBar 
          onToggleTerminal={toggleTerminal} 
          terminalVisible={terminalVisible} 
        />

        {/* ── Sidebar (collapsible + resizable) ── */}
        {sidebarCollapsed ? (
          <Box
            sx={{
              width: 28,
              minWidth: 28,
              bgcolor: 'grey.100',
              borderRight: 1,
              borderColor: 'divider',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'center',
              pt: 1,
            }}
          >
            <Tooltip title="Expand sidebar" placement="right">
              <IconButton
                size="small"
                onClick={() => setSidebarCollapsed(false)}
                sx={{ color: 'text.secondary' }}
              >
                <ChevronRightIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        ) : (
          <>
            <Box
              sx={{
                width: sidebarWidth,
                minWidth: sidebarWidth,
                maxWidth: sidebarWidth,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                bgcolor: 'grey.50',
                borderRight: 1,
                borderColor: 'divider',
              }}
            >
              <Sidebar onCollapse={() => setSidebarCollapsed(true)} />
            </Box>
            <Box
              sx={{
                width: 4,
                minWidth: 4,
                bgcolor: 'transparent',
                cursor: 'col-resize',
                '&:hover': { bgcolor: 'primary.light' },
                transition: 'background-color 0.15s',
              }}
              onMouseDown={onSidebarResizeStart}
            />
          </>
        )}

        {/* ── Main content area ── */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <Box
            component="main"
            sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', bgcolor: 'background.paper' }}
          >
            {openTabs.length > 0 ? <Editor /> : <Box sx={{ flex: 1, bgcolor: 'grey.50' }} />}
          </Box>
          <TerminalPanel visible={terminalVisible} onClose={() => setTerminalVisible(false)} />
        </Box>

        {/* ── Chat Panel (collapsible + resizable) ── */}
        {chatCollapsed ? (
          <Box
            sx={{
              width: 28,
              minWidth: 28,
              bgcolor: 'grey.100',
              borderLeft: 1,
              borderColor: 'divider',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'center',
              pt: 1,
            }}
          >
            <Tooltip title="Expand chat" placement="left">
              <IconButton
                size="small"
                onClick={() => setChatCollapsed(false)}
                sx={{ color: 'text.secondary' }}
              >
                <ChevronLeftIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        ) : (
          <>
            <Box
              sx={{
                width: 4,
                minWidth: 4,
                bgcolor: 'transparent',
                cursor: 'col-resize',
                '&:hover': { bgcolor: 'primary.light' },
                transition: 'background-color 0.15s',
              }}
              onMouseDown={onChatResizeStart}
            />
            <Box
              sx={{
                width: chatWidth,
                minWidth: chatWidth,
                maxWidth: chatWidth,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                bgcolor: 'background.paper',
                borderLeft: 1,
                borderColor: 'divider',
              }}
            >
              <ChatPanel onCollapse={() => setChatCollapsed(true)} />
            </Box>
          </>
        )}
      </Box>
    </Box>
  );
}

export default function App() {
  return (
    <StreamingBridgeProvider>
      <WorkspaceProvider>
        <AgentExecutionProvider>
          <AppLayout />
        </AgentExecutionProvider>
      </WorkspaceProvider>
    </StreamingBridgeProvider>
  );
}
