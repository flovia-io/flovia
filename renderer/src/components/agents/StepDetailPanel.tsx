/**
 * StepDetailPanel — n8n-style detail view for a single trace step.
 * Shows parameters, input data, output data, and settings in tabs.
 */
import { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import MuiTabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import DescriptionIcon from '@mui/icons-material/Description';
import type { TraceStep } from '../../types/agent.types';
import { getCategoryColors } from './agent.constants';

/* ─── Helpers ─── */

const STEP_TYPE_ICONS: Record<string, string> = {
  'llm-call': '🧠',
  'file-read': '📖',
  'file-write': '💾',
  'file-search': '🔍',
  'text-search': '🔎',
  'integration-call': '🔌',
};

function stepIcon(type: string): string {
  return STEP_TYPE_ICONS[type] ?? '⚡';
}

function toEntries(data: unknown): [string, unknown][] {
  if (data == null) return [];
  if (typeof data === 'object' && !Array.isArray(data)) {
    return Object.entries(data as Record<string, unknown>);
  }
  return [['data', data]];
}

/* ─── Reusable data table ─── */

function DataTable({
  entries,
  emptyIcon,
  emptyMsg,
}: {
  entries: [string, unknown][];
  emptyIcon: string;
  emptyMsg: string;
}) {
  if (entries.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 5, color: '#bdbdbd' }}>
        <Typography sx={{ fontSize: '1.5rem', mb: 0.5 }}>{emptyIcon}</Typography>
        <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, color: '#9e9e9e' }}>{emptyMsg}</Typography>
      </Box>
    );
  }

  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
      <Box
        sx={{
          display: 'grid', gridTemplateColumns: '0.3fr 1fr',
          fontSize: '0.68rem', fontWeight: 700, color: '#9e9e9e',
          px: 1.5, py: 1, bgcolor: '#fafafa',
          borderBottom: '1px solid #e0e0e0', textTransform: 'uppercase',
        }}
      >
        <span>Field</span><span>Value</span>
      </Box>
      {entries.map(([key, val], i) => (
        <Box
          key={key}
          sx={{
            display: 'grid', gridTemplateColumns: '0.3fr 1fr',
            px: 1.5, py: 1, fontSize: '0.74rem',
            borderBottom: i < entries.length - 1 ? '1px solid #f5f5f5' : 'none',
            alignItems: 'start',
          }}
        >
          <Typography sx={{ fontWeight: 600, color: '#616161', fontFamily: 'monospace', fontSize: '0.7rem' }}>{key}</Typography>
          <Box
            component="pre"
            sx={{
              m: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              fontSize: '0.7rem', color: '#333', fontFamily: 'monospace',
              maxHeight: 200, overflow: 'auto',
            }}
          >
            {typeof val === 'string' ? val : JSON.stringify(val, null, 2)}
          </Box>
        </Box>
      ))}
    </Paper>
  );
}

/* ─── Main component ─── */

interface StepDetailPanelProps {
  step: TraceStep;
}

