import { useState, useCallback } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import type { TreeEntry } from '../types';

function searchTree(items: TreeEntry[], query: string): TreeEntry[] {
  const results: TreeEntry[] = [];
  for (const item of items) {
    if (item.type === 'file' && item.name.toLowerCase().includes(query)) results.push(item);
    if (item.children) results.push(...searchTree(item.children, query));
  }
  return results;
}

export default function SearchPanel() {
  const { tree, openFile } = useWorkspace();
  const [query, setQuery] = useState('');

  const results = useCallback(() => {
    const q = query.trim().toLowerCase();
    return q ? searchTree(tree, q) : [];
  }, [tree, query])();

  return (
    <div className="search-panel">
      <div className="sidebar-hdr"><h2>🔍 Search</h2></div>
      <div className="sidebar-actions">
        <input
          className="search-input"
          placeholder="Search files…"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      </div>
      <div className="file-tree">
        {results.map(item => (
          <div key={item.path} className="tree-item file" onClick={() => openFile(item.name, item.path)}>
            <span className="tree-spacer" />
            <span className="tree-label">{item.name}</span>
            <span className="search-path">{item.path.split('/').slice(-2, -1)[0]}/</span>
          </div>
        ))}
        {query && results.length === 0 && <div className="sc-empty">No matches</div>}
      </div>
    </div>
  );
}
