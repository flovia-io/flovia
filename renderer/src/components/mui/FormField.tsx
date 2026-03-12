/**
 * FormField - Reusable form field component
 * 
 * Renders different input types based on field configuration.
 * Used in credentials forms and action inputs.
 */
import { 
  TextField, 
  Select, 
  MenuItem, 
  FormControl, 
  InputLabel,
  FormHelperText,
  Switch,
  FormControlLabel,
  InputAdornment,
  IconButton,
  type TextFieldProps,
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { useState } from 'react';

export interface FieldConfig {
  key: string;
  label: string;
  type: 'text' | 'password' | 'url' | 'email' | 'select' | 'boolean' | 'textarea' | 'number';
  placeholder?: string;
  required?: boolean;
  options?: { label: string; value: string }[];
  helpText?: string;
  defaultValue?: string | boolean | number;
  disabled?: boolean;
  multiline?: boolean;
  rows?: number;
}

interface FormFieldProps {
  field: FieldConfig;
  value: string | boolean | number;
  onChange: (key: string, value: string | boolean | number) => void;
  error?: string;
  size?: 'small' | 'medium';
}

export default function FormField({ 
  field, 
  value, 
  onChange, 
  error,
  size = 'small',
}: FormFieldProps) {
  const [showPassword, setShowPassword] = useState(false);

  // Boolean field
  if (field.type === 'boolean') {
    return (
      <FormControl fullWidth error={!!error}>
        <FormControlLabel
          control={
            <Switch
              checked={Boolean(value)}
              onChange={(e) => onChange(field.key, e.target.checked)}
              disabled={field.disabled}
              size={size}
            />
          }
          label={field.label}
          sx={{ ml: 0 }}
        />
        {field.helpText && (
          <FormHelperText sx={{ ml: 0 }}>{field.helpText}</FormHelperText>
        )}
        {error && <FormHelperText error>{error}</FormHelperText>}
      </FormControl>
    );
  }

  // Select field
  if (field.type === 'select' && field.options) {
    return (
      <FormControl fullWidth size={size} error={!!error}>
        <InputLabel>{field.label}</InputLabel>
        <Select
          value={value || ''}
          label={field.label}
          onChange={(e) => onChange(field.key, e.target.value)}
          disabled={field.disabled}
        >
          {field.options.map((opt) => (
            <MenuItem key={opt.value} value={opt.value}>
              {opt.label}
            </MenuItem>
          ))}
        </Select>
        {field.helpText && <FormHelperText>{field.helpText}</FormHelperText>}
        {error && <FormHelperText error>{error}</FormHelperText>}
      </FormControl>
    );
  }

  // Password field with visibility toggle
  if (field.type === 'password') {
    return (
      <TextField
        fullWidth
        size={size}
        label={field.label}
        type={showPassword ? 'text' : 'password'}
        value={value || ''}
        onChange={(e) => onChange(field.key, e.target.value)}
        placeholder={field.placeholder}
        required={field.required}
        disabled={field.disabled}
        error={!!error}
        helperText={error || field.helpText}
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                size="small"
                onClick={() => setShowPassword(!showPassword)}
                edge="end"
              >
                {showPassword ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
              </IconButton>
            </InputAdornment>
          ),
        }}
      />
    );
  }

  // Textarea field
  if (field.type === 'textarea' || field.multiline) {
    return (
      <TextField
        fullWidth
        size={size}
        label={field.label}
        value={value || ''}
        onChange={(e) => onChange(field.key, e.target.value)}
        placeholder={field.placeholder}
        required={field.required}
        disabled={field.disabled}
        error={!!error}
        helperText={error || field.helpText}
        multiline
        rows={field.rows || 3}
      />
    );
  }

  // Default text/url/email/number field
  const inputType: TextFieldProps['type'] = 
    field.type === 'number' ? 'number' : 
    field.type === 'email' ? 'email' : 
    field.type === 'url' ? 'url' : 'text';

  return (
    <TextField
      fullWidth
      size={size}
      label={field.label}
      type={inputType}
      value={value ?? ''}
      onChange={(e) => onChange(field.key, field.type === 'number' ? Number(e.target.value) : e.target.value)}
      placeholder={field.placeholder}
      required={field.required}
      disabled={field.disabled}
      error={!!error}
      helperText={error || field.helpText}
    />
  );
}
