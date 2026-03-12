import {
  type RefObject,
  type ChangeEvent,
  type KeyboardEvent,
  type DragEvent,
} from 'react';
import { getFileIcon } from '../../utils/fileIcons';
import {
  AddFileIcon,
  SendIcon,
  StopIcon,
} from '../icons';

type ChatMode = 'Agent' | 'Chat' | 'Edit' | 'Copilot';

interface AttachedFile {
  name: string;
  path: string;
  content?: string;
}

interface SuggestedFile {
  name: string;
  path: string;
}

interface ChatComposerProps {
  input: string;
  onInputChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  onSend: () => void;
  onStop: () => void;
  loading: boolean;
  ready: boolean;
  mode: ChatMode;
  onModeChange: (mode: ChatMode) => void;
  models: string[];
  selectedModel: string;
  onModelChange: (model: string) => void;
  attachedFiles: AttachedFile[];
  onRemoveFile: (path: string) => void;
  onAddContext: () => void;
  suggestedFiles: SuggestedFile[];
  activeTabPath: string | null;
  onAddSuggestedFile: (name: string, path: string) => void;
  dragging: boolean;
  onDragOver: (e: DragEvent) => void;
  onDragLeave: (e: DragEvent) => void;
  onDrop: (e: DragEvent) => void;
  textareaRef: RefObject<HTMLTextAreaElement>;
  fileInputRef: RefObject<HTMLInputElement>;
  onFilePick: (e: ChangeEvent<HTMLInputElement>) => void;
}

const chatModes: ChatMode[] = ['Agent', 'Chat', 'Edit', 'Copilot'];

/**
 * Chat composer component with input, file attachments, and controls
 */
export default function ChatComposer({
  input,
  onInputChange,
  onKeyDown,
  onSend,
  onStop,
  loading,
  ready,
  mode,
  onModeChange,
  models,
  selectedModel,
  onModelChange,
  attachedFiles,
  onRemoveFile,
  onAddContext,
  suggestedFiles,
  activeTabPath,
  onAddSuggestedFile,
  dragging,
  onDragOver,
  onDragLeave,
  onDrop,
  textareaRef,
  fileInputRef,
  onFilePick,
}: ChatComposerProps) {
  const [modeMenuOpen, setModeMenuOpen] = React.useState(false);

  return (
    <div
      className={`chat-composer ${dragging ? 'drag-over' : ''}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* File chips row */}
      {attachedFiles.length > 0 && (
        <div className="composer-files">
          {attachedFiles.map((f) => (
            <span key={f.path} className="file-chip">
              {getFileIcon(f.name)}
              <span className="file-chip-name">{f.name}</span>
              <button
                className="file-chip-remove"
                onClick={() => onRemoveFile(f.path)}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Add Context + Suggestions */}
      <div className="composer-top">
        <button
          className="composer-add-ctx"
          onClick={onAddContext}
          title="Add Context..."
        >
          <AddFileIcon />
          Add Context…
        </button>
        {suggestedFiles.length > 0 && (
          <div className="composer-suggestions">
            {suggestedFiles.map((f) => (
              <button
                key={f.path}
                className={`composer-suggestion-chip ${f.path === activeTabPath ? 'active-file' : ''}`}
                onClick={() => onAddSuggestedFile(f.name, f.path)}
                title={`Add ${f.name} as context`}
              >
                {getFileIcon(f.name)} {f.name}
              </button>
            ))}
          </div>
        )}
        <input
          type="file"
          ref={fileInputRef}
          onChange={onFilePick}
          multiple
          hidden
        />
      </div>

      <textarea
        ref={textareaRef}
        className="composer-textarea"
        placeholder={ready ? 'Ask anything, @ to mention…' : 'Configure AI first…'}
        rows={1}
        value={input}
        onChange={onInputChange}
        onKeyDown={onKeyDown}
        disabled={!ready || loading}
      />

      {/* Bottom toolbar */}
      <div className="composer-toolbar">
        <div className="composer-toolbar-left">
          {/* Mode dropdown */}
          <div className="composer-dropdown-wrap">
            <button
              className="composer-dropdown-btn"
              onClick={() => setModeMenuOpen((p) => !p)}
            >
              {mode} <span className="caret">▾</span>
            </button>
            {modeMenuOpen && (
              <div className="composer-dropdown-menu grouped-mode-menu">
                {/* GitHub Copilot CLI section */}
                <div className="mode-group-label">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: 4, opacity: 0.7 }}>
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                  </svg>
                  GitHub Copilot CLI
                </div>
                <button
                  className={`composer-dropdown-item ${mode === 'Copilot' ? 'active' : ''}`}
                  onClick={() => {
                    onModeChange('Copilot');
                    setModeMenuOpen(false);
                  }}
                >
                  <span className="mode-item-icon">✦</span> Copilot
                </button>
                <div className="mode-group-divider" />
                {/* Local modes section */}
                <div className="mode-group-label">Local</div>
                {(['Agent', 'Chat', 'Edit'] as ChatMode[]).map((m) => (
                  <button
                    key={m}
                    className={`composer-dropdown-item ${m === mode ? 'active' : ''}`}
                    onClick={() => {
                      onModeChange(m);
                      setModeMenuOpen(false);
                    }}
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Model dropdown */}
          {models.length > 0 && (
            <div className="composer-dropdown-wrap">
              <select
                className="composer-model-select"
                value={selectedModel}
                onChange={(e) => onModelChange(e.target.value)}
              >
                {models.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="composer-toolbar-right">
          {/* Send / Stop */}
          {loading ? (
            <button
              className="composer-stop-btn"
              onClick={onStop}
              title="Stop generating"
            >
              <StopIcon />
            </button>
          ) : (
            <button
              className="composer-send-btn"
              onClick={onSend}
              disabled={!ready}
              title="Send"
            >
              <SendIcon />
              <span className="caret">▾</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Import React for useState
import React from 'react';
