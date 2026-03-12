import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  icon?: ReactNode;
  iconPosition?: 'left' | 'right';
}

/**
 * Reusable input component
 */
const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ error, icon, iconPosition = 'left', className = '', ...props }, ref) => {
    return (
      <div className={`input-wrapper ${error ? 'has-error' : ''} ${icon ? `has-icon icon-${iconPosition}` : ''}`}>
        {icon && iconPosition === 'left' && <span className="input-icon">{icon}</span>}
        <input
          ref={ref}
          className={`input ${className}`}
          {...props}
        />
        {icon && iconPosition === 'right' && <span className="input-icon">{icon}</span>}
        {error && <span className="input-error">{error}</span>}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
