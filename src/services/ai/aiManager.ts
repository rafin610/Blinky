/**
 * Blinky AI Manager — the ONLY layer the UI talks to for AI.
 *
 * Blinky UI → AI Manager → Provider (Ollama default / OpenAI opt-in)
 *
 * Responsibilities:
 * - Route to the configured provider. Never auto-fallback Ollama→OpenAI.
 * - Enforce privacy gates (screen, cloud, notifications) before any call.
 * - Attach minimum permitted context via the Context Manager.
 * - Verify vision support before any image leaves the device.
 * - Offer streaming + cancellation.
 */

import { useBlinkyStore } from '../../store/blinkyStore';
import {
  AIChatMessage,
  AIConnectionStatus,
  AIModelInfo,
  AIProvider,
  AIProviderError,
  AIProviderId,
  isAbortError,
} from './types';
import { OllamaProvider, DEFAULT_OLLAMA_HOST } from './ollamaProvider';
import { OpenAIProvider } from './openaiProvider';
import { buildContext, ExplicitAttachments } from './contextManager';

const BLINKY_SYSTEM_PROMPT = `You are Blinky, a small, cute, intelligent 3D desktop companion living on the user's Linux desktop (Pop!_OS/Ubuntu).
Personality:
- Friendly, warm, concise, and helpful.
- Talk like a cute little tech-savvy desktop companion.
- Keep answers relatively concise (2-4 sentences or quick code snippets) so they fit nicely in a desktop companion window.
- If asked about Linux, provide practical terminal tips or shortcuts.
- For code or errors: explain plainly, show the fix first, then one short reason.`;

