/**
 * Secure credential storage for Blinky.
 *
 * OpenAI API key lives in the OS keyring (Secret Service on Linux via
 * the Rust `keyring` crate) — never in localStorage, config files,
 * logs, or git. Outside Tauri, cloud credentials are unavailable rather
 * than being placed in browser storage.
 */

const SERVICE = 'com.blinky.companion';
const ACCOUNT = 'openai-api-key';

let keyringState: 'unknown' | 'available' | 'unavailable' = 'unknown';

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

async function invokeCmd<T>(cmd: string, args: Record<string, unknown> = {}): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<T>(cmd, args);
}

export async function secretStorageAvailable(): Promise<boolean> {
  if (!isTauri()) {
    keyringState = 'unavailable';
    return false;
  }
  if (keyringState !== 'unknown') return keyringState === 'available';
  try {
    keyringState = (await invokeCmd<boolean>('secret_available')) ? 'available' : 'unavailable';
  } catch {
    keyringState = 'unavailable';
  }
  return keyringState === 'available';
}

let migrationPromise: Promise<void> | null = null;

/** Migrate any legacy plaintext key from settings into the keyring once. */
export function migrateLegacyKey(): Promise<void> {
  if (!migrationPromise) migrationPromise = migrateLegacyKeyOnce();
  return migrationPromise;
}

async function migrateLegacyKeyOnce(): Promise<void> {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem('blinky_settings');
  } catch {
    return;
  }
  if (!raw) return;
  let saved: Record<string, unknown>;
  try {
    saved = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return;
  }
  const legacy = typeof saved.openaiApiKey === 'string' ? saved.openaiApiKey.trim() : '';
  if (!legacy) return;
  try {
    if (!await secretStorageAvailable()) throw new Error('OS keyring unavailable');
    await invokeCmd('secret_set', { service: SERVICE, account: ACCOUNT, secret: legacy });
  } catch {
    throw new Error('Legacy OpenAI key could not be moved to secure storage.');
  } finally {
    const { openaiApiKey: _legacyApiKey, ...cleanSettings } = saved;
    localStorage.setItem('blinky_settings', JSON.stringify(cleanSettings));
  }
}

export async function setOpenAIKey(key: string): Promise<'keyring'> {
  const trimmed = (key || '').trim();
  if (!trimmed) {
    await clearOpenAIKey();
    return 'keyring';
  }
  if (!await secretStorageAvailable()) {
    throw new Error('OS credential storage is unavailable. The API key was not saved.');
  }
  await invokeCmd('secret_set', { service: SERVICE, account: ACCOUNT, secret: trimmed });
  return 'keyring';
}

export async function clearOpenAIKey(): Promise<void> {
  if (isTauri()) {
    await invokeCmd('secret_delete', { service: SERVICE, account: ACCOUNT });
  }
}

export async function hasOpenAIKey(): Promise<boolean> {
  if (!await secretStorageAvailable()) return false;
  try {
    return await invokeCmd<boolean>('secret_has', { service: SERVICE, account: ACCOUNT });
  } catch {
    return false;
  }
}
