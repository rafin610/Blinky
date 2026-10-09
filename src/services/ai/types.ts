/**
 * Blinky AI provider interfaces.
 *
 * UI talks to the AI Manager (`aiManager.ts`), never directly to a
 * provider. Providers are swappable: Ollama (default, local-first)
 * and OpenAI (optional, opt-in cloud).
 */

export type AIProviderId = 'ollama' | 'openai';

export interface AIChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  /** Raw PNG/JPEG bytes for vision-capable models. Never logged. */
  images?: Uint8Array[];
}

export interface ChatRequestOptions {
  /** 0.0 - 2.0. Defaults per provider. */
  temperature?: number;
  /** Context window override (Ollama `num_ctx`). */
  numCtx?: number;
  /** Max output tokens (OpenAI `max_tokens`). */
  maxTokens?: number;
  /** Abort a long-running request. */
  signal?: AbortSignal;
  /** Called with each streamed token chunk. */
  onToken?: (token: string) => void;
}

export interface AIModelInfo {
  /** Exact installed name, e.g. "qwen3:8b". */
  name: string;
  /** Raw size in bytes (0 when unknown). */
  size: number;
  /** e.g. "8.2B". */
  parameterSize?: string;
  /** Raw capability strings reported by the provider. */
  capabilities: string[];
  /** True when the model can accept images. Verified, never assumed. */
  supportsVision: boolean;
}

export interface ProviderCapabilities {
  streaming: boolean;
  vision: boolean;
  tools: boolean;
}

export interface AIConnectionStatus {
  reachable: boolean;
  /** Installed model names, empty when unreachable. */
  models: AIModelInfo[];
  /** Human-readable detail for Settings UI. Never includes secrets. */
  detail: string;
}

export interface AIProvider {
  readonly id: AIProviderId;
  readonly label: string;
  readonly capabilities: ProviderCapabilities;
  /** Full chat round-trip. Resolves with the assistant's text reply. */
  chat(messages: AIChatMessage[], opts?: ChatRequestOptions): Promise<string>;
  /** True when this model can accept images. Must be verified. */
  supportsVision(model: string): Promise<boolean>;
  /** Installed models. Throws a friendly error when unreachable. */
  listModels(): Promise<AIModelInfo[]>;
  /** Lightweight reachability + model check. Never throws. */
  checkConnection(model?: string): Promise<AIConnectionStatus>;
}

/** Base error for provider failures. Message is always safe to display. */
export class AIProviderError extends Error {
  readonly provider: AIProviderId;
  readonly kind:
    | 'unreachable'
    | 'model-missing'
    | 'unauthorized'
    | 'timeout'
    | 'aborted'
    | 'bad-request'
    | 'unknown';
  constructor(provider: AIProviderId, kind: AIProviderError['kind'], message: string) {
    super(message);
    this.name = 'AIProviderError';
    this.provider = provider;
    this.kind = kind;
  }
}

export function isAbortError(err: unknown): boolean {
  return (
    err instanceof AIProviderError && err.kind === 'aborted' ||
    (err instanceof DOMException && err.name === 'AbortError') ||
    (err instanceof Error && err.name === 'AbortError')
  );
}