export interface AskOptions extends ExplicitAttachments {
  /** Stream tokens into the UI. Defaults to the Streaming setting. */
  stream?: boolean;
  onToken?: (token: string) => void;
  signal?: AbortSignal;
  temperature?: number;
  /** Skip attaching permitted ambient context (system snapshot etc). */
  ambientContext?: boolean;
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.replace(/^data:image\/[a-zA-Z+]+;base64,/, '');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function resolveProvider(): { provider: AIProvider; id: AIProviderId; cloud: boolean } {
  const { settings } = useBlinkyStore.getState();
  if (settings.aiProvider === 'openai') {
    if (!settings.openaiEnabled) {
      throw new AIProviderError(
        'openai', 'unauthorized',
        'The cloud brain is disabled. Enable it in Settings → AI to use OpenAI.'
      );
    }
    if (!settings.privacy.allowCloudAI) {
      throw new AIProviderError(
        'openai', 'unauthorized',
        'Cloud AI processing is disabled. Opt in to cloud AI in Settings, or switch back to Local Ollama.'
      );
    }
    return {
      provider: new OpenAIProvider({ model: settings.openaiModel || 'gpt-4o-mini' }),
      id: 'openai',
      cloud: true,
    };
  }
  const s = useBlinkyStore.getState().settings;
  return {
    provider: new OllamaProvider({
      host: s.ollamaEndpoint || DEFAULT_OLLAMA_HOST,
      model: s.ollamaModel,
      temperature: s.ollamaTemperature,
      numCtx: s.ollamaNumCtx,
    }),
    id: 'ollama',
    cloud: false,
  };
}

/**
 * Core ask. Attaches permitted context, enforces gates, routes provider.
 * screenBase64 (AskBlinkyTab legacy arg) maps to an explicit screenshot.
 */
export async function askBlinky(
  prompt: string,
  screenBase64?: string,
  onStreamChunk?: (chunk: string) => void,
  opts: AskOptions = {}
): Promise<string> {
  const { settings, setThinking, playAnimation } = useBlinkyStore.getState();
  const text = (prompt || '').trim();
  if (!text) throw new AIProviderError(settings.aiProvider, 'bad-request', 'Type something first?');

  const { provider, id, cloud } = resolveProvider();
  setThinking(true);
  try {
    let screenshotBytes: Uint8Array | undefined;
    if (screenBase64 || opts.screenshotBytes) {
      if (!settings.privacy.allowScreenCapture) {
        throw new AIProviderError(
          id, 'unauthorized',
          'Screen capture is disabled by your privacy settings. Enable it in Settings.'
        );
      }
      screenshotBytes = opts.screenshotBytes ?? dataUrlToBytes(screenBase64!);
      // Vision MUST be verified before any image is sent anywhere.
      const model = id === 'ollama' ? settings.ollamaModel : settings.openaiModel;
      const visionOk = await provider.supportsVision(model);
      if (!visionOk) {
        if (id === 'ollama') {
          throw new AIProviderError(
            'ollama', 'bad-request',
            `"${model}" is text-only — it cannot see screenshots, so nothing was sent. ` +
            `Describe the screen in words, or install a vision model (e.g. qwen3-vl / llava). ` +
            `Local OCR is not installed (sudo apt install tesseract-ocr).`
          );
        }
        throw new AIProviderError('openai', 'bad-request', `"${model}" does not support images.`);
      }
      if (cloud && !settings.privacy.allowCloudAI) {
        throw new AIProviderError(
          'openai', 'unauthorized',
          'Sending screenshots to the cloud needs your explicit opt-in first.'
        );
      }
    }

    const ctx = opts.ambientContext === false
      ? { systemExtra: '', preview: [] }
      : buildContext({
          clipboardText: opts.clipboardText,
          errorText: opts.errorText,
          codeText: opts.codeText,
        });

    const messages: AIChatMessage[] = [
      {
        role: 'system',
        content: ctx.systemExtra ? `${BLINKY_SYSTEM_PROMPT}\n${ctx.systemExtra}` : BLINKY_SYSTEM_PROMPT,
      },
      { role: 'user', content: text, ...(screenshotBytes ? { images: [screenshotBytes] } : {}) },
    ];

    const stream = opts.stream ?? settings.aiStreaming ?? true;
    const reply = await provider.chat(messages, {
      temperature: opts.temperature ?? settings.ollamaTemperature,
      numCtx: settings.ollamaNumCtx,
      signal: opts.signal,
      onToken: stream ? (onStreamChunk ?? opts.onToken) : undefined,
    });

    playAnimation('happy');
    return reply;
  } catch (err) {
    if (isAbortError(err)) throw new AIProviderError(id, 'aborted', 'Stopped. Ask me again anytime?');
    // Never log prompts, images, or keys.
    if (err instanceof AIProviderError) {
      useBlinkyStore.getState().playAnimation('error_sad');
      throw err;
    }
    useBlinkyStore.getState().playAnimation('error_sad');
    throw new AIProviderError(id, 'unknown', 'Hmm, I got sleepy. Try again?');
  } finally {
    setThinking(false);
  }
}

/** Streaming helper with built-in cancellation. */
export function askBlinkyStream(
  prompt: string,
  onToken: (token: string) => void,
  opts: AskOptions = {}
): { promise: Promise<string>; cancel: () => void } {
  const ctrl = new AbortController();
  const promise = askBlinky(prompt, undefined, onToken, {
    ...opts,
    stream: true,
    signal: ctrl.signal,
  });
  return { promise, cancel: () => ctrl.abort() };
}

export async function listInstalledModels(): Promise<AIModelInfo[]> {
  const { settings } = useBlinkyStore.getState();
  const provider = new OllamaProvider({
    host: settings.ollamaEndpoint || DEFAULT_OLLAMA_HOST,
    model: settings.ollamaModel,
  });
  return provider.listModels();
}

export async function checkAIStatus(): Promise<AIConnectionStatus & { provider: AIProviderId; model: string }> {
  const { settings } = useBlinkyStore.getState();
  if (settings.aiProvider === 'openai') {
    if (!settings.openaiEnabled || !settings.privacy.allowCloudAI) {
      return {
        reachable: false,
        models: [],
        detail: 'Cloud AI is disabled. Enable both cloud settings before testing the connection.',
        provider: 'openai',
        model: settings.openaiModel,
      };
    }
    const status = await new OpenAIProvider({ model: settings.openaiModel }).checkConnection(settings.openaiModel);
    return { ...status, provider: 'openai', model: settings.openaiModel };
  }
  const status = await new OllamaProvider({
    host: settings.ollamaEndpoint || DEFAULT_OLLAMA_HOST,
    model: settings.ollamaModel,
  }).checkConnection(settings.ollamaModel);
  return { ...status, provider: 'ollama', model: settings.ollamaModel };
}

export interface VisionSupport {
  supported: boolean;
  model: string;
  provider: AIProviderId;
  /** Plain-words reason for the UI when unsupported. */
  reason: string;
  ocrAvailable: boolean;
  ocrHint: string;
}

/** Verified vision support for the currently selected provider + model. */
export async function describeVisionSupport(): Promise<VisionSupport> {
  const { settings } = useBlinkyStore.getState();
  const provider = settings.aiProvider;
  const model = provider === 'ollama' ? settings.ollamaModel : settings.openaiModel;

  let ocrAvailable = false;
  const ocrHint = 'sudo apt install tesseract-ocr';
  try {
    if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
      const { invoke } = await import('@tauri-apps/api/core');
      const res = await invoke<{ available: boolean }>('check_ocr');
      ocrAvailable = !!res?.available;
    }
  } catch { /* OCR stays unavailable */ }

