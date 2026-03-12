import { useState, useEffect } from 'react';
import type { PromptSettings } from '../types';
import { DEFAULT_PROMPTS } from '../types';
import { useBackend } from '../context/BackendContext';

interface PromptSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PROMPT_LABELS: Record<keyof PromptSettings, { label: string; description: string }> = {
  systemPrompt: {
    label: 'System Prompt',
    description: 'The base system message that sets the AI\'s role and context.',
  },
  researchAgentPrompt: {
    label: 'Research Agent',
    description: 'Used to determine which files are relevant to the user\'s question.',
  },
  checkAgentPrompt: {
    label: 'Check Agent',
    description: 'Decides whether the user\'s request requires file changes.',
  },
  actionPlannerPrompt: {
    label: 'Action Planner',
    description: 'Plans which files to create, update, or delete.',
  },
  codeEditorPrompt: {
    label: 'Code Editor',
    description: 'Instructions for generating SEARCH/REPLACE code blocks.',
  },
  verificationPrompt: {
    label: 'Verification Agent',
    description: 'Checks if the changes satisfy the user\'s request.',
  },
  commitMessagePrompt: {
    label: 'Commit Message',
    description: 'Generates git commit messages from staged changes.',
  },
};

export default function PromptSettingsModal({ isOpen, onClose }: PromptSettingsModalProps) {
  const backend = useBackend();
  const [prompts, setPrompts] = useState<PromptSettings>(DEFAULT_PROMPTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<keyof PromptSettings>('systemPrompt');
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadPrompts();
    }
  }, [isOpen]);

  const loadPrompts = async () => {
    setLoading(true);
    try {
      const loaded = await backend.promptsLoad();
      setPrompts(loaded);
      setHasChanges(false);
    } catch (err) {
      console.error('Failed to load prompts:', err);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await backend.promptsSave(prompts);
      setHasChanges(false);
    } catch (err) {
      console.error('Failed to save prompts:', err);
    }
    setSaving(false);
  };

  const handleReset = async () => {
    if (!confirm('Reset all prompts to defaults? This cannot be undone.')) return;
    setLoading(true);
    try {
      const defaults = await backend.promptsReset();
      setPrompts(defaults);
      setHasChanges(false);
    } catch (err) {
      console.error('Failed to reset prompts:', err);
    }
    setLoading(false);
  };

  const handleChange = (key: keyof PromptSettings, value: string) => {
    setPrompts(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  if (!isOpen) return null;

  const tabs = Object.keys(PROMPT_LABELS) as (keyof PromptSettings)[];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="prompt-settings-modal" onClick={e => e.stopPropagation()}>
        <div className="prompt-settings-header">
          <h2>⚙️ Agent Prompts</h2>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="prompt-settings-content">
          {/* Tab List */}
          <div className="prompt-tabs">
            {tabs.map(key => (
              <button
                key={key}
                className={`prompt-tab ${activeTab === key ? 'active' : ''}`}
                onClick={() => setActiveTab(key)}
              >
                {PROMPT_LABELS[key].label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="prompt-editor">
            {loading ? (
              <div className="prompt-loading">Loading...</div>
            ) : (
              <>
                <div className="prompt-description">
                  {PROMPT_LABELS[activeTab].description}
                </div>
                <textarea
                  className="prompt-textarea"
                  value={prompts[activeTab]}
                  onChange={e => handleChange(activeTab, e.target.value)}
                  placeholder={`Enter ${PROMPT_LABELS[activeTab].label.toLowerCase()}...`}
                />
              </>
            )}
          </div>
        </div>

        <div className="prompt-settings-footer">
          <button className="prompt-reset-btn" onClick={handleReset} disabled={loading}>
            Reset to Defaults
          </button>
          <div className="prompt-footer-right">
            {hasChanges && <span className="prompt-unsaved">Unsaved changes</span>}
            <button className="prompt-cancel-btn" onClick={onClose}>
              Cancel
            </button>
            <button
              className="prompt-save-btn"
              onClick={handleSave}
              disabled={!hasChanges || saving || loading}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
