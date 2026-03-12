import { forwardRef, type TextareaHTMLAttributes, type ChangeEvent } from 'react';

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  autoResize?: boolean;
  maxHeight?: number;
  error?: string;
}

/**
 * Reusable textarea component with auto-resize support
 */
const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ autoResize = false, maxHeight = 150, error, className = '', onChange, ...props }, ref) => {
    const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
      if (autoResize) {
        const target = e.target;
        target.style.height = 'auto';
        target.style.height = Math.min(target.scrollHeight, maxHeight) + 'px';
      }
      onChange?.(e);
    };

    return (
      <div className={`textarea-wrapper ${error ? 'has-error' : ''}`}>
        <textarea
          ref={ref}
          className={`textarea ${className}`}
          onChange={handleChange}
          {...props}
        />
        {error && <span className="textarea-error">{error}</span>}
      </div>
    );
  }
);

TextArea.displayName = 'TextArea';

export default TextArea;
