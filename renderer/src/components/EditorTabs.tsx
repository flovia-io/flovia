import { useState, useCallback, useEffect, useRef } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';

interface ContextMenu {
  x: number;
  y: number;
  tabPath: string;
}

export default function EditorTabs() {
  const { openTabs, activeTabPath, setActiveTabPath, closeTab, closeOtherTabs, closeAllTabs, closeTabsToTheRight } = useWorkspace();
  const [ctxMenu, setCtxMenu] = useState<ContextMenu | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close context menu on outside click or Escape
  useEffect(() => {
    if (!ctxMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setCtxMenu(null);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCtxMenu(null);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [ctxMenu]);

  const handleContextMenu = useCallback((e: React.MouseEvent, tabPath: string) => {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY, tabPath });
  }, []);

  const handleDoubleClick = useCallback((e: React.MouseEvent, tabPath: string) => {
    e.preventDefault();
    e.stopPropagation();
    closeTab(tabPath);
  }, [closeTab]);

  const menuAction = useCallback((action: () => void) => {
    action();
    setCtxMenu(null);
  }, []);

  const tabIdx = ctxMenu ? openTabs.findIndex(t => t.path === ctxMenu.tabPath) : -1;
  const hasTabsToRight = tabIdx >= 0 && tabIdx < openTabs.length - 1;

  return (
    <div className="editor-tabs">
      {openTabs.map(tab => (
        <div
          key={tab.path}
          className={`tab${tab.path === activeTabPath ? ' active' : ''}`}
          onClick={() => setActiveTabPath(tab.path)}
          onDoubleClick={(e) => handleDoubleClick(e, tab.path)}
          onContextMenu={(e) => handleContextMenu(e, tab.path)}
        >
          <span>{tab.modified && '● '}{tab.name}</span>
          <span className="tab-close" onClick={e => { e.stopPropagation(); closeTab(tab.path); }}>×</span>
        </div>
      ))}

      {/* Right-click context menu */}
      {ctxMenu && (
        <div
          ref={menuRef}
          className="tab-context-menu"
          style={{ top: ctxMenu.y, left: ctxMenu.x }}
        >
          <button className="tab-ctx-item" onClick={() => menuAction(() => closeTab(ctxMenu.tabPath))}>
            Close
          </button>
          <button className="tab-ctx-item" onClick={() => menuAction(() => closeOtherTabs(ctxMenu.tabPath))}>
            Close Others
          </button>
          {hasTabsToRight && (
            <button className="tab-ctx-item" onClick={() => menuAction(() => closeTabsToTheRight(ctxMenu.tabPath))}>
              Close to the Right
            </button>
          )}
          <div className="tab-ctx-separator" />
          <button className="tab-ctx-item" onClick={() => menuAction(closeAllTabs)}>
            Close All
          </button>
        </div>
      )}
    </div>
  );
}
