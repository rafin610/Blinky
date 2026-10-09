/**
 * Ollama provider — Blinky's default, local-first AI backend.
 *
 * Pure module: no store imports, all config passed as parameters so the
 * logic can be exercised directly (see scripts/test_ai.mts). Talks only
 * to the configured Ollama host (default http://localhost:11434), so
 * chat works fully offline once Ollama + model are present.
 *
 * Notes on the verified environment (2026-10-09, this laptop):
 * - Model `qwen3:8b` reports capabilities [completion, tools, thinking].
 * - Thinking is ON by default and very slow on CPU, so every request
 *   sets `think: false` and any leaked `thinking` field is stripped.
 */

import {
  AIChatMessage,
  AIConnectionStatus,
  AIModelInfo,
  AIProvider,
  AIProviderError,
  ChatRequestOptions,
  ProviderCapabilities,
} from './types';

export const DEFAULT_OLLAMA_HOST = 'http://localhost:11434';
const REQUEST_TIMEOUT_MS = 180_000;

/** Model families with verified Ollama vision support (name fragment match). */
const VISION_FAMILY_HINTS = [
  'llava',
  'moondream',
  'bakllava',
  'llama3.2-vision',
  'qwen2-vl',
  'qwen2.5vl',
  'qwen2.5-vl',
  'qwen3-vl',
  'minicpm-v',
  'granite3.2-vision',
];

export function normalizeHost(raw: string): string {
  const trimmed = (raw || '').trim().replace(/\/+$/, '');
  if (!trimmed) throw new AIProviderError('ollama', 'bad-request', 'Ollama host URL is empty.');
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new AIProviderError(
      'ollama', 'bad-request',
      'Ollama host must start with http:// or https://.'
    );
  }
  return trimmed;
}

/** Verified vision check: provider capability flag wins, family hint is fallback. */
export function modelSupportsVision(info: Pick<AIModelInfo, 'name' | 'capabilities'>): boolean {
  if (info.capabilities.map((c) => c.toLowerCase()).includes('vision')) return true;
  const name = info.name.toLowerCase();
  return VISION_FAMILY_HINTS.some((hint) => name.includes(hint));
}

function toModelInfo(raw: any): AIModelInfo {
  const name: string = raw?.name || raw?.model || 'unknown';
  const capabilities: string[] = Array.isArray(raw?.details?.capabilities)
    ? raw.details.capabilities
    : Array.isArray(raw?.capabilities)
      ? raw.capabilities
      : [];
  const info = { name, capabilities };
  return {
    name,
    size: typeof raw?.size === 'number' ? raw.size : 0,
    parameterSize: raw?.details?.parameter_size,
    capabilities,
    supportsVision: modelSupportsVision(info),
  };
}

function mapFetchError(err: unknown): AIProviderError {
  if (err instanceof AIProviderError) return err;
  const msg = err instanceof Error ? err.message : String(err);
  if (err instanceof DOMException && err.name === 'AbortError') {
    return new AIProviderError('ollama', 'aborted', 'Request cancelled.');
  }
  if (/failed to fetch|networkerror|load failed|econnrefused|enotfound/i.test(msg)) {
    return new AIProviderError(
      'ollama', 'unreachable',
      'Could not reach Ollama. Is `ollama serve` running on this machine?'
    );
  }
  return new AIProviderError('ollama', 'unknown', 'Ollama request failed. Please try again.');
}

async function fetchWithTimeout(url: string, init: RequestInit, ms = REQUEST_TIMEOUT_MS): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    // Caller AbortSignal takes precedence when provided.
    const res = await fetch(url, { ...init, signal: init.signal ?? ctrl.signal });
    return res;
  } catch (err) {
    if (!init.signal && err instanceof DOMException && err.name === 'AbortError') {
      throw new AIProviderError('ollama', 'timeout', 'Ollama took too long to respond.');
    }
    throw mapFetchError(err);
  } finally {
    clearTimeout(timer);
  }
}

function toOllamaMessages(messages: AIChatMessage[]): any[] {
  return messages.map((m) => {
    const out: any = { role: m.role, content: m.content };
    if (m.images && m.images.length > 0) {
      out.images = m.images.map((bytes) => {
        let binary = '';
        const chunk = 8192;
        for (let i = 0; i < bytes.length; i += chunk) {
          binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
        }
        return btoa(binary);
      });
    }
    return out;
  });
}

export interface OllamaConfig {
  host: string;
  model: string;
  temperature?: number;
  numCtx?: number;
}

function buildBody(config: OllamaConfig, messages: AIChatMessage[], stream: boolean): Record<string, unknown> {
  const options: Record<string, unknown> = {};
  if (typeof config.temperature === 'number') options.temperature = config.temperature;
  if (typeof config.numCtx === 'number' && config.numCtx > 0) options.num_ctx = config.numCtx;
  return {
    model: config.model,
    messages: toOllamaMessages(messages),
    stream,
    // qwen3 thinks by default; for a snappy companion, reasoning stays off.
    think: false,
    ...(Object.keys(options).length > 0 ? { options } : {}),
  };
}

function extractReply(data: any): string {
  if (typeof data?.error === 'string' && data.error) {
    if (/not found|does not exist|no such model/i.test(data.error)) {
      throw new AIProviderError(
        'ollama', 'model-missing',
        'That model is not installed in Ollama. Pick an installed model in Settings — nothing will be downloaded automatically.'
      );
    }
    throw new AIProviderError('ollama', 'bad-request', 'Ollama could not answer that request.');
  }
  const content = data?.message?.content;
  if (typeof content === 'string' && content.trim()) return content;
  return 'Hmm, Ollama stayed quiet on that one. Try asking again?';
}

