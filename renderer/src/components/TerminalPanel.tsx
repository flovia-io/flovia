import { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { useWorkspace } from '../context/WorkspaceContext';
import { useBackend } from '../context/BackendContext';

interface TerminalTab {
  id: string;
  shell: string;
  terminal: Terminal;
  fitAddon: FitAddon;
  label?: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
}

interface RunCommandEvent extends CustomEvent {
  detail: { cwd: string; command: string; label?: string };
}

export default function TerminalPanel({ visible, onClose }: Props) {
  const { folderPath } = useWorkspace();
  const backend = useBackend();
  const [tabs, setTabs] = useState<TerminalTab[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const cleanupRefs = useRef<Map<string, () => void>>(new Map());

  const createTerminalWithCommand = useCallback(async (cwd: string, command?: string, label?: string) => {
    const { id, shell } = await backend.terminalCreate(cwd);

    const terminal = new Terminal({
      fontSize: 13,
      fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', Menlo, monospace",
      theme: {
        background: '#fafafa',
        foreground: '#333',
        cursor: '#333',
        cursorAccent: '#fafafa',
        selectionBackground: 'rgba(0,0,0,0.12)',
        black: '#333',
        red: '#c0392b',
        green: '#27ae60',
        yellow: '#e67e22',
        blue: '#2980b9',
        magenta: '#8e44ad',
        cyan: '#16a085',
        white: '#bbb',
        brightBlack: '#888',
        brightRed: '#e74c3c',
        brightGreen: '#2ecc71',
        brightYellow: '#f39c12',
        brightBlue: '#3498db',
        brightMagenta: '#9b59b6',
        brightCyan: '#1abc9c',
        brightWhite: '#fff',
      },
      cursorBlink: true,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);

    // Listen for user input → send to pty
    terminal.onData((data: string) => {
      backend.terminalInput(id, data);
    });

    // Listen for pty output → write to xterm
    const removeDataListener = backend.onTerminalData((termId: string, data: string) => {
      if (termId === id) terminal.write(data);
    });

    // Listen for exit
    const removeExitListener = backend.onTerminalExit((termId: string) => {
      if (termId === id) {
        terminal.write('\r\n\x1b[90m[Process exited]\x1b[0m\r\n');
      }
    });

    cleanupRefs.current.set(id, () => {
      removeDataListener();
      removeExitListener();
      terminal.dispose();
    });

    const newTab: TerminalTab = { id, shell, terminal, fitAddon, label };
    setTabs(prev => [...prev, newTab]);
    setActiveId(id);

    // Send command after a short delay to let terminal initialize
    if (command) {
      setTimeout(() => {
        backend.terminalInput(id, command + '\n');
      }, 100);
    }

    return id;
  }, []);

  const createTerminal = useCallback(async () => {
    if (!folderPath) return;
    return createTerminalWithCommand(folderPath);
  }, [folderPath, createTerminalWithCommand]);

  // Listen for run-command events from other components
  useEffect(() => {
    const handler = (e: Event) => {
      const event = e as RunCommandEvent;
      const { cwd, command, label } = event.detail;
      createTerminalWithCommand(cwd, command, label);
    };
    window.addEventListener('run-terminal-command', handler);
    return () => window.removeEventListener('run-terminal-command', handler);
  }, [createTerminalWithCommand]);

  // Mount active terminal into DOM
  useEffect(() => {
    if (!visible || !activeId || !containerRef.current) return;
    const tab = tabs.find(t => t.id === activeId);
    if (!tab) return;

    // Clear container
    const el = containerRef.current;
    el.innerHTML = '';
    tab.terminal.open(el);
    tab.fitAddon.fit();

    // Resize on window resize
    const resizeHandler = () => { try { tab.fitAddon.fit(); } catch { /* ignore */ } };
    const observer = new ResizeObserver(resizeHandler);
    observer.observe(el);

    // Send initial size
    backend.terminalResize(tab.id, tab.terminal.cols, tab.terminal.rows);
    tab.terminal.onResize(({ cols, rows }) => {
      backend.terminalResize(tab.id, cols, rows);
    });

    tab.terminal.focus();

    return () => { observer.disconnect(); };
  }, [activeId, visible, tabs]);

  // Auto-create first terminal when panel opens
  useEffect(() => {
    if (visible && tabs.length === 0 && folderPath) {
      createTerminal();
    }
  }, [visible, folderPath]); // eslint-disable-line react-hooks/exhaustive-deps

  const killTab = useCallback(async (id: string) => {
    await backend.terminalKill(id);
    const cleanup = cleanupRefs.current.get(id);
    if (cleanup) { cleanup(); cleanupRefs.current.delete(id); }
    setTabs(prev => {
      const next = prev.filter(t => t.id !== id);
      if (activeId === id) setActiveId(next.length > 0 ? next[next.length - 1].id : null);
      return next;
    });
  }, [activeId]);

  // Cleanup all on unmount
  useEffect(() => {
    return () => {
      for (const [, cleanup] of cleanupRefs.current) cleanup();
      cleanupRefs.current.clear();
    };
  }, []);

  if (!visible) return null;

  return (
    <div className="terminal-panel">
      <div className="terminal-header">
        <div className="terminal-tabs-bar">
          {tabs.map(t => (
            <button
              key={t.id}
              className={`terminal-tab ${t.id === activeId ? 'active' : ''}`}
              onClick={() => setActiveId(t.id)}
            >
              <span className="terminal-tab-icon">⬛</span>
              {t.label || t.shell}
              <span className="terminal-tab-close" onClick={e => { e.stopPropagation(); killTab(t.id); }}>×</span>
            </button>
          ))}
          <button className="terminal-add-btn" onClick={createTerminal} title="New Terminal">+</button>
        </div>
        <div className="terminal-header-actions">
          <button className="terminal-action-btn" onClick={onClose} title="Close Panel">✕</button>
        </div>
      </div>
      <div className="terminal-container" ref={containerRef} />
    </div>
  );
}
