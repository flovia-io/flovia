/**
 * TraceStepRow — A single row in the execution trace list.
 */
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import type { TraceStep } from '../../types/agent.types';
import { getCategoryColors } from './agent.constants';

const STATUS_ICONS: Record<string, React.ReactNode> = {
  running: <HourglassEmptyIcon sx={{ fontSize: 16, color: '#f9a825' }} />,
  success: <CheckCircleIcon sx={{ fontSize: 16, color: '#43a047' }} />,
  error:   <ErrorIcon sx={{ fontSize: 16, color: '#e53935' }} />,
};

interface TraceStepRowProps {
  step: TraceStep;
  selected: boolean;
  onSelect: () => void;
}

export default function TraceStepRow({ step, selected, onSelect }: TraceStepRowProps) {
  const colors = getCategoryColors(step.category);
  const statusIcon = STATUS_ICONS[step.status] ?? <SkipNextIcon sx={{ fontSize: 16, color: '#9e9e9e' }} />;

  return (
    <Box
      onClick={onSelect}
      sx={{
        display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 1,
        cursor: 'pointer',
        bgcolor: selected ? '#e3f2fd' : 'transparent',
        borderLeft: selected ? '3px solid #1976d2' : '3px solid transparent',
        borderBottom: '1px solid #f5f5f5',
        transition: 'all 0.15s',
        '&:hover': { bgcolor: '#f5f5f5' },
      }}
    >
      {statusIcon}
      <Chip
        label={step.category}
        size="small"
        sx={{ height: 18, fontSize: '0.55rem', fontWeight: 700, color: colors.accent, bgcolor: `${colors.accent}12` }}
      />
      <Typography
        sx={{
          fontWeight: 600, fontSize: '0.73rem', color: '#333',
          flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}
      >
        {step.summary}
      </Typography>
      {step.durationMs != null && (
        <Typography sx={{ fontSize: '0.6rem', color: '#bdbdbd', flexShrink: 0 }}>
          {step.durationMs}ms
        </Typography>
      )}
    </Box>
  );
}
