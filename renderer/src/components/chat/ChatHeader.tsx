import { HistoryIcon, PlusIcon, SettingsIcon, CollapseIcon, ClearIcon } from '../icons';

interface ChatHeaderProps {
  historySidebarOpen: boolean;
  onToggleHistory: () => void;
  onNewChat: () => void;
  onDebugOpen: () => void;
  onClearChat: () => void;
  onOpenSettings: () => void;
  onCollapse?: () => void;
  showClear: boolean;
}

/**
 * Chat panel header with action buttons
 */
export default function ChatHeader({
  historySidebarOpen,
  onToggleHistory,
  onNewChat,
  onDebugOpen,
  onClearChat,
  onOpenSettings,
  onCollapse,
  showClear,
}: ChatHeaderProps) {
  return (
    <div className="chat-hdr">
      <div className="chat-hdr-left">
        <button
          className={`chat-history-toggle ${historySidebarOpen ? 'active' : ''}`}
          onClick={onToggleHistory}
          title="Chat History"
        >
          <HistoryIcon />
        </button>
        <h2>💬 Chat</h2>
      </div>
      <div className="chat-hdr-actions">
        <button className="chat-hdr-btn" onClick={onNewChat} title="New Chat">
          <PlusIcon />
        </button>
        <button
          className="chat-hdr-btn"
          onClick={onDebugOpen}
          title="Session Debug — view all prompts sent to the AI"
        >
          🐛
        </button>
        {showClear && (
          <button className="chat-hdr-btn" onClick={onClearChat} title="Clear chat">
            🗑
          </button>
        )}
        <button className="chat-hdr-btn" onClick={onOpenSettings} title="AI Settings">
          ⚙️
        </button>
        {onCollapse && (
          <button className="panel-collapse-btn" onClick={onCollapse} title="Collapse chat">
            <CollapseIcon />
          </button>
        )}
      </div>
    </div>
  );
}