export default function StepDetailPanel({ step }: StepDetailPanelProps) {
  const [tab, setTab] = useState(0);
  const colors = getCategoryColors(step.category);

  const inputEntries = toEntries(step.input);
  const outputEntries = toEntries(step.output);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid #e0e0e0', bgcolor: '#fff', display: 'flex', alignItems: 'center', gap: 1.25 }}>
        <Typography sx={{ fontSize: '1.1rem' }}>{stepIcon(step.type)}</Typography>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: '#1a1a2e' }}>{step.nodeLabel}</Typography>
          <Typography sx={{ fontSize: '0.68rem', color: '#9e9e9e' }}>{step.summary}</Typography>
        </Box>
        <Chip label={step.category} size="small" sx={{ fontWeight: 700, color: colors.accent, bgcolor: `${colors.accent}12`, textTransform: 'uppercase', fontSize: '0.6rem' }} />
        {step.durationMs != null && (
          <Typography sx={{ fontSize: '0.68rem', color: '#bdbdbd' }}>{step.durationMs}ms</Typography>
        )}
      </Box>

      {/* Tabs */}
      <MuiTabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{
          borderBottom: '1px solid #e0e0e0', bgcolor: '#fff', minHeight: 36,
          '& .MuiTab-root': { minHeight: 36, fontSize: '0.72rem', textTransform: 'none', py: 0.5 },
          '& .MuiTabs-indicator': { bgcolor: colors.accent },
        }}
      >
        <Tab label="Parameters" />
        <Tab label={`Input${inputEntries.length ? ` (${inputEntries.length})` : ''}`} />
        <Tab label={`Output${outputEntries.length ? ` (${outputEntries.length})` : ''}`} />
        <Tab label="Settings" />
      </MuiTabs>

      {/* Content */}
      <Box sx={{ flex: 1, overflowY: 'auto', bgcolor: '#fafafa', p: 2 }}>
        {tab === 0 && (
          <Stack spacing={1.5}>
            {step.error && <Alert severity="error" sx={{ fontSize: '0.75rem' }}><strong>Error:</strong> {step.error}</Alert>}
            <Box>
              <Typography variant="overline" sx={{ fontSize: '0.65rem', color: '#9e9e9e' }}>Method</Typography>
              <Paper variant="outlined" sx={{ p: 1, display: 'flex', alignItems: 'center', gap: 1, borderRadius: 2 }}>
                <Chip
                  label={step.type === 'llm-call' ? 'LLM' : step.type.toUpperCase()}
                  size="small"
                  sx={{
                    fontWeight: 700, fontSize: '0.68rem', fontFamily: 'monospace',
                    bgcolor: step.type === 'llm-call' ? '#e3f2fd' : '#e8f5e9',
                    color: step.type === 'llm-call' ? '#1565c0' : '#2e7d32',
                  }}
                />
                <Typography sx={{ fontSize: '0.76rem' }}>{step.nodeLabel}</Typography>
              </Paper>
            </Box>
            <Box>
              <Typography variant="overline" sx={{ fontSize: '0.65rem', color: '#9e9e9e' }}>Target</Typography>
              <Chip
                icon={<AutoFixHighIcon sx={{ fontSize: 14 }} />}
                label="Defined automatically by the model"
                size="small"
                sx={{ mb: 0.5, fontSize: '0.68rem', color: '#7c3aed', bgcolor: '#f5f3ff', border: '1px solid #ddd6fe' }}
              />
              <Paper variant="outlined" sx={{ p: 1, borderRadius: 2 }}>
                <Typography sx={{ fontSize: '0.76rem', fontFamily: 'monospace', color: '#333' }}>
                  {step.type === 'llm-call' ? 'AI Model Endpoint' : step.type === 'file-read' || step.type === 'file-write' ? 'Workspace File System' : 'Tool Invocation'}
                </Typography>
              </Paper>
            </Box>
            {step.chosenFiles && step.chosenFiles.length > 0 && (
              <Box>
                <Typography variant="overline" sx={{ fontSize: '0.65rem', color: '#9e9e9e' }}>
                  Chosen Files ({step.chosenFiles.length})
                </Typography>
                <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
                  {step.chosenFiles.map((f, i) => (
                    <Box
                      key={i}
                      sx={{
                        px: 1.5, py: 0.75, fontSize: '0.72rem',
                        borderBottom: i < step.chosenFiles!.length - 1 ? '1px solid #f5f5f5' : 'none',
                        display: 'flex', alignItems: 'center', gap: 0.5,
                      }}
                    >
                      <DescriptionIcon sx={{ fontSize: 14, color: '#1976d2' }} /> {f}
                    </Box>
                  ))}
                </Paper>
              </Box>
            )}
            {step.tokens && (
              <Box>
                <Typography variant="overline" sx={{ fontSize: '0.65rem', color: '#9e9e9e' }}>Token Usage</Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  {(['prompt', 'completion', 'total'] as const).map(k => (
                    <Paper key={k} variant="outlined" sx={{ flex: 1, textAlign: 'center', p: 1, borderRadius: 2 }}>
                      <Typography sx={{ fontSize: '1rem', fontWeight: 700 }}>{step.tokens![k]}</Typography>
                      <Typography variant="overline" sx={{ fontSize: '0.55rem', color: '#9e9e9e' }}>{k}</Typography>
                    </Paper>
                  ))}
                </Box>
              </Box>
            )}
          </Stack>
        )}
        {tab === 1 && <DataTable entries={inputEntries} emptyIcon="→|" emptyMsg="No input data" />}
        {tab === 2 && <DataTable entries={outputEntries} emptyIcon="|→" emptyMsg="No output data" />}
        {tab === 3 && (
          <Stack spacing={1.5}>
            <Alert severity="info" sx={{ fontSize: '0.72rem' }}>Execution will continue even if the node fails</Alert>
            {([
              ['Node ID', step.nodeId],
              ['Type', step.type],
              ['Category', step.category],
              ['Timestamp', new Date(step.timestamp).toLocaleString()],
            ] as const).map(([label, val]) => (
              <Box key={label}>
                <Typography variant="overline" sx={{ fontSize: '0.65rem', color: '#9e9e9e' }}>{label}</Typography>
                <Paper variant="outlined" sx={{ p: 1, borderRadius: 2 }}>
                  <Typography sx={{ fontSize: '0.76rem', fontFamily: 'monospace' }}>{val}</Typography>
                </Paper>
              </Box>
            ))}
          </Stack>
        )}
      </Box>
    </Box>
  );
}
