import { type ReactNode, type ButtonHTMLAttributes } from 'react';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'ghost' | 'danger';
  active?: boolean;
}

/**
 * Reusable icon button component
 */
export default function IconButton({
  icon,
  size = 'md',
  variant = 'default',
  active = false,
  className = '',
  ...props
}: IconButtonProps) {
  const sizeClasses = {
    sm: 'icon-btn-sm',
    md: 'icon-btn-md',
    lg: 'icon-btn-lg',
  };

  const variantClasses = {
    default: 'icon-btn-default',
    ghost: 'icon-btn-ghost',
    danger: 'icon-btn-danger',
  };

  return (
    <button
      className={`icon-btn ${sizeClasses[size]} ${variantClasses[variant]} ${active ? 'active' : ''} ${className}`}
      {...props}
    >
      {icon}
    </button>
  );
}
