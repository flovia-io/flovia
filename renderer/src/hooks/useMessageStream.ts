/**
 * useMessageStream — Handles streaming AI responses and updating message state.
 * Extracted from ChatPanel to keep the component focused on UI.
 */
import { useCallback } from 'react';
import type { ChatMessage, DisplayMessage } from '../types';
import { useBackend } from '../context/BackendContext';

type SetMessages = React.Dispatch<React.SetStateAction<DisplayMessage[]>>;
type SetHistory = React.Dispatch<React.SetStateAction<ChatMessage[]>>;

interface StreamDeps {
  scrollToBottom: () => void;
  setMessages: SetMessages;
  setHistory: SetHistory;
  setLoading: (v: boolean) => void;
}

export function useMessageStream(deps: StreamDeps) {
  const { scrollToBottom, setMessages, setHistory, setLoading } = deps;
  const backend = useBackend();

  /** Stream a response and update the message list / history */
  const streamResponse = useCallback(async (
    baseUrl: string,
    apiKey: string,
    model: string,
    history: ChatMessage[],
  ) => {
    setMessages(prev => [...prev, { text: '', sender: 'bot' }]);
    scrollToBottom();

    let streamedText = '';
    const cleanupChunk = backend.onAiChatChunk((chunk: string) => {
      streamedText += chunk;
      const currentText = streamedText;
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { text: currentText, sender: 'bot' };
        return updated;
      });
      scrollToBottom();
    });

    try {
      const result = await backend.aiChatStream(baseUrl, apiKey, model, history);
      cleanupChunk();

      if (result.success && result.reply) {
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { text: result.reply!, sender: 'bot' };
          return updated;
        });
        setHistory(prev => [...prev, { role: 'assistant', content: result.reply! }]);
      } else if (result.error === 'aborted') {
        if (streamedText) {
          setMessages(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = { text: streamedText + '\n\n⏹ *Response stopped.*', sender: 'bot' };
            return updated;
          });
          setHistory(prev => [...prev, { role: 'assistant', content: streamedText }]);
        } else {
          setMessages(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = { text: '⏹ Response stopped.', sender: 'bot' };
            return updated;
          });
        }
      } else {
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { text: `⚠️ ${result.error ?? 'Unknown error'}`, sender: 'bot' };
          return updated;
        });
      }
    } catch (err: unknown) {
      cleanupChunk();
      const msg = (err as Error).message;
      if (msg?.includes('abort')) {
        if (streamedText) {
          setMessages(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = { text: streamedText + '\n\n⏹ *Response stopped.*', sender: 'bot' };
            return updated;
          });
          setHistory(prev => [...prev, { role: 'assistant', content: streamedText }]);
        } else {
          setMessages(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = { text: '⏹ Response stopped.', sender: 'bot' };
            return updated;
          });
        }
      } else {
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { text: `⚠️ ${msg}`, sender: 'bot' };
          return updated;
        });
      }
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  }, [scrollToBottom, setMessages, setHistory, setLoading]);

  const stopMessage = useCallback(async () => {
    try { await backend.aiChatAbort(); } catch { /* ignore */ }
  }, []);

  return { streamResponse, stopMessage };
}
