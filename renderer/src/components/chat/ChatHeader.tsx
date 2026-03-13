import { HistoryIcon, PlusIcon, CollapseIcon } from '../icons';

interface ChatHeaderProps {
  historySidebarOpen: boolean;
  onToggleHistory: () => void;
  onNewChat: () => void;
  onDebugOpen: () => void;
  onClearChat: () => void;
  onCollapse?: () => void;
  showClear: boolean;
  /** When false (production / no workspace), the debug button is hidden */
  isEditing?: boolean;
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
  onCollapse,
  showClear,
  isEditing = true,
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
        {isEditing && (
          <button
            className="chat-hdr-btn"
            onClick={onDebugOpen}
            title="Session Debug — view all prompts sent to the AI"
          >
            🐛
          </button>
        )}
        {showClear && (
          <button className="chat-hdr-btn" onClick={onClearChat} title="Clear chat">
            🗑
          </button>
        )}
        {onCollapse && (
          <button className="panel-collapse-btn" onClick={onCollapse} title="Collapse chat">
            <CollapseIcon />
          </button>
        )}
      </div>
    </div>
  );
}
