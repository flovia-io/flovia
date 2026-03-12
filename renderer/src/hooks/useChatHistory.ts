import { useState, useEffect, useCallback } from 'react';
import type { ChatMessage, Conversation, WorkspaceHistory, DisplayMessage } from '../types';
import type { ChatMode } from '../types/ui.types';
import { useBackend } from '../context/BackendContext';

interface UseChatHistoryReturn {
  workspaceHistory: WorkspaceHistory | null;
  activeConversationId: string | null;
  messages: DisplayMessage[];
  history: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<DisplayMessage[]>>;
  setHistory: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  handleNewChat: () => Promise<void>;
  handleSelectConversation: (id: string) => Promise<void>;
  handleDeleteConversation: (id: string) => Promise<void>;
  handleRenameConversation: (id: string, newTitle: string) => Promise<void>;
  ensureConversation: () => Promise<string | null>;
  clearChat: () => void;
}

/**
 * Hook for managing chat history persistence
 */
export function useChatHistory(
  folderPath: string | null,
  mode: ChatMode
): UseChatHistoryReturn {
  const backend = useBackend();
  const [workspaceHistory, setWorkspaceHistory] = useState<WorkspaceHistory | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [history, setHistory] = useState<ChatMessage[]>([]);

  // Load workspace history when folder changes
  useEffect(() => {
    if (!folderPath) {
      setWorkspaceHistory(null);
      setActiveConversationId(null);
      return;
    }

    (async () => {
      try {
        const ws = await backend.historyOpenWorkspace(folderPath);
        setWorkspaceHistory(ws);

        // Load active conversation if exists
        if (ws.activeConversationId) {
          const conv = await backend.historyGetConversation(
            folderPath,
            ws.activeConversationId
          );
          if (conv) {
            setActiveConversationId(conv.id);
            // Restore messages from conversation
            const displayMsgs: DisplayMessage[] = conv.messages
              .filter(m => m.role !== 'system')
              .map(m => ({
                text: m.role === 'user' && m.displayText ? m.displayText : m.content,
                sender: m.role === 'user' ? 'user' : 'bot',
              }));
            setMessages(displayMsgs);
            setHistory(conv.messages);
          }
        }
      } catch (err) {
        console.error('[useChatHistory] Failed to load workspace history:', err);
      }
    })();
  }, [folderPath]);

  // Save conversation whenever history changes (debounced)
  useEffect(() => {
    if (!folderPath || !activeConversationId || history.length === 0) return;

    const timeout = setTimeout(async () => {
      try {
        const updated = await backend.historyUpdateConversation(
          folderPath,
          activeConversationId,
          history,
          mode
        );
        if (updated && workspaceHistory) {
          const idx = workspaceHistory.conversations.findIndex(
            c => c.id === activeConversationId
          );
          if (idx >= 0) {
            const newConvs = [...workspaceHistory.conversations];
            newConvs[idx] = updated;
            setWorkspaceHistory({ ...workspaceHistory, conversations: newConvs });
          }
        }
      } catch (err) {
        console.error('[useChatHistory] Failed to save conversation:', err);
      }
    }, 500);

    return () => clearTimeout(timeout);
  }, [history, folderPath, activeConversationId, mode, workspaceHistory]);

  // Create new conversation
  const handleNewChat = useCallback(async () => {
    if (!folderPath) return;
    try {
      const conv = await backend.historyCreateConversation(folderPath, mode);
      setActiveConversationId(conv.id);
      setMessages([]);
      setHistory([]);
      if (workspaceHistory) {
        setWorkspaceHistory({
          ...workspaceHistory,
          conversations: [conv, ...workspaceHistory.conversations],
          activeConversationId: conv.id,
        });
      }
    } catch (err) {
      console.error('[useChatHistory] Failed to create conversation:', err);
    }
  }, [folderPath, mode, workspaceHistory]);

  // Select existing conversation
  const handleSelectConversation = useCallback(
    async (conversationId: string) => {
      if (!folderPath) return;
      try {
        const conv = await backend.historyGetConversation(
          folderPath,
          conversationId
        );
        if (conv) {
          await backend.historySetActiveConversation(folderPath, conversationId);
          setActiveConversationId(conv.id);
          // Restore messages
          const displayMsgs: DisplayMessage[] = conv.messages
            .filter(m => m.role !== 'system')
            .map(m => ({
              text: m.role === 'user' && m.displayText ? m.displayText : m.content,
              sender: m.role === 'user' ? 'user' : 'bot',
            }));
          setMessages(displayMsgs);
          setHistory(conv.messages);
        }
      } catch (err) {
        console.error('[useChatHistory] Failed to load conversation:', err);
      }
    },
    [folderPath]
  );

  // Delete conversation
  const handleDeleteConversation = useCallback(
    async (conversationId: string) => {
      if (!folderPath) return;
      try {
        await backend.historyDeleteConversation(folderPath, conversationId);
        if (workspaceHistory) {
          const newConvs = workspaceHistory.conversations.filter(
            c => c.id !== conversationId
          );
          const newActiveId =
            conversationId === activeConversationId
              ? newConvs[0]?.id ?? null
              : activeConversationId;

          setWorkspaceHistory({
            ...workspaceHistory,
            conversations: newConvs,
            activeConversationId: newActiveId,
          });

          if (conversationId === activeConversationId) {
            if (newActiveId) {
              handleSelectConversation(newActiveId);
            } else {
              setActiveConversationId(null);
              setMessages([]);
              setHistory([]);
            }
          }
        }
      } catch (err) {
        console.error('[useChatHistory] Failed to delete conversation:', err);
      }
    },
    [folderPath, workspaceHistory, activeConversationId, handleSelectConversation]
  );

  // Rename conversation
  const handleRenameConversation = useCallback(
    async (conversationId: string, newTitle: string) => {
      if (!folderPath) return;
      try {
        await backend.historyRenameConversation(
          folderPath,
          conversationId,
          newTitle
        );
        if (workspaceHistory) {
          const newConvs = workspaceHistory.conversations.map(c =>
            c.id === conversationId ? { ...c, title: newTitle } : c
          );
          setWorkspaceHistory({ ...workspaceHistory, conversations: newConvs });
        }
      } catch (err) {
        console.error('[useChatHistory] Failed to rename conversation:', err);
      }
    },
    [folderPath, workspaceHistory]
  );

  // Auto-create conversation when user sends first message
  const ensureConversation = useCallback(async () => {
    if (!folderPath) return null;
    if (activeConversationId) return activeConversationId;

    try {
      const conv = await backend.historyCreateConversation(folderPath, mode);
      setActiveConversationId(conv.id);
      if (workspaceHistory) {
        setWorkspaceHistory({
          ...workspaceHistory,
          conversations: [conv, ...workspaceHistory.conversations],
          activeConversationId: conv.id,
        });
      }
      return conv.id;
    } catch (err) {
      console.error('[useChatHistory] Failed to create conversation:', err);
      return null;
    }
  }, [folderPath, activeConversationId, mode, workspaceHistory]);

  // Clear current chat
  const clearChat = useCallback(() => {
    setMessages([]);
    setHistory([]);
  }, []);

  return {
    workspaceHistory,
    activeConversationId,
    messages,
    history,
    setMessages,
    setHistory,
    handleNewChat,
    handleSelectConversation,
    handleDeleteConversation,
    handleRenameConversation,
    ensureConversation,
    clearChat,
  };
}
