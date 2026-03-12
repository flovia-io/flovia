/**
 * ActionPreview - Displays action result as a file preview
 * 
 * Shows the result of an action execution in a formatted preview.
 * Supports JSON, text, and other formats.
 */
import { useState, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Tooltip,
  Stack,
  Chip,
  Collapse,
  Button,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import DescriptionIcon from '@mui/icons-material/Description';
import ErrorIcon from '@mui/icons-material/Error';

interface ActionPreviewProps {
  actionName: string;
  result: {
    success: boolean;
    data?: unknown;
    error?: string;
  };
  onOpenAsFile?: (content: string, filename: string) => void;
  onClose?: () => void;
}

export default function ActionPreview({
  actionName,
  result,
  onOpenAsFile,
  onClose,
}: ActionPreviewProps) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const content = result.success
    ? typeof result.data === 'string'
      ? result.data
      : JSON.stringify(result.data, null, 2)
    : result.error || 'Unknown error';

  // Determine file extension based on content type
  const fileExtension = result.success && typeof result.data !== 'string' ? 'json' : 'txt';
  const filename = `${actionName.toLowerCase().replace(/\s+/g, '-')}-result.${fileExtension}`;

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [content]);

  const handleOpenAsFile = useCallback(() => {
    if (onOpenAsFile) {
      onOpenAsFile(content, filename);
    }
  }, [onOpenAsFile, content, filename]);

  return (
    <Paper 
      variant="outlined" 
      sx={{ 
        overflow: 'hidden',
        border: result.success ? 1 : 2,
        borderColor: result.success ? 'divider' : 'error.main',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 1.5,
          py: 1,
          bgcolor: result.success ? 'grey.50' : 'error.light',
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        {result.success ? (
          <DescriptionIcon fontSize="small" sx={{ color: 'text.secondary' }} />
        ) : (
          <ErrorIcon fontSize="small" color="error" />
        )}
        <Typography variant="body2" fontWeight={500} sx={{ flex: 1 }}>
          {actionName} Result
        </Typography>
        <Chip
          size="small"
          label={result.success ? 'Success' : 'Error'}
          color={result.success ? 'success' : 'error'}
          sx={{ height: 20, fontSize: '0.68rem' }}
        />
        <IconButton size="small" onClick={() => setExpanded(!expanded)}>
          {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
        </IconButton>
      </Box>

      {/* Content */}
      <Collapse in={expanded}>
        <Box
          sx={{
            maxHeight: 300,
            overflow: 'auto',
            bgcolor: 'grey.900',
            position: 'relative',
          }}
        >
          <Box
            component="pre"
            sx={{
              m: 0,
              p: 1.5,
              fontSize: '0.75rem',
              fontFamily: '"SF Mono", "Fira Code", monospace',
              color: result.success ? '#e0e0e0' : '#ef9a9a',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {content}
          </Box>

          {/* Copy button */}
          <Tooltip title={copied ? 'Copied!' : 'Copy to clipboard'}>
            <IconButton
              size="small"
              onClick={handleCopy}
              sx={{
                position: 'absolute',
                top: 8,
                right: 8,
                bgcolor: 'rgba(255,255,255,0.1)',
                color: 'grey.300',
                '&:hover': {
                  bgcolor: 'rgba(255,255,255,0.2)',
                },
              }}
            >
              {copied ? <CheckIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        </Box>
      </Collapse>

      {/* Actions */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 1,
          px: 1.5,
          py: 1,
          bgcolor: 'grey.50',
          borderTop: 1,
          borderColor: 'divider',
        }}
      >
        {onClose && (
          <Button size="small" variant="text" onClick={onClose}>
            Close
          </Button>
        )}
        {onOpenAsFile && result.success && (
          <Button 
            size="small" 
            variant="outlined" 
            startIcon={<DescriptionIcon />}
            onClick={handleOpenAsFile}
          >
            Open as File
          </Button>
        )}
      </Box>
    </Paper>
  );
}
