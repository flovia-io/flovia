/**
 * WorkflowListPanel — Shows all available workflows (built-in + custom).
 *
 * Displayed in the lower half of the Explorer sidebar.
 * Click a workflow to open it in the Workflow Editor tab.
 * Built-in templates are shown with a lock icon and "Clone" action.
 * Custom workflows with AI nodes are tagged as chat modes.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Chip,
  IconButton,
  Tooltip,
  Divider,
  Button,
} from '@mui/material';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import LockIcon from '@mui/icons-material/Lock';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';

import { useBackend } from '../context/BackendContext';
import { useWorkspace } from '../context/WorkspaceContext';
import {
  BUILTIN_TEMPLATES,
  cloneTemplate,
  workflowHasAINode,
  type EditorWorkflow,
  type WorkflowTemplate,
} from './workflow';

export default function WorkflowListPanel() {
  const backend = useBackend();
  const { folderPath, openWorkflowEditor } = useWorkspace();

  const [customWorkflows, setCustomWorkflows] = useState<EditorWorkflow[]>([]);
  const [loading, setLoading] = useState(true);

  // Load custom workflows
  const loadWorkflows = useCallback(async () => {
    try {
      const all = (await backend.orchestratorListEditorWorkflows(folderPath || undefined)) as EditorWorkflow[];
      setCustomWorkflows(all.filter(w => !w.id.startsWith('builtin:')));
    } catch {
      setCustomWorkflows([]);
    } finally {
      setLoading(false);
    }
  }, [backend]);

  useEffect(() => {
    loadWorkflows();
  }, [loadWorkflows]);

  // Re-load when a workflow is saved (listen for custom event)
  useEffect(() => {
    const handler = () => { loadWorkflows(); };
    window.addEventListener('workflow-saved', handler);
    return () => window.removeEventListener('workflow-saved', handler);
  }, [loadWorkflows]);

  const handleOpenWorkflow = useCallback(
    (wfId: string, wfName: string) => {
      openWorkflowEditor(wfId, wfName);
    },
    [openWorkflowEditor],
  );

  const handleCloneTemplate = useCallback(
    async (template: WorkflowTemplate) => {
      const cloned = cloneTemplate(template);
      await backend.orchestratorSaveEditorWorkflow(cloned, folderPath || undefined);
      setCustomWorkflows(prev => [...prev, cloned]);
      openWorkflowEditor(cloned.id, cloned.name);
      window.dispatchEvent(new Event('workflow-saved'));
    },
    [backend, folderPath, openWorkflowEditor],
  );

  const handleDeleteWorkflow = useCallback(
    async (e: React.MouseEvent, wfId: string) => {
      e.stopPropagation();
      await backend.orchestratorDeleteEditorWorkflow(wfId);
      setCustomWorkflows(prev => prev.filter(w => w.id !== wfId));
      window.dispatchEvent(new Event('workflow-saved'));
    },
    [backend],
  );

  const handleNewWorkflow = useCallback(() => {
    openWorkflowEditor(undefined, undefined);
  }, [openWorkflowEditor]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 1.5,
          py: 0.75,
          borderTop: 1,
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'rgba(0,0,0,0.02)',
          minHeight: 36,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <AccountTreeIcon sx={{ fontSize: 16, color: 'primary.main' }} />
          <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.68rem' }}>
            Workflows
          </Typography>
        </Box>
        <Tooltip title="New Workflow">
          <IconButton size="small" onClick={handleNewWorkflow} sx={{ p: 0.25 }}>
            <AddIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Scrollable list */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        <List dense disablePadding sx={{ py: 0.5 }}>
          {/* ── Built-in Templates ── */}
          <Typography
            variant="caption"
            sx={{ px: 1.5, py: 0.5, display: 'block', color: 'text.disabled', fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase' }}
          >
            Templates
          </Typography>
          {BUILTIN_TEMPLATES.map(template => (
            <ListItemButton
              key={template.id}
              onClick={() => handleOpenWorkflow(template.id, template.name)}
              sx={{ py: 0.35, px: 1.5, minHeight: 32 }}
            >
              <ListItemIcon sx={{ minWidth: 28, fontSize: 16 }}>
                {template.icon}
              </ListItemIcon>
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Typography variant="body2" sx={{ fontSize: '0.78rem', fontWeight: 500 }}>
                      {template.name}
                    </Typography>
                    <LockIcon sx={{ fontSize: 10, color: 'text.disabled' }} />
                  </Box>
                }
                secondary={template.description}
                secondaryTypographyProps={{ sx: { fontSize: '0.65rem', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }}
              />
              <Tooltip title="Clone as editable">
                <IconButton
                  size="small"
                  onClick={(e) => { e.stopPropagation(); handleCloneTemplate(template); }}
                  sx={{ p: 0.25, opacity: 0.5, '&:hover': { opacity: 1 } }}
                >
                  <ContentCopyIcon sx={{ fontSize: 13 }} />
                </IconButton>
              </Tooltip>
            </ListItemButton>
          ))}

          {/* ── Custom Workflows ── */}
          {(customWorkflows.length > 0 || !loading) && (
            <Typography
              variant="caption"
              sx={{ px: 1.5, pt: 1, pb: 0.5, display: 'block', color: 'text.disabled', fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase' }}
            >
              Custom
            </Typography>
          )}
          {customWorkflows.map(wf => {
            const isAI = workflowHasAINode(wf);
            return (
              <ListItemButton
                key={wf.id}
                onClick={() => handleOpenWorkflow(wf.id, wf.name)}
                sx={{ py: 0.35, px: 1.5, minHeight: 32 }}
              >
                <ListItemIcon sx={{ minWidth: 28, fontSize: 16 }}>⚡</ListItemIcon>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Typography variant="body2" sx={{ fontSize: '0.78rem', fontWeight: 500 }}>
                        {wf.name}
                      </Typography>
                      {isAI && (
                        <Chip
                          label="chat mode"
                          size="small"
                          color="primary"
                          variant="outlined"
                          sx={{ height: 14, fontSize: '0.55rem', '& .MuiChip-label': { px: 0.5 } }}
                        />
                      )}
                    </Box>
                  }
                  secondary={wf.description || `Updated ${new Date(wf.updatedAt).toLocaleDateString()}`}
                  secondaryTypographyProps={{ sx: { fontSize: '0.65rem', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }}
                />
                <Tooltip title="Delete workflow">
                  <IconButton
                    size="small"
                    onClick={(e) => handleDeleteWorkflow(e, wf.id)}
                    sx={{ p: 0.25, opacity: 0.3, '&:hover': { opacity: 1, color: 'error.main' } }}
                  >
                    <DeleteIcon sx={{ fontSize: 13 }} />
                  </IconButton>
                </Tooltip>
              </ListItemButton>
            );
          })}

          {!loading && customWorkflows.length === 0 && (
            <Box sx={{ px: 1.5, py: 1 }}>
              <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.7rem' }}>
                No custom workflows yet.
              </Typography>
              <Button
                size="small"
                startIcon={<AddIcon />}
                onClick={handleNewWorkflow}
                sx={{ mt: 0.5, fontSize: '0.7rem', textTransform: 'none' }}
              >
                Create one
              </Button>
            </Box>
          )}
        </List>
      </Box>
    </Box>
  );
}
