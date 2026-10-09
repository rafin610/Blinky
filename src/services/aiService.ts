/**
 * Compatibility shim — the UI imports AI from here or from
 * `./ai/aiManager` directly. All logic lives in the provider layer.
 */
export {
  askBlinky,
  askBlinkyStream,
  listInstalledModels,
  checkAIStatus,
  describeVisionSupport,
  explainSystem,
  explainError,
  explainCode,
} from './ai/aiManager';
export type { AskOptions, VisionSupport } from './ai/aiManager';
export { DEFAULT_OLLAMA_HOST } from './ai/ollamaProvider';
export { AIProviderError, isAbortError } from './ai/types';
export type { AIModelInfo, AIConnectionStatus, AIProviderId } from './ai/types';
