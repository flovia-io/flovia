import { type ReactNode } from 'react';
import { getFileIcon } from '../../utils/fileIcons';

interface FileChipProps {
  name: string;
  path?: string;
  removable?: boolean;
  onRemove?: () => void;
  onClick?: () => void;
  active?: boolean;
  className?: string;
  icon?: ReactNode;
}

/**
 * Reusable file chip component for displaying attached files
 */
export default function FileChip({
  name,
  path,
  removable = false,
  onRemove,
  onClick,
  active = false,
  className = '',
  icon,
}: FileChipProps) {
  // Get file icon based on extension
  const fileIcon = icon ?? getFileIcon(name);

  return (
    <span
      className={`file-chip ${active ? 'file-chip-active' : ''} ${onClick ? 'file-chip-clickable' : ''} ${className}`}
      onClick={onClick}
      title={path ?? name}
    >
      <span className="file-chip-icon">{fileIcon}</span>
      <span className="file-chip-name">{name}</span>
      {removable && onRemove && (
        <button
          className="file-chip-remove"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          title="Remove"
        >
          ×
        </button>
      )}
    </span>
  );
}

/**
 * Inline file chip for use in messages
 */
export function FileChipInline({
  name,
  onClick,
  className = '',
}: Pick<FileChipProps, 'name' | 'onClick' | 'className'>) {
  const fileIcon = getFileIcon(name);

  return (
    <span
      className={`file-chip-inline ${onClick ? 'file-chip-clickable' : ''} ${className}`}
      onClick={onClick}
    >
      {fileIcon} {name}
    </span>
  );
}
