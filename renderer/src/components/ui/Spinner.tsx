interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Loading spinner component
 */
export default function Spinner({ size = 'md', className = '' }: SpinnerProps) {
  const sizeClasses = {
    sm: 'spinner-sm',
    md: 'spinner-md',
    lg: 'spinner-lg',
  };

  return (
    <div className={`spinner ${sizeClasses[size]} ${className}`}>
      <div className="spinner-ring" />
    </div>
  );
}

/**
 * Inline typing dots animation
 */
export function TypingDots() {
  return (
    <span className="typing-dots">
      <span className="typing-dot" />
      <span className="typing-dot" />
      <span className="typing-dot" />
    </span>
  );
}
