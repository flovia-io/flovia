import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

export interface AISettings {
  provider: 'ollama' | 'openai' | 'anthropic';
  baseUrl: string;
  apiKey: string;
  selectedModel: string;
}

export async function checkOllama(): Promise<boolean> {
  try {
    const res = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Normalize an Ollama-style base URL for OpenAI-compatible endpoints.
 * e.g. "https://ollama.com/api/v1" → "https://ollama.com/v1"
 */
function normalizeBaseUrl(baseUrl: string): string {
  try {
    const url = new URL(baseUrl);
    if (url.pathname === '/api/v1' || url.pathname === '/api/v1/') {
      url.pathname = '/v1';
      return url.toString().replace(/\/$/, '');
    }
    return baseUrl;
  } catch {
    return baseUrl;
  }
}

/**
 * List models using the native Ollama /api/tags endpoint (with Bearer auth).
 * Works for both local and Ollama Cloud instances.
 */
async function listOllamaModels(baseUrl: string, apiKey: string): Promise<string[]> {
  let ollamaBase: string;
  try {
    const url = new URL(baseUrl);
    ollamaBase = `${url.protocol}//${url.host}`;
  } catch {
    return [];
  }

  const headers: Record<string, string> = {};
  if (apiKey && apiKey !== 'ollama') {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const res = await fetch(`${ollamaBase}/api/tags`, {
    headers,
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data = await res.json() as { models?: { name?: string; model?: string }[] };
  return (data.models || []).map((m) => m.name || m.model || '').filter(Boolean).sort();
}

export async function listModels(baseUrl: string, apiKey: string): Promise<string[]> {
  // ── Anthropic ──
  if (baseUrl.includes('anthropic.com') || baseUrl === 'anthropic') {
    return listAnthropicModels(apiKey);
  }
  // ── OpenAI-compatible (Ollama, OpenAI, etc.) ──
  try {
    const normalized = normalizeBaseUrl(baseUrl);
    const client = new OpenAI({ baseURL: normalized, apiKey });
    const list = await client.models.list();
    const models: string[] = [];
    for await (const m of list) {
      models.push(m.id);
    }
    if (models.length > 0) return models.sort();
  } catch { /* fall through to Ollama native fallback */ }

  // ── Fallback: native Ollama /api/tags (handles Ollama Cloud & local) ──
  try {
    return await listOllamaModels(baseUrl, apiKey);
  } catch { /* ignore */ }

  return [];
}

/** List available Anthropic models via the /v1/models endpoint */
async function listAnthropicModels(apiKey: string): Promise<string[]> {
  try {
    const client = new Anthropic({ apiKey });
    const resp = await client.models.list({ limit: 100 });
    return resp.data.map(m => m.id).sort();
  } catch {
    // Fallback: return known models if API listing fails
    return [
      'claude-sonnet-4-20250514',
      'claude-haiku-4-20250514',
      'claude-opus-4-20250514',
    ];
  }
}

export async function chatComplete(
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: { role: 'user' | 'assistant' | 'system'; content: string }[],
  signal?: AbortSignal,
): Promise<string> {
  // ── Anthropic ──
  if (baseUrl.includes('anthropic.com') || baseUrl === 'anthropic') {
    return anthropicChatComplete(apiKey, model, messages, signal);
  }
  // ── OpenAI-compatible ──
  const normalized = normalizeBaseUrl(baseUrl);
  const client = new OpenAI({ baseURL: normalized, apiKey });
  const response = await client.chat.completions.create(
    { model, messages },
    { signal },
  );
  return response.choices[0]?.message?.content ?? '';
}

/** Non-streaming Anthropic chat completion */
async function anthropicChatComplete(
  apiKey: string,
  model: string,
  messages: { role: 'user' | 'assistant' | 'system'; content: string }[],
  signal?: AbortSignal,
): Promise<string> {
  const client = new Anthropic({ apiKey });

  // Anthropic: extract system message, map the rest to user/assistant
  const systemMsg = messages.find(m => m.role === 'system')?.content;
  const chatMessages = messages
    .filter(m => m.role !== 'system')
    .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

  const response = await client.messages.create(
    {
      model,
      max_tokens: 8192,
      ...(systemMsg ? { system: systemMsg } : {}),
      messages: chatMessages,
    },
    { signal },
  );

  return response.content
    .filter(block => block.type === 'text')
    .map(block => (block as { type: 'text'; text: string }).text)
    .join('');
}

/**
 * Streaming chat completion — yields chunks as they arrive.
 * onChunk is called with each text delta.
 * Returns the full assembled response.
 */
export async function chatCompleteStream(
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: { role: 'user' | 'assistant' | 'system'; content: string }[],
  onChunk: (chunk: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  // ── Anthropic ──
  if (baseUrl.includes('anthropic.com') || baseUrl === 'anthropic') {
    return anthropicChatCompleteStream(apiKey, model, messages, onChunk, signal);
  }
  // ── OpenAI-compatible ──
  const normalized = normalizeBaseUrl(baseUrl);
  const client = new OpenAI({ baseURL: normalized, apiKey });
  const stream = await client.chat.completions.create(
    { model, messages, stream: true },
    { signal },
  );

  let full = '';
  for await (const part of stream) {
    const delta = part.choices[0]?.delta?.content;
    if (delta) {
      full += delta;
      onChunk(delta);
    }
  }
  return full;
}

/** Streaming Anthropic chat completion */
async function anthropicChatCompleteStream(
  apiKey: string,
  model: string,
  messages: { role: 'user' | 'assistant' | 'system'; content: string }[],
  onChunk: (chunk: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const client = new Anthropic({ apiKey });

  const systemMsg = messages.find(m => m.role === 'system')?.content;
  const chatMessages = messages
    .filter(m => m.role !== 'system')
    .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

  const stream = client.messages.stream(
    {
      model,
      max_tokens: 8192,
      ...(systemMsg ? { system: systemMsg } : {}),
      messages: chatMessages,
    },
    { signal },
  );

  let full = '';
  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      const text = event.delta.text;
      full += text;
      onChunk(text);
    }
  }
  return full;
}
