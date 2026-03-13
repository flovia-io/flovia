/**
 * GmailPanel - Gmail integration using IMAP with Google App Passwords
 *
 * Refactored to use ConnectorPanelShell, ExpandableListItem, and shared utilities.
 */
import { useState, useEffect, useCallback } from 'react';
import { useBackend } from '../context/BackendContext';
import { ChevronDownIcon, ChevronRightIcon } from './icons';
import { ConnectorPanelShell } from './shared';
import type { ConnectorField } from './shared/ConnectorPanelShell';
import ExpandableListItem from './shared/ExpandableListItem';
import DetailRow from './shared/DetailRow';
import { formatRelativeDate, extractEmailName } from '../utils/formatters';

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

const FORM_FIELDS: ConnectorField[] = [
  { key: 'email', label: 'Email Address', type: 'email', placeholder: 'you@gmail.com' },
  { key: 'appPassword', label: 'App Password', type: 'password', placeholder: 'xxxx xxxx xxxx xxxx' },
];

export default function GmailPanel() {
  const backend = useBackend();
  const [connected, setConnected] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formValues, setFormValues] = useState<Record<string, string>>({ email: '', appPassword: '' });
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

  // Load saved config on mount
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
    if (connected && appPassword) loadMessages();
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
    const emailVal = formValues.email?.trim();
    const token = formValues.appPassword?.trim();

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

    await backend.connectorSaveConfig('gmail', { email: emailVal, appPassword: token });
    setEmail(emailVal);
    setAppPassword(token);
    setConnected(true);
    setShowForm(false);
    setFormValues({ email: '', appPassword: '' });
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

  const toggleLabels = () => {
    if (!showLabels && !labelsFetched) loadLabels();
    setShowLabels(!showLabels);
  };

  const selectLabel = (labelId: string) => {
    setSelectedLabel(labelId);
    setShowLabels(false);
    setExpandedMsg(null);
  };

  const toggleMessage = (id: string) => {
    setExpandedMsg(prev => (prev === id ? null : id));
  };

  return (
    <ConnectorPanelShell
      title="Gmail"
      icon={<GmailIcon size={20} />}
      connected={connected}
      connectedLabel={email}
      showForm={showForm}
      onToggleForm={setShowForm}
      formFields={FORM_FIELDS}
      formValues={formValues}
      onFormChange={(key, val) => setFormValues(prev => ({ ...prev, [key]: val }))}
      formError={formError}
      formBusy={formTesting}
      onFormSubmit={handleConnect}
      onFormCancel={() => { setShowForm(false); setFormError(''); }}
      formHelp={
        <>
          Generate an App Password at{' '}
          <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer">
            myaccount.google.com/apppasswords
          </a>{' '}
          (requires 2-Step Verification).
        </>
      }
      onRefresh={() => { setExpandedMsg(null); loadMessages(); }}
      refreshing={loadingMessages}
      onDisconnect={handleDisconnect}
      error={error}
      onRetry={loadMessages}
      loading={loadingMessages && messages.length === 0}
      loadingLabel="Loading messages…"
      empty={!loadingMessages && messages.length === 0 && connected && !error}
      emptyLabel="No messages found."
    >
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
                  <span className="gh-tree-spinner" />
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

      {/* Messages list */}
      <div className="gm-messages">
        {messages.map(msg => (
          <ExpandableListItem
            key={msg.id}
            id={msg.id}
            expanded={expandedMsg === msg.id}
            onToggle={toggleMessage}
            highlighted={msg.isUnread}
            primary={extractEmailName(msg.from)}
            secondary={msg.subject || '(no subject)'}
            date={formatRelativeDate(msg.date)}
          >
            <DetailRow label="From" value={msg.from} />
            <DetailRow label="To" value={msg.to} />
            <DetailRow label="Date" value={msg.date} />
            <DetailRow label="Subject" value={msg.subject} />
            <div className="gm-message-snippet">{msg.snippet}</div>
            {msg.labelIds.length > 0 && (
              <div className="gm-message-labels">
                {msg.labelIds.map(l => (
                  <span key={l} className="gm-msg-label">{l}</span>
                ))}
              </div>
            )}
          </ExpandableListItem>
        ))}
      </div>
    </ConnectorPanelShell>
  );
}
