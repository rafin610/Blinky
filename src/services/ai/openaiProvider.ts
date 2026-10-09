/**
 * OpenAI provider — strictly optional, opt-in cloud backend.
 * Credential access and cloud requests run in Rust; frontend code never
 * retrieves or retains the API key.
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

/** Vision-capable OpenAI chat models (fragment match, conservative). */
const VISION_MODELS = ['gpt-4o', 'gpt-4-turbo', 'gpt-4-vision', 'o1', 'o3', 'o4'];

export interface OpenAIConfig {
  model: string;
}

function toOpenAIMessages(messages: AIChatMessage[]): unknown[] {
  return messages.map((message) => {
    if (!message.images?.length) return { role: message.role, content: message.content };
    const parts: Array<{ type: string; text?: string; image_url?: { url: string; detail: string } }> = [
      { type: 'text', text: message.content },
    ];
    for (const bytes of message.images) {
      let binary = '';
      for (let i = 0; i < bytes.length; i += 8192) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      }
      parts.push({
        type: 'image_url',
        image_url: { url: `data:image/png;base64,${btoa(binary)}`, detail: 'low' },
      });
    }
    return { role: message.role, content: parts };
  });
}

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export async function chatOpenAI(
  config: OpenAIConfig,
  messages: AIChatMessage[],
  opts: ChatRequestOptions = {}
): Promise<string> {
  if (!isTauri()) {
    throw new AIProviderError('openai', 'unauthorized', 'Cloud AI requires the desktop app and OS credential storage.');
  }
  if (opts.signal?.aborted) {
    throw new AIProviderError('openai', 'aborted', 'Request cancelled.');
  }
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const cancel = () => { void invoke('openai_cancel', { requestId }).catch(() => {}); };
    opts.signal?.addEventListener('abort', cancel, { once: true });
    if (opts.signal?.aborted) cancel();
    try {
      const request = invoke<string>('openai_chat', {
        requestId,
        model: config.model,
        messages: toOpenAIMessages(messages),
        maxTokens: opts.maxTokens ?? 400,
        temperature: opts.temperature,
      });
      const signal = opts.signal;
      if (!signal) return await request;
      let abortRequest: (() => void) | undefined;
      const cancelled = new Promise<never>((_, reject) => {
        abortRequest = () => reject(new DOMException('Request cancelled.', 'AbortError'));
        signal.addEventListener('abort', abortRequest, { once: true });
        if (signal.aborted) abortRequest();
      });
      try {
        return await Promise.race([request, cancelled]);
      } finally {
        if (abortRequest) signal.removeEventListener('abort', abortRequest);
      }
    } finally {
      opts.signal?.removeEventListener('abort', cancel);
    }
  } catch (error) {
    if (opts.signal?.aborted) throw new AIProviderError('openai', 'aborted', 'Request cancelled.');
    if (typeof error === 'string') {
      throw new AIProviderError('openai', 'bad-request', error);
    }
    throw new AIProviderError('openai', 'unknown', 'Cloud request failed. Check your connection.');
  }
}

export class OpenAIProvider implements AIProvider {
  readonly id = 'openai' as const;
  readonly label = 'OpenAI (cloud)';
  readonly capabilities: ProviderCapabilities = { streaming: false, vision: true, tools: false };
  private readonly config: OpenAIConfig;

  constructor(config: OpenAIConfig) {
    this.config = config;
  }

  chat(messages: AIChatMessage[], opts?: ChatRequestOptions): Promise<string> {
    return chatOpenAI(this.config, messages, opts);
  }

  async supportsVision(model: string): Promise<boolean> {
    const name = model.toLowerCase();
    return VISION_MODELS.some((hint) => name.includes(hint));
  }

  async listModels(): Promise<AIModelInfo[]> {
    return [];
  }

  async checkConnection(model?: string): Promise<AIConnectionStatus> {
    if (!isTauri()) {
      return { reachable: false, models: [], detail: 'Cloud AI requires the desktop app and OS credential storage.' };
    }
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const status = await invoke<AIConnectionStatus>('openai_check_connection');
      return {
        ...status,
        detail: status.reachable && model ? `Cloud key looks valid (model "${model}").` : status.detail,
      };
    } catch {
      return { reachable: false, models: [], detail: 'Could not check the cloud connection.' };
    }
  }
}
