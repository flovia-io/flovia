import { type ReactNode, type ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: ReactNode;
  children?: ReactNode;
  loading?: boolean;
}

/**
 * Reusable button component with variants
 */
export default function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  children,
  loading,
  disabled,
  className = '',
  ...props
}: ButtonProps) {
  const baseClass = 'btn';
  const variantClass = `btn-${variant}`;
  const sizeClass = `btn-${size}`;
  
  return (
    <button
      className={`${baseClass} ${variantClass} ${sizeClass} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <span className="btn-spinner" />}
      {icon && !loading && <span className="btn-icon">{icon}</span>}
      {children && <span className="btn-text">{children}</span>}
    </button>
  );
}
