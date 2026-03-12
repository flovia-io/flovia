/**
 * PluginPanel - Unified panel for managing plugins/connectors
 * 
 * Shows all registered plugins with their credentials, actions, and status.
 * Provides a consistent UI for all integrations.
 */
import { useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Stack,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Divider,
  Alert,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ExtensionIcon from '@mui/icons-material/Extension';
import Panel from './Panel';
import PanelHeader from './PanelHeader';
import PluginCard, { type PluginAction } from './PluginCard';
import CredentialsForm from './CredentialsForm';
import ActionInputForm, { type ActionInputConfig } from './ActionInputForm';
import ActionPreview from './ActionPreview';
import EmptyState from './EmptyState';
import { type FieldConfig } from './FormField';
import { type StatusType } from './StatusIndicator';

export interface PluginConfig {
  id: string;
  name: string;
  description?: string;
  icon?: React.ReactNode;
  iconColor?: string;
  category: string;
  status: StatusType;
  credentialFields: FieldConfig[];
  actions: PluginAction[];
  actionInputSchemas?: Record<string, FieldConfig[]>;
  credentials?: Record<string, string | boolean | number>;
}

interface PluginPanelProps {
  plugins: PluginConfig[];
  onTestConnection: (pluginId: string, credentials: Record<string, string | boolean | number>) => Promise<{ success: boolean; error?: string }>;
  onSaveCredentials: (pluginId: string, credentials: Record<string, string | boolean | number>) => Promise<void>;
  onConnect: (pluginId: string) => Promise<void>;
  onDisconnect: (pluginId: string) => Promise<void>;
  onExecuteAction: (pluginId: string, actionId: string, params: Record<string, string | boolean | number>) => Promise<{ success: boolean; data?: unknown; error?: string }>;
  onOpenAsFile?: (content: string, filename: string) => void;
  loading?: boolean;
  onRefresh?: () => void;
}

type ViewState = 
  | { type: 'list' }
  | { type: 'configure'; pluginId: string }
  | { type: 'action'; pluginId: string; actionId: string }
  | { type: 'result'; pluginId: string; actionId: string; result: { success: boolean; data?: unknown; error?: string } };

export default function PluginPanel({
  plugins,
  onTestConnection,
  onSaveCredentials,
  onConnect,
  onDisconnect,
  onExecuteAction,
  onOpenAsFile,
  loading,
  onRefresh,
}: PluginPanelProps) {
  const [view, setView] = useState<ViewState>({ type: 'list' });
  const [activeTab, setActiveTab] = useState(0);
  const [busyPlugins, setBusyPlugins] = useState<Set<string>>(new Set());
  const [executing, setExecuting] = useState(false);

  // Get unique categories
  const categories = ['All', ...Array.from(new Set(plugins.map(p => p.category)))];

  // Filter plugins by category
  const filteredPlugins = activeTab === 0
    ? plugins
    : plugins.filter(p => p.category === categories[activeTab]);

  const setBusy = (pluginId: string, busy: boolean) => {
    setBusyPlugins(prev => {
      const next = new Set(prev);
      busy ? next.add(pluginId) : next.delete(pluginId);
      return next;
    });
  };

  const handleConfigure = useCallback((pluginId: string) => {
    setView({ type: 'configure', pluginId });
  }, []);

  const handleConnect = useCallback(async (pluginId: string) => {
    setBusy(pluginId, true);
    try {
      await onConnect(pluginId);
    } finally {
      setBusy(pluginId, false);
    }
  }, [onConnect]);

  const handleDisconnect = useCallback(async (pluginId: string) => {
    setBusy(pluginId, true);
    try {
      await onDisconnect(pluginId);
    } finally {
      setBusy(pluginId, false);
    }
  }, [onDisconnect]);

  const handleActionSelect = useCallback((pluginId: string, actionId: string) => {
    setView({ type: 'action', pluginId, actionId });
  }, []);

  const handleExecute = useCallback(async (
    pluginId: string,
    actionId: string,
    params: Record<string, string | boolean | number>
  ) => {
    setExecuting(true);
    // Find action name for better error messages
    const plugin = plugins.find(p => p.id === pluginId);
    const action = plugin?.actions.find(a => a.id === actionId);
    const actionName = action?.name || actionId;
    
    try {
      const result = await onExecuteAction(pluginId, actionId, params);
      setView({ type: 'result', pluginId, actionId, result });
    } catch (err) {
      setView({
        type: 'result',
        pluginId,
        actionId,
        result: { success: false, error: `Failed to execute "${actionName}": ${(err as Error).message}` },
      });
    } finally {
      setExecuting(false);
    }
  }, [onExecuteAction, plugins]);

  const handleBack = useCallback(() => {
    setView({ type: 'list' });
  }, []);

  // Get current plugin for dialogs
  const currentPlugin = view.type !== 'list' 
    ? plugins.find(p => p.id === view.pluginId) 
    : null;

  // Get current action for action view
  const currentAction = view.type === 'action' || view.type === 'result'
    ? currentPlugin?.actions.find(a => a.id === view.actionId)
    : null;

  return (
    <Panel>
      <PanelHeader
        title="Plugins"
        icon={<ExtensionIcon />}
        onRefresh={onRefresh}
        refreshing={loading}
      />

      {/* Category tabs */}
      {categories.length > 2 && (
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ borderBottom: 1, borderColor: 'divider', minHeight: 36 }}
        >
          {categories.map(cat => (
            <Tab key={cat} label={cat} sx={{ minHeight: 36, py: 0 }} />
          ))}
        </Tabs>
      )}

      {/* Plugin list */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 1.5 }}>
        {filteredPlugins.length === 0 ? (
          <EmptyState
            title="No plugins available"
            description="Add plugins to extend functionality"
          />
        ) : (
          <Stack spacing={1.5}>
            {filteredPlugins.map(plugin => (
              <PluginCard
                key={plugin.id}
                id={plugin.id}
                name={plugin.name}
                description={plugin.description}
                icon={plugin.icon}
                iconColor={plugin.iconColor}
                category={plugin.category}
                status={plugin.status}
                actions={plugin.actions}
                onConfigure={() => handleConfigure(plugin.id)}
                onConnect={() => handleConnect(plugin.id)}
                onDisconnect={() => handleDisconnect(plugin.id)}
                onActionSelect={(actionId) => handleActionSelect(plugin.id, actionId)}
                connecting={busyPlugins.has(plugin.id)}
              />
            ))}
          </Stack>
        )}
      </Box>

      {/* Configure dialog */}
      <Dialog
        open={view.type === 'configure'}
        onClose={handleBack}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          Configure {currentPlugin?.name}
          <IconButton size="small" onClick={handleBack}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {currentPlugin && (
            <CredentialsForm
              fields={currentPlugin.credentialFields}
              initialValues={currentPlugin.credentials}
              onTest={(values) => onTestConnection(currentPlugin.id, values)}
              onSave={async (values) => {
                await onSaveCredentials(currentPlugin.id, values);
                handleBack();
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Action input dialog */}
      <Dialog
        open={view.type === 'action'}
        onClose={handleBack}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {currentAction?.name || 'Execute Action'}
          <IconButton size="small" onClick={handleBack}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {currentPlugin && currentAction && view.type === 'action' && (
            <ActionInputForm
              config={{
                actionId: currentAction.id,
                actionName: currentAction.name,
                actionDescription: currentAction.description,
                fields: currentPlugin.actionInputSchemas?.[currentAction.id] || [],
              }}
              onExecute={(actionId, params) => handleExecute(currentPlugin.id, actionId, params)}
              onBack={handleBack}
              executing={executing}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Result dialog */}
      <Dialog
        open={view.type === 'result'}
        onClose={handleBack}
        maxWidth="md"
        fullWidth
      >
        <DialogContent sx={{ p: 0 }}>
          {view.type === 'result' && currentAction && (
            <ActionPreview
              actionName={currentAction.name}
              result={view.result}
              onOpenAsFile={onOpenAsFile}
              onClose={handleBack}
            />
          )}
        </DialogContent>
      </Dialog>
    </Panel>
  );
}
