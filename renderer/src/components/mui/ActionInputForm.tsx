/**
 * ActionInputForm - Form for action input parameters
 * 
 * Renders input fields for action parameters with prefill support.
 * Shows the result as a preview when executed.
 */
import { useState, useCallback } from 'react';
import {
  Box,
  Button,
  Stack,
  Typography,
  Alert,
  Divider,
  IconButton,
  Tooltip,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import FormField, { type FieldConfig } from './FormField';

export interface ActionInputConfig {
  actionId: string;
  actionName: string;
  actionDescription?: string;
  fields: FieldConfig[];
  prefillValues?: Record<string, string | boolean | number>;
}

interface ActionInputFormProps {
  config: ActionInputConfig;
  onExecute: (actionId: string, params: Record<string, string | boolean | number>) => Promise<void>;
  onBack?: () => void;
  executing?: boolean;
}

export default function ActionInputForm({
  config,
  onExecute,
  onBack,
  executing,
}: ActionInputFormProps) {
  const [values, setValues] = useState<Record<string, string | boolean | number>>(() => {
    const defaults: Record<string, string | boolean | number> = {};
    config.fields.forEach(f => {
      if (config.prefillValues && f.key in config.prefillValues) {
        defaults[f.key] = config.prefillValues[f.key];
      } else if (f.defaultValue !== undefined) {
        defaults[f.key] = f.defaultValue;
      } else {
        defaults[f.key] = f.type === 'boolean' ? false : '';
      }
    });
    return defaults;
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = useCallback((key: string, value: string | boolean | number) => {
    setValues(prev => ({ ...prev, [key]: value }));
    setErrors(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const validate = useCallback(() => {
    const newErrors: Record<string, string> = {};
    config.fields.forEach(field => {
      if (field.required && !values[field.key]) {
        newErrors[field.key] = `${field.label} is required`;
      }
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [config.fields, values]);

  const handleExecute = useCallback(async () => {
    if (!validate()) return;
    await onExecute(config.actionId, values);
  }, [validate, onExecute, config.actionId, values]);

  const copyAsJson = useCallback(() => {
    navigator.clipboard.writeText(JSON.stringify(values, null, 2));
  }, [values]);

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <PlayArrowIcon fontSize="small" sx={{ color: 'primary.main' }} />
          <Typography variant="subtitle2" fontWeight={600}>
            {config.actionName}
          </Typography>
        </Stack>
        {config.actionDescription && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
            {config.actionDescription}
          </Typography>
        )}
      </Box>

      <Divider sx={{ mb: 2 }} />

      {/* Form fields */}
      {config.fields.length > 0 ? (
        <Stack spacing={2}>
          {config.fields.map(field => (
            <FormField
              key={field.key}
              field={field}
              value={values[field.key]}
              onChange={handleChange}
              error={errors[field.key]}
            />
          ))}
        </Stack>
      ) : (
        <Alert severity="info" sx={{ mb: 2 }}>
          This action has no input parameters.
        </Alert>
      )}

      {/* Actions */}
      <Stack 
        direction="row" 
        spacing={1} 
        justifyContent="space-between" 
        alignItems="center"
        sx={{ mt: 3 }}
      >
        <Stack direction="row" spacing={1}>
          {onBack && (
            <Button variant="text" size="small" onClick={onBack}>
              ← Back
            </Button>
          )}
        </Stack>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Copy parameters as JSON">
            <IconButton size="small" onClick={copyAsJson}>
              <ContentCopyIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Button
            variant="contained"
            size="small"
            startIcon={<PlayArrowIcon />}
            onClick={handleExecute}
            disabled={executing}
          >
            {executing ? 'Executing…' : 'Execute'}
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
