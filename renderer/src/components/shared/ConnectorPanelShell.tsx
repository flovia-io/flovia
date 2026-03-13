/**
 * ConnectorPanelShell — Shared layout shell for service-connector sidebar panels
 * (Gmail, DigitalOcean, Atlassian, etc.)
 *
 * Provides:
 * - Header with icon, title, refresh & add/disconnect buttons
 * - Connection form (show/hide with field config)
 * - Connected account indicator
 * - Error / Loading / Empty states
 * - Children slot for the panel-specific content
 */
import { type ReactNode } from 'react';
import { ChevronDownIcon, ChevronRightIcon, RefreshIcon } from '../icons';

/* ─── Types ─── */

export interface ConnectorField {
  key: string;
  label: string;
  type?: 'text' | 'password' | 'email';
  placeholder?: string;
}

export interface ConnectorPanelShellProps {
  /** Panel title shown in the header */
  title: string;
  /** Panel icon (ReactNode, typically an SVG component) */
  icon: ReactNode;
  /** CSS class prefix — defaults to "gm" to reuse existing styles */
  classPrefix?: string;

  /* ─ connection state ─ */
  connected: boolean;
  /** Short label shown next to the green dot when connected (e.g. email or "Connected") */
  connectedLabel?: string;

  /* ─ connection form ─ */
  showForm: boolean;
  onToggleForm: (show: boolean) => void;
  formFields: ConnectorField[];
  formValues: Record<string, string>;
  onFormChange: (key: string, value: string) => void;
  formError?: string;
  formBusy?: boolean;
  formBusyLabel?: string;
  formSubmitLabel?: string;
  onFormSubmit: () => void;
  onFormCancel: () => void;
  /** Optional help text shown below the form fields */
  formHelp?: ReactNode;

  /* ─ header actions ─ */
  onRefresh?: () => void;
  refreshing?: boolean;
  onDisconnect?: () => void;

  /* ─ content states ─ */
  error?: string | null;
  onRetry?: () => void;
  loading?: boolean;
  loadingLabel?: string;
  empty?: boolean;
  emptyLabel?: string;

  /** The main panel body when connected */
  children?: ReactNode;
}

export default function ConnectorPanelShell({
  title,
  icon,
  classPrefix = 'gm',
  connected,
  connectedLabel,
  showForm,
  onToggleForm,
  formFields,
  formValues,
  onFormChange,
  formError,
  formBusy = false,
  formBusyLabel = 'Testing…',
  formSubmitLabel = 'Connect',
  onFormSubmit,
  onFormCancel,
  formHelp,
  onRefresh,
  refreshing = false,
  onDisconnect,
  error,
  onRetry,
  loading = false,
  loadingLabel = 'Loading…',
  empty = false,
  emptyLabel = 'Nothing found.',
  children,
}: ConnectorPanelShellProps) {
  const cls = classPrefix;

  // ── Not connected & form hidden ──
  if (!connected && !showForm) {
    return (
      <div className={`${cls}-panel`}>
        <div className={`${cls}-panel-header`}>
          {icon}
          <h2>{title}</h2>
        </div>
        <div className={`${cls}-panel-empty`}>
          <p>No {title} account connected.</p>
          <p className={`${cls}-hint`}>Connect your {title} account to get started.</p>
          <button className={`${cls}-add-btn`} onClick={() => onToggleForm(true)}>
            <span>＋</span> Connect {title}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`${cls}-panel`}>
      {/* ── Header ── */}
      <div className={`${cls}-panel-header`}>
        {icon}
        <h2>{title}</h2>
        <div className={`${cls}-panel-header-actions`}>
          {connected && onRefresh && (
            <button
              className={`${cls}-refresh-btn`}
              onClick={onRefresh}
              disabled={refreshing}
              title="Refresh"
            >
              <RefreshIcon size={14} className={refreshing ? 'spinning' : ''} />
            </button>
          )}
          {connected ? (
            <button
              className={`${cls}-disconnect-btn`}
              onClick={onDisconnect}
              title="Disconnect"
            >
              ×
            </button>
          ) : (
            <button
              className={`${cls}-add-btn-small`}
              onClick={() => onToggleForm(!showForm)}
              title={`Connect ${title}`}
            >
              ＋
            </button>
          )}
        </div>
      </div>

      {/* ── Connection form ── */}
      {showForm && !connected && (
        <div className={`${cls}-form`}>
          {formFields.map(field => (
            <div key={field.key}>
              <label className={`${cls}-form-label`}>{field.label}</label>
              <input
                className={`${cls}-form-input`}
                type={field.type || 'text'}
                value={formValues[field.key] ?? ''}
                onChange={e => onFormChange(field.key, e.target.value)}
                placeholder={field.placeholder}
              />
            </div>
          ))}
          {formHelp && <p className={`${cls}-form-help`}>{formHelp}</p>}
          {formError && <div className={`${cls}-form-error`}>{formError}</div>}
          <div className={`${cls}-form-actions`}>
            <button className={`${cls}-form-cancel`} onClick={onFormCancel}>
              Cancel
            </button>
            <button className={`${cls}-form-save`} onClick={onFormSubmit} disabled={formBusy}>
              {formBusy ? formBusyLabel : formSubmitLabel}
            </button>
          </div>
        </div>
      )}

      {/* ── Connected indicator ── */}
      {connected && connectedLabel && (
        <div className={`${cls}-account`}>
          <span className={`${cls}-account-dot`}>●</span>
          <span className={`${cls}-account-email`}>{connectedLabel}</span>
        </div>
      )}

      {/* ── Error state ── */}
      {error && (
        <div className={`${cls}-error`}>
          <span>{error}</span>
          {onRetry && (
            <button className={`${cls}-error-retry`} onClick={onRetry}>
              Retry
            </button>
          )}
        </div>
      )}

      {/* ── Loading state ── */}
      {loading && (
        <div className={`${cls}-loading`}>
          <span className="gh-tree-spinner" />
          <span>{loadingLabel}</span>
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && empty && !error && (
        <div className={`${cls}-empty-messages`}>{emptyLabel}</div>
      )}

      {/* ── Panel-specific content ── */}
      {children}
    </div>
  );
}