async function postChat(host: string, body: Record<string, unknown>, signal?: AbortSignal): Promise<Response> {
  const res = await fetchWithTimeout(
    `${host}/api/chat`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      ...(signal ? { signal } : {}),
    }
  );
  if (!res.ok) {
    if (res.status === 404) {
      throw new AIProviderError(
        'ollama', 'model-missing',
        'That model is not installed in Ollama. Pick an installed model in Settings.'
      );
    }
    throw new AIProviderError('ollama', 'bad-request', `Ollama answered with status ${res.status}.`);
  }
  return res;
}

export async function listOllamaModels(rawHost: string): Promise<AIModelInfo[]> {
  const host = normalizeHost(rawHost);
  let res: Response;
  try {
    res = await fetchWithTimeout(`${host}/api/tags`, { method: 'GET' }, 15_000);
  } catch (err) {
    throw mapFetchError(err);
  }
  if (!res.ok) {
    throw new AIProviderError('ollama', 'unreachable', `Ollama answered with status ${res.status}.`);
  }
  const data = await res.json().catch(() => ({}));
  const models = Array.isArray(data?.models) ? data.models : [];
  return models.map(toModelInfo);
}

export async function checkOllama(host: string, model?: string): Promise<AIConnectionStatus> {
  let models: AIModelInfo[] = [];
  try {
    models = await listOllamaModels(host);
  } catch {
    return {
      reachable: false,
      models: [],
      detail: 'Ollama is not reachable. Start it with `ollama serve`.',
    };
  }
  if (model && !models.some((m) => m.name === model)) {
    return {
      reachable: true,
      models,
      detail: `Ollama is up, but "${model}" is not installed. Select an installed model — nothing will be downloaded automatically.`,
    };
  }
  return {
    reachable: true,
    models,
    detail: model
      ? `Ollama is up and "${model}" is ready.`
      : `Ollama is up with ${models.length} model${models.length === 1 ? '' : 's'} installed.`,
  };
}

export async function chatOllama(
  config: OllamaConfig,
  messages: AIChatMessage[],
  opts: ChatRequestOptions = {}
): Promise<string> {
  const host = normalizeHost(config.host);
  const res = await postChat(
    host,
    buildBody({ ...config, temperature: opts.temperature ?? config.temperature, numCtx: opts.numCtx ?? config.numCtx }, messages, false),
    opts.signal
  );
  return extractReply(await res.json().catch(() => ({})));
}

/** Streams tokens via onToken; resolves with the full reply. Supports cancel via signal. */
export async function chatOllamaStream(
  config: OllamaConfig,
  messages: AIChatMessage[],
  opts: ChatRequestOptions = {}
): Promise<string> {
  const host = normalizeHost(config.host);
  const res = await postChat(
    host,
    buildBody({ ...config, temperature: opts.temperature ?? config.temperature, numCtx: opts.numCtx ?? config.numCtx }, messages, true),
    opts.signal
  );
  if (!res.body) return extractReply(await res.json().catch(() => ({})));

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = '';
  let buffer = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        let chunk: any = null;
        try { chunk = JSON.parse(trimmed); } catch { continue; }
        if (typeof chunk?.error === 'string' && chunk.error) {
          throw extractReplyErr(chunk.error);
        }
        const token = chunk?.message?.content;
        if (typeof token === 'string' && token) {
          full += token;
          opts.onToken?.(token);
        }
        if (chunk?.done) {
          // Drain remaining buffered lines, then finish.
          continue;
        }
      }
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new AIProviderError('ollama', 'aborted', 'Request cancelled.');
    }
    throw mapFetchError(err);
  } finally {
    reader.releaseLock();
  }
  return full.trim() ? full : 'Hmm, Ollama stayed quiet on that one. Try asking again?';
}

function extractReplyErr(apiError: string): AIProviderError {
  if (/not found|does not exist|no such model/i.test(apiError)) {
    return new AIProviderError(
      'ollama', 'model-missing',
      'That model is not installed in Ollama. Pick an installed model in Settings.'
    );
  }
  return new AIProviderError('ollama', 'bad-request', 'Ollama could not answer that request.');
}

export class OllamaProvider implements AIProvider {
  readonly id = 'ollama' as const;
  readonly label = 'Ollama (local)';
  readonly capabilities: ProviderCapabilities = { streaming: true, vision: true, tools: false };
  private readonly config: OllamaConfig;

  constructor(config: OllamaConfig) {
    this.config = config;
  }

  async chat(messages: AIChatMessage[], opts?: ChatRequestOptions): Promise<string> {
    if (opts?.onToken) return chatOllamaStream(this.config, messages, opts);
    return chatOllama(this.config, messages, opts);
  }

  async supportsVision(model: string): Promise<boolean> {
    const models = await listOllamaModels(this.config.host);
    const found = models.find((m) => m.name === model);
    // Unknown model: never assume vision. Caller must treat as text-only.
    return found ? found.supportsVision : false;
  }

  listModels(): Promise<AIModelInfo[]> {
    return listOllamaModels(this.config.host);
  }

  checkConnection(model?: string): Promise<AIConnectionStatus> {
    return checkOllama(this.config.host, model ?? this.config.model);
  }
}
