import { useState, useCallback } from 'react';
import type { Conversation, WorkspaceHistory } from '../types';

interface ChatHistorySidebarProps {
  workspace: WorkspaceHistory | null;
  activeConversationId: string | null;
  onSelectConversation: (conversationId: string) => void;
  onNewChat: () => void;
  onDeleteConversation: (conversationId: string) => void;
  onRenameConversation: (conversationId: string, newTitle: string) => void;
  onClose: () => void;
}

function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function groupConversationsByDate(conversations: Conversation[]): { label: string; items: Conversation[] }[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const lastMonth = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

  const groups: { label: string; items: Conversation[] }[] = [
    { label: 'Today', items: [] },
    { label: 'Yesterday', items: [] },
    { label: 'Last 7 Days', items: [] },
    { label: 'Last 30 Days', items: [] },
    { label: 'Older', items: [] },
  ];

  for (const conv of conversations) {
    const date = new Date(conv.updatedAt);
    if (date >= today) {
      groups[0].items.push(conv);
    } else if (date >= yesterday) {
      groups[1].items.push(conv);
    } else if (date >= lastWeek) {
      groups[2].items.push(conv);
    } else if (date >= lastMonth) {
      groups[3].items.push(conv);
    } else {
      groups[4].items.push(conv);
    }
  }

  return groups.filter(g => g.items.length > 0);
}

export default function ChatHistorySidebar({
  workspace,
  activeConversationId,
  onSelectConversation,
  onNewChat,
  onDeleteConversation,
  onRenameConversation,
  onClose,
}: ChatHistorySidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [contextMenuId, setContextMenuId] = useState<string | null>(null);
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });

  const conversations = workspace?.conversations ?? [];
  const groups = groupConversationsByDate(conversations);

  const handleContextMenu = useCallback((e: React.MouseEvent, convId: string) => {
    e.preventDefault();
    setContextMenuId(convId);
    setContextMenuPos({ x: e.clientX, y: e.clientY });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenuId(null);
  }, []);

  const startRename = useCallback((conv: Conversation) => {
    setEditingId(conv.id);
    setEditTitle(conv.title);
    setContextMenuId(null);
  }, []);

  const submitRename = useCallback(() => {
    if (editingId && editTitle.trim()) {
      onRenameConversation(editingId, editTitle.trim());
    }
    setEditingId(null);
    setEditTitle('');
  }, [editingId, editTitle, onRenameConversation]);

  const handleDelete = useCallback((convId: string) => {
    onDeleteConversation(convId);
    setContextMenuId(null);
  }, [onDeleteConversation]);

  return (
    <div className="chat-history-sidebar" onClick={closeContextMenu}>
      {/* Header */}
      <div className="chat-history-header">
        <span className="chat-history-title">Chat History</span>
        <div className="chat-history-actions">
          <button 
            className="chat-history-new-btn" 
            onClick={onNewChat}
            title="New Chat"
          >
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
              <path d="M8 2a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 8 2z"/>
            </svg>
          </button>
          <button 
            className="chat-history-close-btn" 
            onClick={onClose}
            title="Close History"
          >
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
              <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Conversation List */}
      <div className="chat-history-list">
        {conversations.length === 0 ? (
          <div className="chat-history-empty">
            <div className="chat-history-empty-icon">💬</div>
            <p>No conversations yet</p>
            <button className="chat-history-start-btn" onClick={onNewChat}>
              Start a new chat
            </button>
          </div>
        ) : (
          groups.map(group => (
            <div key={group.label} className="chat-history-group">
              <div className="chat-history-group-label">{group.label}</div>
              {group.items.map(conv => (
                <div
                  key={conv.id}
                  className={`chat-history-item ${conv.id === activeConversationId ? 'active' : ''}`}
                  onClick={() => onSelectConversation(conv.id)}
                  onContextMenu={(e) => handleContextMenu(e, conv.id)}
                >
                  {editingId === conv.id ? (
                    <input
                      type="text"
                      className="chat-history-rename-input"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onBlur={submitRename}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') submitRename();
                        if (e.key === 'Escape') {
                          setEditingId(null);
                          setEditTitle('');
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                    />
                  ) : (
                    <>
                      <div className="chat-history-item-content">
                        <span className="chat-history-item-icon">
                          {conv.mode === 'Agent' ? '🤖' : conv.mode === 'Edit' ? '✏️' : '💬'}
                        </span>
                        <span className="chat-history-item-title">{conv.title}</span>
                      </div>
                      <span className="chat-history-item-time">
                        {formatRelativeTime(conv.updatedAt)}
                      </span>
                    </>
                  )}
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      {/* Context Menu */}
      {contextMenuId && (
        <div
          className="chat-history-context-menu"
          style={{ top: contextMenuPos.y, left: contextMenuPos.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button onClick={() => {
            const conv = conversations.find(c => c.id === contextMenuId);
            if (conv) startRename(conv);
          }}>
            <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
              <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/>
            </svg>
            Rename
          </button>
          <button className="danger" onClick={() => handleDelete(contextMenuId)}>
            <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
              <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
              <path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
            </svg>
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
