/**
 * WorkflowsSidebarPanel — Dedicated sidebar panel for managing workflows.
 *
 * Provides a full-height panel (like Explorer) containing:
 *   - Header with title + "New Workflow" button
 *   - Built-in workflow templates (read-only, cloneable)
 *   - Custom user workflows (editable, deletable)
 *   - Quick actions: create, clone, open in editor
 *
 * This is rendered when the "Workflows" icon is selected in the ActivityBar.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Chip,
  IconButton,
  Tooltip,
  Button,
  Divider,
  TextField,
  InputAdornment,
  CircularProgress,
} from '@mui/material';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import LockIcon from '@mui/icons-material/Lock';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import SearchIcon from '@mui/icons-material/Search';
import SmartToyIcon from '@mui/icons-material/SmartToy';

import { useBackend } from '../context/BackendContext';
import { useWorkspace } from '../context/WorkspaceContext';
import {
  BUILTIN_TEMPLATES,
  cloneTemplate,
  workflowHasAINode,
  type EditorWorkflow,
  type WorkflowTemplate,
} from './workflow';
import { Panel } from './mui';
import { ConfirmDialog } from './shared';

export default function WorkflowsSidebarPanel() {
  const backend = useBackend();
  const { folderPath, openWorkflowEditor } = useWorkspace();

  const [customWorkflows, setCustomWorkflows] = useState<EditorWorkflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterText, setFilterText] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  /* ── Load custom workflows ── */
  const loadWorkflows = useCallback(async () => {
    try {
      const all = (await backend.orchestratorListEditorWorkflows(
        folderPath || undefined,
      )) as EditorWorkflow[];
      setCustomWorkflows(all.filter(w => !w.id.startsWith('builtin:')));
    } catch {
      setCustomWorkflows([]);
    } finally {
      setLoading(false);
    }
  }, [backend, folderPath]);

  useEffect(() => {
    loadWorkflows();
  }, [loadWorkflows]);

  // Reload when a workflow is saved externally
  useEffect(() => {
    const handler = () => loadWorkflows();
    window.addEventListener('workflow-saved', handler);
    return () => window.removeEventListener('workflow-saved', handler);
  }, [loadWorkflows]);

  /* ── Actions ── */
  const handleOpenWorkflow = useCallback(
    (wfId: string, wfName: string) => openWorkflowEditor(wfId, wfName),
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
    async (wfId: string) => {
      await backend.orchestratorDeleteEditorWorkflow(wfId);
      setCustomWorkflows(prev => prev.filter(w => w.id !== wfId));
      window.dispatchEvent(new Event('workflow-saved'));
      setDeleteTarget(null);
    },
    [backend],
  );

  const handleNewWorkflow = useCallback(() => {
    openWorkflowEditor(undefined, undefined);
  }, [openWorkflowEditor]);

  /* ── Filtering ── */
  const lowerFilter = filterText.toLowerCase();
  const filteredTemplates = BUILTIN_TEMPLATES.filter(
    t => t.name.toLowerCase().includes(lowerFilter) || t.description?.toLowerCase().includes(lowerFilter),
  );
  const filteredCustom = customWorkflows.filter(
    w => w.name.toLowerCase().includes(lowerFilter) || w.description?.toLowerCase().includes(lowerFilter),
  );

  /* ══════════════════════════════
     Render
     ══════════════════════════════ */
  return (
    <Panel>
      {/* ── Header ── */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 1.5,
          py: 1,
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AccountTreeIcon fontSize="small" sx={{ color: 'primary.main' }} />
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Workflows
          </Typography>
        </Box>
        <Tooltip title="New Workflow">
          <IconButton size="small" onClick={handleNewWorkflow} sx={{ color: 'primary.main' }}>
            <AddIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* ── Search / Filter ── */}
      <Box sx={{ px: 1.5, py: 1 }}>
        <TextField
          placeholder="Filter workflows…"
          size="small"
          fullWidth
          value={filterText}
          onChange={e => setFilterText(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
              </InputAdornment>
            ),
            sx: { fontSize: '0.8rem', height: 32 },
          }}
        />
      </Box>

      {/* ── Create button ── */}
      <Box sx={{ px: 1.5, pb: 1 }}>
        <Button
          variant="outlined"
          fullWidth
          size="small"
          startIcon={<AddIcon />}
          onClick={handleNewWorkflow}
          sx={{
            textTransform: 'none',
            fontSize: '0.78rem',
            borderStyle: 'dashed',
            color: 'text.secondary',
            borderColor: 'divider',
            '&:hover': { borderStyle: 'dashed', borderColor: 'grey.400', bgcolor: 'rgba(0,0,0,0.02)' },
          }}
        >
          New Workflow
        </Button>
      </Box>

      <Divider />

      {/* ── Workflow lists ── */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={24} />
        </Box>
      ) : (
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          <List dense disablePadding>
            {/* ─── Built-in Templates ─── */}
            {filteredTemplates.length > 0 && (
              <>
                <ListSubheader
                  disableSticky
                  sx={{
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    lineHeight: '28px',
                    color: 'text.disabled',
                    bgcolor: 'transparent',
                  }}
                >
                  Templates
                </ListSubheader>
                {filteredTemplates.map(template => (
                  <ListItemButton
                    key={template.id}
                    onClick={() => handleOpenWorkflow(template.id, template.name)}
                    sx={{ py: 0.5, px: 1.5, minHeight: 36 }}
                  >
                    <ListItemIcon sx={{ minWidth: 30, fontSize: 16 }}>
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
                      secondaryTypographyProps={{
                        sx: {
                          fontSize: '0.65rem',
                          lineHeight: 1.3,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        },
                      }}
                    />
                    <Tooltip title="Clone as editable">
                      <IconButton
                        size="small"
                        onClick={e => {
                          e.stopPropagation();
                          handleCloneTemplate(template);
                        }}
                        sx={{ p: 0.25, opacity: 0.4, '&:hover': { opacity: 1 } }}
                      >
                        <ContentCopyIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Tooltip>
                  </ListItemButton>
                ))}
              </>
            )}

            {/* ─── Custom Workflows ─── */}
            <ListSubheader
              disableSticky
              sx={{
                fontSize: '0.65rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                lineHeight: '28px',
                color: 'text.disabled',
                bgcolor: 'transparent',
                mt: 0.5,
              }}
            >
              Custom{filteredCustom.length > 0 ? ` (${filteredCustom.length})` : ''}
            </ListSubheader>

            {filteredCustom.length === 0 && (
              <Box sx={{ px: 1.5, py: 2, textAlign: 'center' }}>
                <AccountTreeIcon sx={{ fontSize: 32, color: 'text.disabled', mb: 0.5 }} />
                <Typography variant="body2" sx={{ color: 'text.disabled', fontSize: '0.75rem' }}>
                  {filterText ? 'No matching workflows' : 'No custom workflows yet'}
                </Typography>
                {!filterText && (
                  <Button
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={handleNewWorkflow}
                    sx={{ mt: 1, fontSize: '0.72rem', textTransform: 'none' }}
                  >
                    Create one
                  </Button>
                )}
              </Box>
            )}

            {filteredCustom.map(wf => {
              const isAI = workflowHasAINode(wf);
              return (
                <ListItemButton
                  key={wf.id}
                  onClick={() => handleOpenWorkflow(wf.id, wf.name)}
                  sx={{ py: 0.5, px: 1.5, minHeight: 36 }}
                >
                  <ListItemIcon sx={{ minWidth: 30, fontSize: 16 }}>
                    {isAI ? <SmartToyIcon sx={{ fontSize: 16, color: 'primary.main' }} /> : '⚡'}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Typography variant="body2" sx={{ fontSize: '0.78rem', fontWeight: 500 }}>
                          {wf.name}
                        </Typography>
                        {isAI && (
                          <Chip
                            label="AI"
                            size="small"
                            color="primary"
                            variant="outlined"
                            sx={{ height: 14, fontSize: '0.55rem', '& .MuiChip-label': { px: 0.5 } }}
                          />
                        )}
                      </Box>
                    }
                    secondary={wf.description || `Updated ${new Date(wf.updatedAt).toLocaleDateString()}`}
                    secondaryTypographyProps={{
                      sx: {
                        fontSize: '0.65rem',
                        lineHeight: 1.3,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      },
                    }}
                  />
                  <Box sx={{ display: 'flex', gap: 0 }}>
                    <Tooltip title="Edit workflow">
                      <IconButton
                        size="small"
                        onClick={e => {
                          e.stopPropagation();
                          handleOpenWorkflow(wf.id, wf.name);
                        }}
                        sx={{ p: 0.25, opacity: 0.3, '&:hover': { opacity: 1 } }}
                      >
                        <EditIcon sx={{ fontSize: 13 }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete workflow">
                      <IconButton
                        size="small"
                        onClick={e => {
                          e.stopPropagation();
                          setDeleteTarget({ id: wf.id, name: wf.name });
                        }}
                        sx={{ p: 0.25, opacity: 0.3, '&:hover': { opacity: 1, color: 'error.main' } }}
                      >
                        <DeleteIcon sx={{ fontSize: 13 }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </ListItemButton>
              );
            })}
          </List>
        </Box>
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        open={deleteTarget !== null}
        title={`Delete "${deleteTarget?.name}"?`}
        message="This workflow will be permanently removed."
        confirmLabel="Delete"
        confirmColor="error"
        onConfirm={() => deleteTarget && handleDeleteWorkflow(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />
    </Panel>
  );
}