  if (provider === 'openai') {
    if (!settings.openaiEnabled || !settings.privacy.allowCloudAI) {
      return {
        supported: false, model, provider,
        reason: 'Cloud vision needs your explicit opt-in first. Nothing was sent anywhere.',
        ocrAvailable, ocrHint,
      };
    }
    return { supported: true, model, provider, reason: '', ocrAvailable, ocrHint };
  }

  try {
    const ok = await new OllamaProvider({
      host: settings.ollamaEndpoint || DEFAULT_OLLAMA_HOST,
      model,
    }).supportsVision(model);
    return ok
      ? { supported: true, model, provider, reason: '', ocrAvailable, ocrHint }
      : {
          supported: false, model, provider,
          reason: `"${model}" is text-only — it cannot see screenshots, so nothing was sent. ` +
            (ocrAvailable
              ? 'Local OCR is available: extract the screen text first, then ask about it.'
              : `Local OCR is not installed (${ocrHint}). You can describe the screen in words instead, or install a vision model such as qwen3-vl or llava.`),
          ocrAvailable, ocrHint,
        };
  } catch {
    return {
      supported: false, model, provider,
      reason: 'Could not verify vision support — Ollama is unreachable.',
      ocrAvailable, ocrHint,
    };
  }
}

/** Quick action: explain the current system snapshot in plain words. */export async function explainSystem(onToken?: (t: string) => void): Promise<string> {
  return askBlinky(
    'Look at my system snapshot above. In 2-3 short sentences: is anything worth my attention (high CPU/RAM, low battery)? If all is calm, say so warmly.',
    undefined,
    onToken
  );
}

/** Quick action: explain a pasted terminal/app error. */
export async function explainError(errorText: string, onToken?: (t: string) => void): Promise<string> {
  if (!errorText.trim()) {
    throw new AIProviderError(
      useBlinkyStore.getState().settings.aiProvider, 'bad-request',
      'Paste the error message first, then I’ll explain it.'
    );
  }
  return askBlinky(
    'Explain this error in plain words, then give the most likely fix as 1-3 short steps. Keep it concise.',
    undefined,
    onToken,
    { errorText, ambientContext: false }
  );
}

/** Quick action: help with a pasted code snippet. */
export async function explainCode(codeText: string, question: string, onToken?: (t: string) => void): Promise<string> {
  if (!codeText.trim()) {
    throw new AIProviderError(
      useBlinkyStore.getState().settings.aiProvider, 'bad-request',
      'Paste the code first, then tell me what to do with it.'
    );
  }
  return askBlinky(question.trim() || 'Explain what this code does, briefly.', undefined, onToken, {
    codeText,
    ambientContext: false,
  });
}
