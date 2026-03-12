import { type RefObject, useMemo } from 'react';
import Markdown from '../Markdown';
import HtmlPreview, { extractHtmlFromMarkdown } from '../HtmlPreview';
import AgentActionRow from './AgentActionRow';
import { getFileIcon } from '../../utils/fileIcons';
import type { FileActionProgress, DisplayMessage } from '../../types';

export type { DisplayMessage };

export interface AttachedFile {
  name: string;
  path: string;
  content?: string;
}

interface ChatMessagesProps {
  messages: DisplayMessage[];
  loading: boolean;
  workspaceFiles: Set<string>;
  onFileClick: (relativePath: string) => void;
  endRef: RefObject<HTMLDivElement>;
}

/**
 * Bot message content — renders Markdown + a stable HtmlPreview sibling.
 * The HtmlPreview is outside ReactMarkdown's tree so its state (collapsed/expanded)
 * persists across streaming re-renders.
 */
function BotMessageContent({
  text,
  workspaceFiles,
  onFileClick,
  isStreaming,
}: {
  text: string;
  workspaceFiles: Set<string>;
  onFileClick: (relativePath: string) => void;
  isStreaming?: boolean;
}) {
  const extractedHtml = useMemo(() => extractHtmlFromMarkdown(text), [text]);

  return (
    <>
      <div className="md-content">
        <Markdown workspaceFiles={workspaceFiles} onFileClick={onFileClick}>
          {text}
        </Markdown>
      </div>
      {extractedHtml && <HtmlPreview html={extractedHtml} isStreaming={isStreaming} />}
    </>
  );
}

/**
 * Chat messages list component
 */
export default function ChatMessages({
  messages,
  loading,
  workspaceFiles,
  onFileClick,
  endRef,
}: ChatMessagesProps) {
  return (
    <div className="chat-messages">
      {messages.map((msg, i) => {
        const isLastBot = msg.sender === 'bot' && i === messages.length - 1;
        const isStreaming = isLastBot && loading;
        const isCli = msg.isCliProvider || msg.isCopilotCli;
        return (
        <div key={i} className={`chat-msg ${msg.sender}${isCli ? ' copilot-cli' : ''}${isStreaming && isCli ? ' cli-streaming' : ''}`}>
          <div className={`bubble${isCli && msg.sender === 'bot' ? ' cli-terminal-bubble' : ''}`}>
            {/* CLI provider terminal header */}
            {isCli && msg.sender === 'bot' && (
              <div className="cli-terminal-header">
                <span className="cli-terminal-dots">
                  <span className="cli-dot red" />
                  <span className="cli-dot yellow" />
                  <span className="cli-dot green" />
                </span>
                <span className="cli-terminal-title">CLI Provider</span>
              </div>
            )}

            {/* CLI provider user prompt badge */}
            {isCli && msg.sender === 'user' && msg.badge && (
              <span className="cli-user-badge">{msg.badge}</span>
            )}

            {/* Attached files */}
            {msg.files && msg.files.length > 0 && (
              <div className="bubble-files">
                {msg.files.map((f) => (
                  <span key={f.path} className="file-chip-inline">
                    {getFileIcon(f.name)} {f.name}
                  </span>
                ))}
              </div>
            )}

            {/* Agent progress panel */}
            {msg.isAgentProgress && msg.agentActions && msg.agentActions.length > 0 && (
              <div className="agent-progress">
                {msg.agentActions.map((action, j) => (
                  <AgentActionRow
                    key={`${action.plan.file}-${j}`}
                    action={action}
                    onFileClick={onFileClick}
                  />
                ))}
                {msg.verifyAttempt && (
                  <div className="agent-verify-badge">
                    🔄 Verification attempt {msg.verifyAttempt}/3
                  </div>
                )}
              </div>
            )}

            {/* Message content */}
            {msg.sender === 'bot' ? (
              isCli ? (
                <pre className="cli-terminal-output">{msg.text || '\u00A0'}</pre>
              ) : (
                <BotMessageContent
                  text={msg.text}
                  workspaceFiles={workspaceFiles}
                  onFileClick={onFileClick}
                  isStreaming={isStreaming}
                />
              )
            ) : (
              !msg.isAgentProgress && msg.text
            )}
          </div>
        </div>
        );
      })}

      {/* Loading indicator */}
      {loading &&
        (messages.length === 0 || messages[messages.length - 1].sender !== 'bot') && (
          <div className="chat-msg bot">
            <div className="bubble chat-typing">
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
            </div>
          </div>
        )}

      <div ref={endRef} />
    </div>
  );
}
