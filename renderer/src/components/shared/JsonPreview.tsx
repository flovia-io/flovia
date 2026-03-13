/**
 * JsonPreview — Styled JSON viewer used for action results, API responses, etc.
 */
import { Box } from '@mui/material';

interface JsonPreviewProps {
  data: unknown;
  error?: boolean;
  maxHeight?: number;
}

export default function JsonPreview({ data, error = false, maxHeight = 400 }: JsonPreviewProps) {
  return (
    <Box sx={{ bgcolor: 'grey.900', maxHeight, overflow: 'auto' }}>
      <Box
        component="pre"
        sx={{
          m: 0,
          p: 2,
          fontSize: '0.75rem',
          fontFamily: '"SF Mono", "Fira Code", monospace',
          color: error ? '#ef9a9a' : '#e0e0e0',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {typeof data === 'string' ? data : JSON.stringify(data, null, 2)}
      </Box>
    </Box>
  );
}
