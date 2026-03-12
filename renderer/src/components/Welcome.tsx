import { useState, useEffect, useCallback } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { useBackend } from '../context/BackendContext';
import type { WorkspaceHistory } from '../types';
import { StartPageChat, WelcomeConnections } from './start';

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

/** A flat chat entry for the "All Chats" view */
interface ChatEntry {
  conversationId: string;
  title: string;
  updatedAt: string;
  mode: string;
  workspacePath: string;
  workspaceName: string;
  messageCount: number;
}

export default function Welcome() {
  const { importFolder } = useWorkspace();
  const backend = useBackend();
  const [recentWorkspaces, setRecentWorkspaces] = useState<WorkspaceHistory[]>([]);
  const [allChats, setAllChats] = useState<ChatEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'projects' | 'chats'>('projects');

  useEffect(() => {
    (async () => {
      try {
        const workspaces = await backend.historyGetRecentWorkspaces(20);
        setRecentWorkspaces(workspaces);

        // Build flat list of all chats across workspaces
        const chats: ChatEntry[] = [];
        for (const ws of workspaces) {
          for (const conv of ws.conversations) {
            chats.push({
              conversationId: conv.id,
              title: conv.title,
              updatedAt: conv.updatedAt,
              mode: conv.mode,
              workspacePath: ws.folderPath,
              workspaceName: ws.folderName,
              messageCount: conv.messages.filter(m => m.role !== 'system').length,
            });
          }
        }
        // Sort by most recently updated
        chats.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        setAllChats(chats);
      } catch (err) {
        console.error('[Welcome] Failed to load recent workspaces:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const openWorkspace = useCallback(async (folderPath: string) => {
    try {
      await backend.historyOpenWorkspace(folderPath);
      window.dispatchEvent(new CustomEvent('open-workspace', { detail: { folderPath } }));
    } catch (err) {
      console.error('[Welcome] Failed to open workspace:', err);
    }
  }, []);

  const openWorkspaceWithChat = useCallback(async (folderPath: string, conversationId: string) => {
    try {
      await backend.historyOpenWorkspace(folderPath);
      await backend.historySetActiveConversation(folderPath, conversationId);
      window.dispatchEvent(new CustomEvent('open-workspace', { detail: { folderPath } }));
    } catch (err) {
      console.error('[Welcome] Failed to open workspace with chat:', err);
    }
  }, []);

  const removeWorkspace = useCallback(async (e: React.MouseEvent, folderPath: string) => {
    e.stopPropagation();
    try {
      await backend.historyRemoveWorkspace(folderPath);
      setRecentWorkspaces(prev => prev.filter(w => w.folderPath !== folderPath));
      setAllChats(prev => prev.filter(c => c.workspacePath !== folderPath));
    } catch (err) {
      console.error('[Welcome] Failed to remove workspace:', err);
    }
  }, []);

  return (
    <div className="welcome">
      <div className="welcome-two-col">
        {/* Left column: Chat + Tabs */}
        <div className="welcome-left">
          <div className="welcome-container">
            {/* Chat section — full-width, contains import/clone + chat */}
            <div className="welcome-chat-section">
              <StartPageChat importFolder={importFolder} />
            </div>

            {/* Tab toggle between Recent Projects and All Chats */}
            {!loading && (recentWorkspaces.length > 0 || allChats.length > 0) && (
              <div className="welcome-tabs-section">
                <div className="welcome-tabs">
                  <button
                    className={`welcome-tab ${activeTab === 'projects' ? 'active' : ''}`}
                    onClick={() => setActiveTab('projects')}
                  >
                    📁 Recent Projects
                    {recentWorkspaces.length > 0 && (
                      <span className="welcome-tab-count">{recentWorkspaces.length}</span>
                    )}
                  </button>
                  <button
                    className={`welcome-tab ${activeTab === 'chats' ? 'active' : ''}`}
                    onClick={() => setActiveTab('chats')}
                  >
                    💬 All Chats
                    {allChats.length > 0 && (
                      <span className="welcome-tab-count">{allChats.length}</span>
                    )}
                  </button>
                </div>

                {/* Recent Projects tab */}
                {activeTab === 'projects' && recentWorkspaces.length > 0 && (
                  <div className="welcome-tab-content">
                    <div className="recent-workspaces-list">
                      {recentWorkspaces.slice(0, 8).map(ws => (
                        <div
                          key={ws.folderPath}
                          className="recent-workspace-item"
                          onClick={() => openWorkspace(ws.folderPath)}
                        >
                          <div className="recent-workspace-icon">📁</div>
                          <div className="recent-workspace-info">
                            <span className="recent-workspace-name">{ws.folderName}</span>
                            <span className="recent-workspace-path">{ws.folderPath}</span>
                            <span className="recent-workspace-meta">
                              {ws.conversations.length} chat{ws.conversations.length !== 1 ? 's' : ''} · {formatRelativeTime(ws.lastOpened)}
                            </span>
                          </div>
                          <button
                            className="recent-workspace-remove"
                            onClick={(e) => removeWorkspace(e, ws.folderPath)}
                            title="Remove from recent"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* All Chats tab */}
                {activeTab === 'chats' && (
                  <div className="welcome-tab-content">
                    {allChats.length === 0 ? (
                      <div className="welcome-chats-empty">
                        <p>No conversations yet. Start a chat above!</p>
                      </div>
                    ) : (
                      <div className="welcome-chats-list">
                        {allChats.map(chat => (
                          <div
                            key={`${chat.workspacePath}:${chat.conversationId}`}
                            className="welcome-chat-item"
                            onClick={() => openWorkspaceWithChat(chat.workspacePath, chat.conversationId)}
                          >
                            <div className="welcome-chat-item-icon">
                              {chat.mode === 'Agent' ? '🤖' : chat.mode === 'Edit' ? '✏️' : '💬'}
                            </div>
                            <div className="welcome-chat-item-info">
                              <span className="welcome-chat-item-title">{chat.title}</span>
                              <span className="welcome-chat-item-meta">
                                <span className="welcome-chat-item-workspace">📁 {chat.workspaceName}</span>
                                <span className="welcome-chat-item-sep">·</span>
                                <span>{chat.messageCount} message{chat.messageCount !== 1 ? 's' : ''}</span>
                                <span className="welcome-chat-item-sep">·</span>
                                <span>{formatRelativeTime(chat.updatedAt)}</span>
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right column: Connections */}
        <div className="welcome-right">
          <WelcomeConnections />
        </div>
      </div>
    </div>
  );
}
