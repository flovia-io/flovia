import { useState, useCallback, useEffect } from 'react';
import type { AISettings } from '../types';
import { getBackend } from '../backend';

interface UseAISettingsReturn {
  settings: AISettings | null;
  models: string[];
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  ready: boolean;
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
  handleSettingsSaved: (settings: AISettings) => Promise<void>;
  loadSettings: () => Promise<void>;
}

/**
 * Hook for managing AI settings state
 */
export function useAISettings(): UseAISettingsReturn {
  const [settings, setSettings] = useState<AISettings | null>(null);
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [ready, setReady] = useState(false);

  const loadSettings = useCallback(async () => {
    try {
      const s = await getBackend().aiLoadSettings();
      setSettings(s);
      setSelectedModel(s.selectedModel);
      const list = await getBackend().aiListModels(s.baseUrl, s.apiKey);
      setModels(list);
      if (list.length > 0) {
        setReady(true);
        if (!list.includes(s.selectedModel)) {
          setSelectedModel(list[0]);
        }
      }
    } catch {
      // Not configured
    }
  }, []);

  const handleSettingsSaved = useCallback(async (s: AISettings) => {
    setSettings(s);
    setSelectedModel(s.selectedModel);
    const list = await getBackend().aiListModels(s.baseUrl, s.apiKey);
    setModels(list);
    setReady(list.length > 0 && !!s.selectedModel);
  }, []);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  return {
    settings,
    models,
    selectedModel,
    setSelectedModel,
    ready,
    settingsOpen,
    setSettingsOpen,
    handleSettingsSaved,
    loadSettings,
  };
}
