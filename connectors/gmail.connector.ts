/**
 * Gmail Connector
 *
 * Integrates with Gmail via IMAP (read) and SMTP (send) using
 * Google App Passwords — no OAuth2 flow required.
 *
 * Prerequisites for the user:
 *  1. Enable 2-Step Verification on Google Account
 *  2. Generate an App Password at https://myaccount.google.com/apppasswords
 *  3. Enter their Gmail address + the 16-char app password in the connector form
 */

import type { Connector, ConnectorActionResult } from '@flovia/core/connector';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import nodemailer from 'nodemailer';

export interface GmailConnectorConfig {
  appPassword: string;
  email: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── helpers ───

/** Create a short-lived IMAP client, run a callback, then close. */
async function withImap<T>(
  config: GmailConnectorConfig,
  fn: (client: ImapFlow) => Promise<T>,
): Promise<T> {
  const client = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: { user: config.email, pass: config.appPassword },
    logger: false as any,          // silence noisy logs
  });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.logout().catch(() => {});
  }
}

/** Map an IMAP mailbox name to a user-friendly label. */
function friendlyLabel(path: string): string {
  return path.replace(/^\[Gmail]\//i, '').replace(/\//g, ' / ');
}

// ─── connector ───

export const gmailConnector: Connector<GmailConnectorConfig> = {
  metadata: {
    id: 'gmail',
    name: 'Gmail',
    description: 'Gmail email integration — view inbox, read and send emails',
    icon: 'gmail',
    category: 'communication',
    version: '2.0.0',
  },

  configFields: [
    {
      key: 'email',
      label: 'Email Address',
      type: 'email',
      placeholder: 'you@gmail.com',
      required: true,
      helpText: 'Your Gmail email address',
    },
    {
      key: 'appPassword',
      label: 'App Password',
      type: 'password',
      placeholder: 'xxxx xxxx xxxx xxxx',
      required: true,
      helpText: 'Google App Password (generate at myaccount.google.com/apppasswords)',
    },
  ],

  actions: [
    {
      id: 'list-messages', name: 'List Messages', description: 'Fetch recent emails from a mailbox',
      inputSchema: {
        mailbox: { type: 'string', label: 'Mailbox', required: false, placeholder: 'INBOX' },
        maxResults: { type: 'number', label: 'Max Results', required: false, placeholder: '20' },
      },
    },
    {
      id: 'get-message', name: 'Get Message', description: 'Get a specific email by UID',
      inputSchema: {
        messageId: { type: 'string', label: 'Message UID', required: true },
        mailbox: { type: 'string', label: 'Mailbox', required: false, placeholder: 'INBOX' },
      },
    },
    { id: 'list-labels', name: 'List Labels', description: 'List all IMAP mailboxes / labels', inputSchema: {} },
    {
      id: 'send-message', name: 'Send Message', description: 'Send a new email via SMTP',
      inputSchema: {
        to: { type: 'string', label: 'To', required: true, placeholder: 'recipient@example.com' },
        subject: { type: 'string', label: 'Subject', required: true },
        body: { type: 'string', label: 'Body', required: false },
      },
    },
  ],

  /* ── Test Connection ── */
  async testConnection(config) {
    try {
      await withImap(config, async () => {
        /* If connect() succeeds, auth is valid */
      });
      return { success: true };
    } catch (err: any) {
      const msg =
        err?.responseText || err?.message || 'IMAP connection failed';
      return { success: false, error: msg };
    }
  },

  /* ── Execute Action ── */
  async executeAction(actionId, config, params = {}): Promise<ConnectorActionResult> {
    try {
      switch (actionId) {
        // ── list-messages ──
        case 'list-messages': {
          const maxResults = Number(params.maxResults) || 20;
          const mailbox = (params.labelIds as string) || (params.mailbox as string) || 'INBOX';

          const messages = await withImap(config, async (client) => {
            const lock = await client.getMailboxLock(mailbox);
            try {
              const mb = client.mailbox;
              const total = mb && typeof mb === 'object' && 'exists' in mb ? (mb as any).exists as number : 0;
              if (total === 0) return [];

              const startSeq = Math.max(1, total - maxResults + 1);
              const range = `${startSeq}:*`;

              const results: any[] = [];
              for await (const msg of client.fetch(range, {
                envelope: true,
                flags: true,
                uid: true,
              })) {
                const env = msg.envelope ?? {} as any;
                const flags: Set<string> = msg.flags ?? new Set();
                results.push({
                  id: String(msg.uid),
                  seq: msg.seq,
                  threadId: env.messageId || '',
                  snippet: '',
                  subject: env.subject || '',
                  from: env.from?.[0]
                    ? `${env.from[0].name || ''} <${env.from[0].address || ''}>`
                    : '',
                  to: (env.to || [])
                    .map((a: any) => `${a.name || ''} <${a.address || ''}>`)
                    .join(', '),
                  date: env.date ? new Date(env.date).toUTCString() : '',
                  labelIds: [mailbox],
                  isUnread: !flags.has('\\Seen'),
                });
              }
              // newest first
              results.reverse();
              return results.slice(0, maxResults);
            } finally {
              lock.release();
            }
          });

          return { success: true, data: messages };
        }

        // ── get-message ──
        case 'get-message': {
          const uid = params.messageId as string;
          if (!uid) return { success: false, error: 'messageId (UID) is required' };
          const mailbox = (params.mailbox as string) || 'INBOX';

          const message = await withImap(config, async (client) => {
            const lock = await client.getMailboxLock(mailbox);
            try {
              const raw = await client.download(uid, undefined, { uid: true });
              if (!raw?.content) return null;

              const parsed = await simpleParser(raw.content as any);
              return {
                id: uid,
                subject: parsed.subject || '',
                from: parsed.from?.text || '',
                to: parsed.to
                  ? (Array.isArray(parsed.to) ? parsed.to.map(a => a.text).join(', ') : parsed.to.text)
                  : '',
                date: parsed.date ? parsed.date.toUTCString() : '',
                text: parsed.text || '',
                html: parsed.html || '',
                attachments: (parsed.attachments || []).map(a => ({
                  filename: a.filename,
                  contentType: a.contentType,
                  size: a.size,
                })),
              };
            } finally {
              lock.release();
            }
          });

          if (!message) return { success: false, error: 'Message not found' };
          return { success: true, data: message };
        }

        // ── list-labels ──
        case 'list-labels': {
          const labels = await withImap(config, async (client) => {
            const mailboxes = await client.list();
            return mailboxes.map((mb: any) => ({
              id: mb.path,
              name: friendlyLabel(mb.path),
              type: mb.specialUse || 'user',
              delimiter: mb.delimiter,
            }));
          });

          return { success: true, data: labels };
        }

        // ── send-message ──
        case 'send-message': {
          const to = params.to as string;
          const subject = params.subject as string;
          const body = params.body as string;
          if (!to || !subject)
            return { success: false, error: 'to and subject are required' };

          const transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 465,
            secure: true,
            auth: { user: config.email, pass: config.appPassword },
          });

          const info = await transporter.sendMail({
            from: config.email,
            to,
            subject,
            text: body || '',
          });

          return {
            success: true,
            data: { messageId: info.messageId, accepted: info.accepted },
          };
        }

        default:
          return { success: false, error: `Unknown action: ${actionId}` };
      }
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  },
};
