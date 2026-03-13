/**
 * ExpandableListItem — A collapsible list row used across connector panels.
 *
 * Provides a clickable header row with a chevron, indicator dot,
 * primary & secondary text, and a date — plus an expandable detail area.
 */
import { type ReactNode } from 'react';
import { ChevronDownIcon, ChevronRightIcon } from '../icons';

interface ExpandableListItemProps {
  /** Unique key (for expand tracking at parent level) */
  id: string;
  expanded: boolean;
  onToggle: (id: string) => void;
  /** Colour of the leading status dot */
  indicatorColor?: string;
  /** Whether the row should look "unread" / bold */
  highlighted?: boolean;
  /** Primary label */
  primary: string;
  /** Secondary label (shown after primary, dimmer) */
  secondary?: string;
  /** Right-aligned date/time string */
  date?: string;
  /** CSS class prefix — defaults to "gm" */
  classPrefix?: string;
  /** Content rendered when expanded */
  children?: ReactNode;
}

export default function ExpandableListItem({
  id,
  expanded,
  onToggle,
  indicatorColor,
  highlighted = false,
  primary,
  secondary,
  date,
  classPrefix = 'gm',
  children,
}: ExpandableListItemProps) {
  const cls = classPrefix;

  return (
    <div className={`${cls}-message-group`}>
      <div
        className={`${cls}-message-item${highlighted ? ' unread' : ''}`}
        onClick={() => onToggle(id)}
      >
        <span className={`${cls}-chevron`}>
          {expanded ? <ChevronDownIcon size={12} /> : <ChevronRightIcon size={12} />}
        </span>
        {indicatorColor !== undefined && (
          <span className={`${cls}-message-indicator`} style={indicatorColor ? { color: indicatorColor } : undefined}>
            {highlighted ? '●' : '○'}
          </span>
        )}
        <span className={`${cls}-message-from`}>{primary}</span>
        {secondary && (
          <span className={`${cls}-message-subject`}>{secondary}</span>
        )}
        {date && (
          <span className={`${cls}-message-date`}>{date}</span>
        )}
      </div>

      {expanded && (
        <div className={`${cls}-message-detail`}>
          {children}
        </div>
      )}
    </div>
  );
}
