/**
 * Live verification of Blinky's AI provider layer against real Ollama.
 * Run: npm run test:ai
 * (Bundles with esbuild first: Node ESM can't resolve extensionless
 * TS imports. Pure provider functions only — no store, no UI.)
 */
import {
  listOllamaModels,
  checkOllama,
  chatOllama,
  chatOllamaStream,
  modelSupportsVision,
  DEFAULT_OLLAMA_HOST,
} from '../src/services/ai/ollamaProvider.ts';

let failures = 0;
function check(name: string, cond: boolean, extra = '') {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ` — ${extra}` : ''}`);
  if (!cond) failures++;
}

const models = await listOllamaModels(DEFAULT_OLLAMA_HOST);
check('model discovery finds models', models.length > 0, `${models.length} found`);
const qwen = models.find((m) => m.name === 'qwen3:8b');
check('exact installed model qwen3:8b discovered', !!qwen, qwen ? `size=${(qwen.size / 1e9).toFixed(1)}GB params=${qwen.parameterSize}` : 'missing');
check('qwen3:8b correctly reported as TEXT-ONLY', qwen ? !qwen.supportsVision : false, `caps=[${qwen?.capabilities.join(',')}]`);
check('unknown model never assumed vision-capable',
  !modelSupportsVision({ name: 'definitely-not-a-model-xyz', capabilities: [] }));

const status = await checkOllama(DEFAULT_OLLAMA_HOST, 'qwen3:8b');
check('connection check reachable + model installed', status.reachable, status.detail);

const bad = await checkOllama('http://127.0.0.1:9', 'qwen3:8b');
check('unreachable host gives friendly status (no throw)', !bad.reachable && bad.models.length === 0, bad.detail);

try {
  await listOllamaModels('not-a-url');
  check('invalid host rejected', false);
} catch (e) {
  check('invalid host rejected', true, (e as Error).message);
}

// Non-stream chat: must be fast-ish (think:false) and contain no thinking leak.
const t0 = Date.now();
const reply = await chatOllama(
  { host: DEFAULT_OLLAMA_HOST, model: 'qwen3:8b', temperature: 0.6, numCtx: 8192 },
  [{ role: 'user', content: 'Reply with exactly: Blinky link OK' }]
);
const dt = (Date.now() - t0) / 1000;
check('non-stream chat answers', reply.includes('Blinky link OK'), `${dt.toFixed(1)}s: ${reply.slice(0, 80)}`);
check('no thinking trace leaked into reply', !/let me make sure|i need to check|As an AI/i.test(reply));

// Streaming: tokens arrive incrementally.
let tokens = 0;
let firstTokenAt = -1;
const s0 = Date.now();
const full = await chatOllamaStream(
  { host: DEFAULT_OLLAMA_HOST, model: 'qwen3:8b', temperature: 0.6, numCtx: 8192 },
  [{ role: 'user', content: 'Count to three, then stop. Just: 1 2 3' }],
  { onToken: () => { tokens++; if (firstTokenAt < 0) firstTokenAt = (Date.now() - s0) / 1000; } }
);
check('streaming yields incremental tokens', tokens > 2, `${tokens} tokens, first after ${firstTokenAt.toFixed(1)}s`);
check('streamed reply complete', /1/.test(full) && /3/.test(full), full.slice(0, 60));

// Cancellation.
const ctrl = new AbortController();
const pending = chatOllamaStream(
  { host: DEFAULT_OLLAMA_HOST, model: 'qwen3:8b' },
  [{ role: 'user', content: 'Write a long story about a robot.' }],
  { signal: ctrl.signal, onToken: () => {} }
);
setTimeout(() => ctrl.abort(), 1500);
try {
  await pending;
  check('cancel stops stream', false, 'completed despite abort');
} catch (e) {
  check('cancel stops stream', (e as Error).message.toLowerCase().includes('cancel'));
}

// Missing model: clear guidance, no auto-download.
try {
  await chatOllama(
    { host: DEFAULT_OLLAMA_HOST, model: 'no-such-model-xyz' },
    [{ role: 'user', content: 'hi' }]
  );
  check('missing model error', false);
} catch (e) {
  const msg = (e as Error).message;
  check('missing model error is helpful', /not installed/i.test(msg) && !/pull/i.test(msg), msg.slice(0, 90));
}

console.log(failures === 0 ? '\nALL AI PROVIDER CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
