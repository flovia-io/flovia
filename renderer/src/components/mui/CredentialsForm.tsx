/**
 * CredentialsForm - Unified credentials configuration form
 * 
 * Renders a form for plugin/connector credentials based on field configuration.
 * Supports testing connection and saving credentials.
 */
import { useState, useCallback } from 'react';
import { 
  Box, 
  Button, 
  Stack, 
  Alert, 
  Typography,
  Collapse,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import FormField, { type FieldConfig } from './FormField';

interface CredentialsFormProps {
  title?: string;
  fields: FieldConfig[];
  initialValues?: Record<string, string | boolean | number>;
  onSave: (values: Record<string, string | boolean | number>) => Promise<void>;
  onTest?: (values: Record<string, string | boolean | number>) => Promise<{ success: boolean; error?: string }>;
  saveLabel?: string;
  testLabel?: string;
}

export default function CredentialsForm({
  title,
  fields,
  initialValues = {},
  onSave,
  onTest,
  saveLabel = 'Save',
  testLabel = 'Test Connection',
}: CredentialsFormProps) {
  const [values, setValues] = useState<Record<string, string | boolean | number>>(() => {
    const defaults: Record<string, string | boolean | number> = {};
    fields.forEach(f => {
      if (f.key in initialValues) {
        defaults[f.key] = initialValues[f.key];
      } else if (f.defaultValue !== undefined) {
        defaults[f.key] = f.defaultValue;
      } else {
        defaults[f.key] = f.type === 'boolean' ? false : '';
      }
    });
    return defaults;
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleChange = useCallback((key: string, value: string | boolean | number) => {
    setValues(prev => ({ ...prev, [key]: value }));
    setErrors(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setTestResult(null);
    setSaveError(null);
  }, []);

  const validate = useCallback(() => {
    const newErrors: Record<string, string> = {};
    fields.forEach(field => {
      if (field.required && !values[field.key]) {
        newErrors[field.key] = `${field.label} is required`;
      }
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [fields, values]);

  const handleTest = useCallback(async () => {
    if (!onTest || !validate()) return;
    
    setTesting(true);
    setTestResult(null);
    try {
      const result = await onTest(values);
      setTestResult(result);
    } catch (err) {
      setTestResult({ success: false, error: (err as Error).message });
    } finally {
      setTesting(false);
    }
  }, [onTest, validate, values]);

  const handleSave = useCallback(async () => {
    if (!validate()) return;

    setSaving(true);
    setSaveError(null);
    try {
      await onSave(values);
    } catch (err) {
      setSaveError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }, [validate, onSave, values]);

  return (
    <Box>
      {title && (
        <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
          {title}
        </Typography>
      )}
      
      <Stack spacing={2}>
        {fields.map(field => (
          <FormField
            key={field.key}
            field={field}
            value={values[field.key]}
            onChange={handleChange}
            error={errors[field.key]}
          />
        ))}
      </Stack>

      {/* Test result */}
      <Collapse in={!!testResult}>
        <Alert
          severity={testResult?.success ? 'success' : 'error'}
          icon={testResult?.success ? <CheckCircleIcon /> : undefined}
          sx={{ mt: 2 }}
        >
          {testResult?.success ? 'Connection successful!' : testResult?.error || 'Connection failed'}
        </Alert>
      </Collapse>

      {/* Save error */}
      <Collapse in={!!saveError}>
        <Alert severity="error" sx={{ mt: 2 }}>
          {saveError}
        </Alert>
      </Collapse>

      {/* Actions */}
      <Stack direction="row" spacing={1} sx={{ mt: 3 }}>
        {onTest && (
          <Button
            variant="outlined"
            size="small"
            onClick={handleTest}
            disabled={testing || saving}
          >
            {testing ? 'Testing…' : testLabel}
          </Button>
        )}
        <Button
          variant="contained"
          size="small"
          onClick={handleSave}
          disabled={saving || testing}
        >
          {saving ? 'Saving…' : saveLabel}
        </Button>
      </Stack>
    </Box>
  );
}
