/**
 * GmailPanel - Gmail integration using IMAP with Google App Passwords
 */
import { useState, useEffect, useCallback } from 'react';
import { useBackend } from '../context/BackendContext';
import { ChevronDownIcon, ChevronRightIcon, RefreshIcon } from './icons';

// Gmail logo icon
const GmailIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z" />
  </svg>
);

interface GmailMessage {
  id: string;
  threadId: string;
  snippet: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  labelIds: string[];
  isUnread: boolean;
}

interface GmailLabel {
  id: string;
  name: string;
  type: string;
  messagesTotal?: number;
  messagesUnread?: number;
}

export default function GmailPanel() {
  const backend = useBackend();
  const [connected, setConnected] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formEmail, setFormEmail] = useState('');
  const [formToken, setFormToken] = useState('');
  const [formError, setFormError] = useState('');
  const [formTesting, setFormTesting] = useState(false);
  const [email, setEmail] = useState('');
  const [appPassword, setAppPassword] = useState('');
  const [messages, setMessages] = useState<GmailMessage[]>([]);
  const [labels, setLabels] = useState<GmailLabel[]>([]);
  const [selectedLabel, setSelectedLabel] = useState('INBOX');
  const [expandedMsg, setExpandedMsg] = useState<string | null>(null);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingLabels, setLoadingLabels] = useState(false);
  const [labelsFetched, setLabelsFetched] = useState(false);
  const [showLabels, setShowLabels] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Try to load saved config on mount
  useEffect(() => {
    (async () => {
      try {
        const config = await backend.connectorLoadConfig('gmail');
        if (config && (config as Record<string, string>).appPassword) {
          const c = config as { email: string; appPassword: string };
          setEmail(c.email);
          setAppPassword(c.appPassword);
          setConnected(true);
        }
      } catch {
        // no saved config
      }
    })();
  }, []);

  // Load messages when connected or label changes
  const loadMessages = useCallback(async () => {
    setLoadingMessages(true);
    setError(null);
    try {
      const result = await backend.connectorExecute('gmail', 'list-messages', {
        maxResults: 20,
        labelIds: selectedLabel,
      });
      if (result.success && result.data) {
        setMessages(result.data as GmailMessage[]);
      } else {
        setError(result.error || 'Failed to load messages');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load messages');
    } finally {
      setLoadingMessages(false);
    }
  }, [backend, selectedLabel]);

  useEffect(() => {
    if (connected && appPassword) {
      loadMessages();
    }
  }, [connected, appPassword, selectedLabel, loadMessages]);

  const loadLabels = async () => {
    setLoadingLabels(true);
    try {
      const result = await backend.connectorExecute('gmail', 'list-labels');
      if (result.success && result.data) {
        setLabels(result.data as GmailLabel[]);
        setLabelsFetched(true);
      }
    } catch (err) {
      console.error('Failed to load labels:', err);
    } finally {
      setLoadingLabels(false);
    }
  };

  const handleConnect = async () => {
    const emailVal = formEmail.trim();
    const token = formToken.trim();

    if (!emailVal || !token) {
      setFormError('All fields are required');
      return;
    }

    setFormTesting(true);
    setFormError('');

    try {
      const result = await backend.connectorTest('gmail', { email: emailVal, appPassword: token });
      if (!result.success) {
        setFormError(result.error || 'Connection failed. Check your credentials.');
        setFormTesting(false);
        return;
      }
    } catch {
      setFormError('Connection failed. Check your credentials.');
      setFormTesting(false);
      return;
    }

    // Save config
    await backend.connectorSaveConfig('gmail', { email: emailVal, appPassword: token });
    setEmail(emailVal);
    setAppPassword(token);
    setConnected(true);
    setShowForm(false);
    setFormEmail('');
    setFormToken('');
    setFormError('');
    setFormTesting(false);
  };

  const handleDisconnect = async () => {
    setConnected(false);
    setEmail('');
    setAppPassword('');
    setMessages([]);
    setLabels([]);
    setLabelsFetched(false);
    setExpandedMsg(null);
    await backend.connectorSaveConfig('gmail', {});
  };

  const toggleMessage = (msgId: string) => {
    setExpandedMsg(expandedMsg === msgId ? null : msgId);
  };

  const toggleLabels = () => {
    if (!showLabels && !labelsFetched) {
      loadLabels();
    }
    setShowLabels(!showLabels);
  };

  const selectLabel = (labelId: string) => {
    setSelectedLabel(labelId);
    setShowLabels(false);
    setExpandedMsg(null);
  };

  const refreshAll = () => {
    setExpandedMsg(null);
    loadMessages();
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      const now = new Date();
      if (d.toDateString() === now.toDateString()) {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const formatFrom = (from: string) => {
    // Extract name or email from "Name <email>" format
    const match = from.match(/^([^<]+)</);
    if (match) return match[1].trim();
    return from;
  };

  // ── Not connected state ──
  if (!connected && !showForm) {
    return (
      <div className="gm-panel">
        <div className="gm-panel-header">
          <GmailIcon size={20} />
          <h2>Gmail</h2>
        </div>
        <div className="gm-panel-empty">
          <p>No Gmail account connected.</p>
          <p className="gm-hint">Connect your Gmail account to view and manage emails.</p>
          <button className="gm-add-btn" onClick={() => setShowForm(true)}>
            <span>＋</span> Connect Gmail
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="gm-panel">
      <div className="gm-panel-header">
        <GmailIcon size={20} />
        <h2>Gmail</h2>
        <div className="gm-panel-header-actions">
          {connected && (
            <button
              className="gm-refresh-btn"
              onClick={refreshAll}
              disabled={loadingMessages}
              title="Refresh"
            >
              <RefreshIcon size={14} className={loadingMessages ? 'spinning' : ''} />
            </button>
          )}
          {connected ? (
            <button
              className="gm-disconnect-btn"
              onClick={handleDisconnect}
              title="Disconnect"
            >
              ×
            </button>
          ) : (
            <button
              className="gm-add-btn-small"
              onClick={() => setShowForm(v => !v)}
              title="Connect account"
            >
              ＋
            </button>
          )}
        </div>
      </div>

      {/* Connection form */}
      {showForm && !connected && (
        <div className="gm-form">
          <label className="gm-form-label">Email Address</label>
          <input
            className="gm-form-input"
            value={formEmail}
            onChange={e => setFormEmail(e.target.value)}
            placeholder="you@gmail.com"
          />
          <label className="gm-form-label">App Password</label>
          <input
            className="gm-form-input"
            type="password"
            value={formToken}
            onChange={e => setFormToken(e.target.value)}
            placeholder="xxxx xxxx xxxx xxxx"
          />
          <p className="gm-form-help">
            Generate an App Password at{' '}
            <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer">
              myaccount.google.com/apppasswords
            </a>{' '}
            (requires 2-Step Verification).
          </p>
          {formError && <div className="gm-form-error">{formError}</div>}
          <div className="gm-form-actions">
            <button className="gm-form-cancel" onClick={() => { setShowForm(false); setFormError(''); }}>Cancel</button>
            <button className="gm-form-save" onClick={handleConnect} disabled={formTesting}>
              {formTesting ? 'Testing…' : 'Connect'}
            </button>
          </div>
        </div>
      )}

      {/* Connected account info */}
      {connected && (
        <div className="gm-account">
          <span className="gm-account-dot">●</span>
          <span className="gm-account-email">{email}</span>
        </div>
      )}

      {/* Label selector */}
      {connected && (
        <div className="gm-label-selector">
          <div className="gm-label-toggle" onClick={toggleLabels}>
            <span className="gm-chevron">
              {showLabels ? <ChevronDownIcon size={12} /> : <ChevronRightIcon size={12} />}
            </span>
            <span className="gm-label-current">📁 {selectedLabel}</span>
          </div>
          {showLabels && (
            <div className="gm-labels-list">
              {loadingLabels && labels.length === 0 && (
                <div className="gm-loading-labels">
                  <span className="gh-tree-spinner"></span>
                  <span>Loading labels…</span>
                </div>
              )}
              {labels.map(label => (
                <div
                  key={label.id}
                  className={`gm-label-item${selectedLabel === label.id ? ' active' : ''}`}
                  onClick={() => selectLabel(label.id)}
                >
                  <span className="gm-label-name">{label.name}</span>
                  {label.messagesUnread != null && label.messagesUnread > 0 && (
                    <span className="gm-label-unread">{label.messagesUnread}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="gm-error">
          <span>{error}</span>
          <button className="gm-error-retry" onClick={loadMessages}>Retry</button>
        </div>
      )}

      {/* Loading state */}
      {loadingMessages && messages.length === 0 && (
        <div className="gm-loading">
          <span className="gh-tree-spinner"></span>
          <span>Loading messages…</span>
        </div>
      )}

      {/* Empty state */}
      {!loadingMessages && messages.length === 0 && connected && !error && (
        <div className="gm-empty-messages">No messages found.</div>
      )}

      {/* Messages list */}
      <div className="gm-messages">
        {messages.map(msg => {
          const isExpanded = expandedMsg === msg.id;

          return (
            <div key={msg.id} className="gm-message-group">
              <div
                className={`gm-message-item${msg.isUnread ? ' unread' : ''}`}
                onClick={() => toggleMessage(msg.id)}
              >
                <span className="gm-chevron">
                  {isExpanded ? <ChevronDownIcon size={12} /> : <ChevronRightIcon size={12} />}
                </span>
                <span className="gm-message-indicator">
                  {msg.isUnread ? '●' : '○'}
                </span>
                <span className="gm-message-from">{formatFrom(msg.from)}</span>
                <span className="gm-message-subject">{msg.subject || '(no subject)'}</span>
                <span className="gm-message-date">{formatDate(msg.date)}</span>
              </div>

              {isExpanded && (
                <div className="gm-message-detail">
                  <div className="gm-detail-row">
                    <span className="gm-detail-label">From:</span>
                    <span className="gm-detail-value">{msg.from}</span>
                  </div>
                  <div className="gm-detail-row">
                    <span className="gm-detail-label">To:</span>
                    <span className="gm-detail-value">{msg.to}</span>
                  </div>
                  <div className="gm-detail-row">
                    <span className="gm-detail-label">Date:</span>
                    <span className="gm-detail-value">{msg.date}</span>
                  </div>
                  <div className="gm-detail-row">
                    <span className="gm-detail-label">Subject:</span>
                    <span className="gm-detail-value">{msg.subject}</span>
                  </div>
                  <div className="gm-message-snippet">{msg.snippet}</div>
                  {msg.labelIds.length > 0 && (
                    <div className="gm-message-labels">
                      {msg.labelIds.map(l => (
                        <span key={l} className="gm-msg-label">{l}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
