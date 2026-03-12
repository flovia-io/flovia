import { useState, useRef, useEffect } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { getFileIcon } from '../utils/fileIcons';
import { PlusIcon, TrashIcon } from './icons';
import type { TreeEntry } from '../types';

function isIgnored(itemPath: string, ignoredPaths: string[]): boolean {
  return ignoredPaths.some(p => itemPath === p || itemPath.startsWith(p + '/'));
}

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  item: TreeEntry | null;
  isRoot?: boolean;
}

interface NewItemState {
  visible: boolean;
  parentPath: string;
  type: 'file' | 'folder';
}

function FileTreeItem({ item, depth }: { item: TreeEntry; depth: number }) {
  const { openFile, activeTabPath, gitIgnoredPaths, createFile, createFolder, deleteItem } = useWorkspace();
  const [expanded, setExpanded] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ visible: false, x: 0, y: 0, item: null });
  const [newItem, setNewItem] = useState<NewItemState>({ visible: false, parentPath: '', type: 'file' });
  const [newItemName, setNewItemName] = useState('');
  const [hovered, setHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  
  const pad = { paddingLeft: `${12 + depth * 16}px` };
  const ignored = isIgnored(item.path, gitIgnoredPaths);

  // Focus input when creating new item
  useEffect(() => {
    if (newItem.visible && inputRef.current) {
      inputRef.current.focus();
    }
  }, [newItem.visible]);

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu.visible) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu({ visible: false, x: 0, y: 0, item: null });
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [contextMenu.visible]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY, item });
  };

  const handleNewFile = (parentPath: string) => {
    setNewItem({ visible: true, parentPath, type: 'file' });
    setNewItemName('');
    setContextMenu({ visible: false, x: 0, y: 0, item: null });
    if (item.type === 'folder') setExpanded(true);
  };

  const handleNewFolder = (parentPath: string) => {
    setNewItem({ visible: true, parentPath, type: 'folder' });
    setNewItemName('');
    setContextMenu({ visible: false, x: 0, y: 0, item: null });
    if (item.type === 'folder') setExpanded(true);
  };

  const handleDelete = async () => {
    setContextMenu({ visible: false, x: 0, y: 0, item: null });
    if (confirm(`Are you sure you want to delete "${item.name}"?`)) {
      await deleteItem(item.path);
    }
  };

  const handleCreateSubmit = async () => {
    if (!newItemName.trim()) {
      setNewItem({ visible: false, parentPath: '', type: 'file' });
      return;
    }
    
    if (newItem.type === 'file') {
      const result = await createFile(newItem.parentPath, newItemName.trim());
      if (result.success && result.filePath) {
        openFile(newItemName.trim(), result.filePath);
      }
    } else {
      await createFolder(newItem.parentPath, newItemName.trim());
    }
    
    setNewItem({ visible: false, parentPath: '', type: 'file' });
    setNewItemName('');
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCreateSubmit();
    } else if (e.key === 'Escape') {
      setNewItem({ visible: false, parentPath: '', type: 'file' });
      setNewItemName('');
    }
  };

  if (item.type === 'folder') {
    return (
      <>
        <div 
          className={`tree-item folder${ignored ? ' ignored' : ''}`} 
          style={pad} 
          onClick={() => setExpanded(p => !p)}
          onContextMenu={handleContextMenu}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          <span className="tree-arrow">{expanded ? '▼' : '▶'}</span>
          <span className="tree-icon">{expanded ? '📂' : '📁'}</span>
          <span className="tree-label">{item.name}</span>
          {hovered && (
            <button 
              className="tree-add-btn"
              onClick={(e) => { e.stopPropagation(); handleNewFile(item.path); }}
              title="New file"
            >
              <PlusIcon size={12} />
            </button>
          )}
        </div>
        
        {expanded && (
          <>
            {/* New item input */}
            {newItem.visible && newItem.parentPath === item.path && (
              <div className="tree-new-item" style={{ paddingLeft: `${12 + (depth + 1) * 16}px` }}>
                <span className="tree-icon">{newItem.type === 'file' ? '📄' : '📁'}</span>
                <input
                  ref={inputRef}
                  type="text"
                  className="tree-new-input"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  onKeyDown={handleInputKeyDown}
                  onBlur={handleCreateSubmit}
                  placeholder={newItem.type === 'file' ? 'filename.ext' : 'folder name'}
                />
              </div>
            )}
            {item.children?.map(c => <FileTreeItem key={c.path} item={c} depth={depth + 1} />)}
          </>
        )}

        {/* Context Menu */}
        {contextMenu.visible && (
          <div 
            ref={menuRef}
            className="tree-context-menu"
            style={{ top: contextMenu.y, left: contextMenu.x }}
          >
            <button onClick={() => handleNewFile(item.path)}>
              <span>📄</span> New File
            </button>
            <button onClick={() => handleNewFolder(item.path)}>
              <span>📁</span> New Folder
            </button>
            <div className="tree-context-divider" />
            <button onClick={handleDelete} className="danger">
              <TrashIcon size={12} /> Delete
            </button>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <div
        className={`tree-item file${activeTabPath === item.path ? ' active' : ''}${ignored ? ' ignored' : ''}`}
        style={pad}
        onClick={() => openFile(item.name, item.path)}
        onContextMenu={handleContextMenu}
      >
        <span className="tree-spacer" />
        <span className="tree-icon">{getFileIcon(item.name)}</span>
        <span className="tree-label">{item.name}</span>
      </div>

      {/* Context Menu for files */}
      {contextMenu.visible && (
        <div 
          ref={menuRef}
          className="tree-context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button onClick={handleDelete} className="danger">
            <TrashIcon size={12} /> Delete
          </button>
        </div>
      )}
    </>
  );
}

// Root level component with add button
function FileTreeRoot({ items, folderPath }: { items: TreeEntry[]; folderPath: string }) {
  const { createFile, createFolder, openFile } = useWorkspace();
  const [newItem, setNewItem] = useState<NewItemState>({ visible: false, parentPath: '', type: 'file' });
  const [newItemName, setNewItemName] = useState('');
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ visible: false, x: 0, y: 0, item: null, isRoot: true });
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (newItem.visible && inputRef.current) {
      inputRef.current.focus();
    }
  }, [newItem.visible]);

  useEffect(() => {
    if (!contextMenu.visible) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu({ visible: false, x: 0, y: 0, item: null });
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [contextMenu.visible]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY, item: null, isRoot: true });
  };

  const handleNewFile = () => {
    setNewItem({ visible: true, parentPath: folderPath, type: 'file' });
    setNewItemName('');
    setContextMenu({ visible: false, x: 0, y: 0, item: null });
  };

  const handleNewFolder = () => {
    setNewItem({ visible: true, parentPath: folderPath, type: 'folder' });
    setNewItemName('');
    setContextMenu({ visible: false, x: 0, y: 0, item: null });
  };

  const handleCreateSubmit = async () => {
    if (!newItemName.trim()) {
      setNewItem({ visible: false, parentPath: '', type: 'file' });
      return;
    }
    
    if (newItem.type === 'file') {
      const result = await createFile(newItem.parentPath, newItemName.trim());
      if (result.success && result.filePath) {
        openFile(newItemName.trim(), result.filePath);
      }
    } else {
      await createFolder(newItem.parentPath, newItemName.trim());
    }
    
    setNewItem({ visible: false, parentPath: '', type: 'file' });
    setNewItemName('');
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCreateSubmit();
    } else if (e.key === 'Escape') {
      setNewItem({ visible: false, parentPath: '', type: 'file' });
      setNewItemName('');
    }
  };

  return (
    <div className="file-tree-root" onContextMenu={handleContextMenu}>
      {/* Root add buttons */}
      <div className="tree-root-actions">
        <button 
          className="tree-root-add-btn" 
          onClick={handleNewFile}
          title="New file in root"
        >
          <PlusIcon size={12} /> File
        </button>
        <button 
          className="tree-root-add-btn" 
          onClick={handleNewFolder}
          title="New folder in root"
        >
          <PlusIcon size={12} /> Folder
        </button>
      </div>

      {/* New item input at root */}
      {newItem.visible && newItem.parentPath === folderPath && (
        <div className="tree-new-item" style={{ paddingLeft: '12px' }}>
          <span className="tree-icon">{newItem.type === 'file' ? '📄' : '📁'}</span>
          <input
            ref={inputRef}
            type="text"
            className="tree-new-input"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            onKeyDown={handleInputKeyDown}
            onBlur={handleCreateSubmit}
            placeholder={newItem.type === 'file' ? 'filename.ext' : 'folder name'}
          />
        </div>
      )}

      {/* File tree items */}
      {items.map(i => <FileTreeItem key={i.path} item={i} depth={0} />)}

      {/* Root context menu */}
      {contextMenu.visible && contextMenu.isRoot && (
        <div 
          ref={menuRef}
          className="tree-context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button onClick={handleNewFile}>
            <span>📄</span> New File
          </button>
          <button onClick={handleNewFolder}>
            <span>📁</span> New Folder
          </button>
        </div>
      )}
    </div>
  );
}

export default function FileTree({ items, depth, folderPath }: { items: TreeEntry[]; depth: number; folderPath?: string }) {
  if (!items?.length && !folderPath) return null;
  
  // If we have a folderPath, render with root controls
  if (folderPath) {
    return <FileTreeRoot items={items} folderPath={folderPath} />;
  }
  
  // Otherwise render items without root controls (for nested usage)
  return <>{items.map(i => <FileTreeItem key={i.path} item={i} depth={depth} />)}</>;
}
