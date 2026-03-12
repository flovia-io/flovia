import type { CliProviderMeta } from '../../types/cliProvider.types';

interface ChatWelcomeProps {
  ready: boolean;
  selectedModel: string;
  onOpenSettings: () => void;
  /** If set, the chat is in CLI provider mode */
  cliProvider?: CliProviderMeta | null;
  /** Whether the CLI provider binary was detected on PATH */
  cliProviderInstalled?: boolean;
}

/**
 * Welcome message shown when chat is empty.
 * Shows different content for CLI provider modes vs Local AI modes.
 * Fully provider-agnostic — uses CliProviderMeta for label/icon.
 */
export default function ChatWelcome({
  ready,
  selectedModel,
  onOpenSettings,
  cliProvider = null,
  cliProviderInstalled = false,
}: ChatWelcomeProps) {
  if (cliProvider) {
    return (
      <div className="chat-welcome">
        <span className="chat-icon">{cliProvider.icon}</span>
        {cliProviderInstalled ? (
          <div>
            <p>
              Ask {cliProvider.shortName} anything about your code.
              <br />
              <span className="chat-model-hint">
                Using <strong>{selectedModel}</strong>
              </span>
            </p>
            <div className="chat-copilot-tips">
              <p className="chat-tip">
                💡 <strong>Shift+Tab</strong> to toggle Plan mode
              </p>
              <p className="chat-tip">
                💡 Prefix with <code>/plan</code> for implementation plans
              </p>
              <p className="chat-tip">
                💡 {cliProvider.shortName} streams responses directly from the <code>{cliProvider.binary}</code> CLI
              </p>
            </div>
          </div>
        ) : (
          <div className="chat-setup">
            <p>{cliProvider.name} is not installed. Install it to use this mode.</p>
            <button
              className="btn-primary chat-setup-btn"
              onClick={onOpenSettings}
            >
              📖 View Install Guide
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="chat-welcome">
      <span className="chat-icon">🤖</span>
      {ready ? (
        <p>
          Ask me anything about your project.
          <br />
          <span className="chat-model-hint">
            Using <strong>{selectedModel}</strong>
          </span>
        </p>
      ) : (
        <div className="chat-setup">
          <p>Configure an AI provider to get started.</p>
          <button
            className="btn-primary chat-setup-btn"
            onClick={onOpenSettings}
          >
            ⚙️ Open Settings
          </button>
        </div>
      )}
    </div>
  );
}
