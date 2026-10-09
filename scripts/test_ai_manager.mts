/**
 * End-to-end verification of Blinky's AI MANAGER (providers + context
 * gates + vision gate) against live Ollama. Run: npm run test:ai:manager
 * Needs no UI, no Tauri, no internet — only localhost Ollama.
 */
import { useBlinkyStore } from '../src/store/blinkyStore.ts';
import {
  askBlinky,
  askBlinkyStream,
  checkAIStatus,
  describeVisionSupport,
  explainSystem,
  listInstalledModels,
} from '../src/services/ai/aiManager.ts';

// Fresh deterministic settings for the test run.
useBlinkyStore.getState().updateSettings({
  aiProvider: 'ollama',
  ollamaEndpoint: 'http://localhost:11434',
  ollamaModel: 'qwen3:8b',
  ollamaTemperature: 0.6,
  ollamaNumCtx: 8192,
  aiStreaming: true,
  openaiEnabled: false,
  context: { allowSystemMetrics: true },
  privacy: {
    allowScreenCapture: true,
    allowCloudAI: false,
    allowNotificationAI: true,
    storeHistory: true,
  },
});

let failures = 0;
function check(name: string, cond: boolean, extra = '') {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ` — ${extra}` : ''}`);
  if (!cond) failures++;
}

// 1. Manager routes to Ollama by default and answers with ambient context.
const t0 = Date.now();
const reply = await askBlinky('Reply with exactly: manager link OK');
check('manager chat via default Ollama', reply.includes('manager link OK'), `${((Date.now() - t0) / 1000).toFixed(1)}s`);

// 2. Streaming through the manager.
let tokens = 0;
const { promise, cancel: _cancel } = askBlinkyStream('Reply with exactly: stream OK', () => { tokens++; });
void _cancel;
const sreply = await promise;
check('manager streaming answers', sreply.includes('stream OK') && tokens > 1, `${tokens} tokens`);

// 3. Status: reachable, exact model installed.
const status = await checkAIStatus();
check('manager status: reachable + qwen3:8b installed',
  status.reachable && status.provider === 'ollama' && status.model === 'qwen3:8b', status.detail);

// 4. Model discovery through the manager.
const models = await listInstalledModels();
check('manager discovers qwen3:8b', models.some((m) => m.name === 'qwen3:8b'));

// 5. Vision gate: text-only model + screenshot → REFUSAL, nothing sent.
const fakePng = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13]);
try {
  await askBlinky('What is in this image?', undefined, undefined, { screenshotBytes: fakePng });
  check('vision gate refuses text-only image send', false, 'image was accepted!');
} catch (e) {
  const msg = (e as Error).message;
  check('vision gate refuses text-only image send',
    /text-only/i.test(msg) && /nothing was sent/i.test(msg), msg.slice(0, 100));
}

// 6. describeVisionSupport confirms text-only + OCR honestly unavailable.
const vision = await describeVisionSupport();
check('vision support verified as text-only', !vision.supported && vision.model === 'qwen3:8b', vision.reason.slice(0, 80));
check('OCR honestly reported unavailable (no tesseract here)', vision.ocrAvailable === false);

// 7. System explainer uses real local context, offline.
const expl = await explainSystem();
check('explainSystem answers with local context', expl.length > 20, expl.slice(0, 90));

// 8. Cloud stays off: OpenAI path requires enablement, never auto-fallback.
useBlinkyStore.getState().updateSettings({ aiProvider: 'openai' });
try {
  await askBlinky('hi');
  check('disabled OpenAI refuses instead of running', false);
} catch (e) {
  check('disabled OpenAI refuses instead of running', /disabled/i.test((e as Error).message));
}
useBlinkyStore.getState().updateSettings({ aiProvider: 'ollama' });

// 9. Privacy gate: screenshot without opt-in is refused before any send.
useBlinkyStore.getState().updateSettings({
  privacy: {
    allowScreenCapture: false,
    allowCloudAI: false,
    allowNotificationAI: true,
    storeHistory: true,
  },
});
try {
  await askBlinky('What is in this image?', undefined, undefined, { screenshotBytes: fakePng });
  check('screen opt-out blocks image path', false);
} catch (e) {
  check('screen opt-out blocks image path', /disabled by your privacy settings/i.test((e as Error).message));
}

console.log(failures === 0 ? '\nALL AI MANAGER CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
