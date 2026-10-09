import React, { useEffect, useState } from 'react';
import { useBlinkyStore } from '../../store/blinkyStore';
import { setAutostart } from '../../services/systemService';
import {
  listInstalledModels,
  checkAIStatus,
  AIConnectionStatus,
  AIModelInfo,
} from '../../services/aiService';
import {
  setOpenAIKey,
  clearOpenAIKey,
  hasOpenAIKey,
  secretStorageAvailable,
  migrateLegacyKey,
} from '../../services/secureStore';
import { getContextSourceStates } from '../../services/ai/contextManager';
import { CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import type { WidgetPosition, IdleBehavior } from '../../types';

const COMMON_NOTIFICATION_APPS = ['Discord', 'Slack', 'Telegram', 'System', 'Terminal', 'Browser'];

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="toggle" aria-label={label}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="track" />
    </label>
  );
}

function AISettingsSection() {
  const { settings, updateSettings } = useBlinkyStore();
  const [models, setModels] = useState<AIModelInfo[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [status, setStatus] = useState<(AIConnectionStatus & { provider: string; model: string }) | null>(null);
  const [checking, setChecking] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [keyStored, setKeyStored] = useState(false);
  const [keyBusy, setKeyBusy] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [keyringAvailable, setKeyringAvailable] = useState(false);

  const refreshModels = async () => {
    setLoadingModels(true);
    try {
      const list = await listInstalledModels();
      setModels(list);
      // Auto-adopt: current model missing but a Qwen is installed → select it.
      const currentOk = list.some((m) => m.name === settings.ollamaModel);
      if (!currentOk) {
        const qwen = list.find((m) => m.name.toLowerCase().includes('qwen'));
        const fallback = qwen ?? list[0];
        if (fallback) updateSettings({ ollamaModel: fallback.name });
      }
    } catch {
      setModels([]);
    } finally {
      setLoadingModels(false);
    }
  };

  const runCheck = async () => {
    setChecking(true);
    try {
      setStatus(await checkAIStatus());
    } catch {
      setStatus(null);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    refreshModels();
    void (async () => {
      try {
        await migrateLegacyKey();
      } catch {
        setKeyError('A previous API key could not be migrated safely and was removed. Re-enter it after enabling OS keyring access.');
      }
      const available = await secretStorageAvailable();
      setKeyringAvailable(available);
      const stored = await hasOpenAIKey();
      setKeyStored(stored);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveKey = async () => {
    if (!keyInput.trim()) return;
    setKeyBusy(true);
    setKeyError(null);
    try {
      await setOpenAIKey(keyInput);
      setKeyInput('');
      setKeyStored(true);
    } catch {
      setKeyError('Could not store the key securely. Check OS keyring availability; the key was not saved.');
    } finally {
      setKeyBusy(false);
    }
  };

  const forgetKey = async () => {
    setKeyBusy(true);
    setKeyError(null);
    try {
      await migrateLegacyKey().catch(() => {});
      await clearOpenAIKey();
      setKeyStored(false);
    } catch {
      setKeyError('Could not remove the key from OS credential storage.');
    } finally {
      setKeyBusy(false);
    }
  };

  const modelInstalled = models.some((m) => m.name === settings.ollamaModel);
  const selectedInfo = models.find((m) => m.name === settings.ollamaModel);

  return (
    <>
      <div className="set-group-title">AI · private by default</div>
      <div className="set-group">
        <div className="set-row">
          <div className="t"><b>Brain</b><span>Local-first, always</span></div>
          <div className="seg">
            <button className={settings.aiProvider === 'ollama' ? 'on' : ''} onClick={() => updateSettings({ aiProvider: 'ollama' })}>Local</button>
            <button className={settings.aiProvider === 'openai' ? 'on' : ''} onClick={() => updateSettings({ aiProvider: 'openai' })}>Cloud</button>
          </div>
        </div>

        {settings.aiProvider === 'ollama' ? (
          <>
            <div className="set-row">
              <div className="t"><b>Host</b><span>Your Ollama address</span></div>
              <input
                className="set-input"
                value={settings.ollamaEndpoint}
                onChange={(e) => updateSettings({ ollamaEndpoint: e.target.value })}
                onBlur={refreshModels}
                placeholder="http://localhost:11434"
                spellCheck={false}
              />
            </div>
            <div className="set-row">
              <div className="t">
                <b>Model</b>
                <span>{selectedInfo?.supportsVision ? 'Sees images ✓' : 'Text-only · screenshots stay local'}</span>
              </div>
              <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                <select
                  className="set-input"
                  value={settings.ollamaModel}
                  onChange={(e) => updateSettings({ ollamaModel: e.target.value })}
                  aria-label="Ollama model"
                >
                  {models.length === 0 && <option value={settings.ollamaModel}>{settings.ollamaModel}</option>}
                  {models.map((m) => (
                    <option key={m.name} value={m.name}>
                      {m.name}{m.supportsVision ? ' · 👁' : ''}
                    </option>
                  ))}
                </select>
                <button className="icon-mini" onClick={refreshModels} title="Refresh installed models" style={{ width: 26, height: 26 }}>
                  <RefreshCw size={13} className={loadingModels ? 'spin' : ''} />
                </button>
              </div>
            </div>
            <div className="set-row">
              <div className="t"><b>Temperature</b><span>{settings.ollamaTemperature.toFixed(1)} · calmer ↔ wilder</span></div>
              <input
                type="range" className="calm-range" min={0} max={1.5} step={0.1}
                value={settings.ollamaTemperature}
                onChange={(e) => updateSettings({ ollamaTemperature: parseFloat(e.target.value) })}
              />
            </div>
            <div className="set-row">
              <div className="t"><b>Context</b><span>Memory window</span></div>
              <div className="seg">
                {[4096, 8192, 16384].map((n) => (
                  <button
                    key={n}
                    className={settings.ollamaNumCtx === n ? 'on' : ''}
                    onClick={() => updateSettings({ ollamaNumCtx: n })}
                  >
                    {n / 1024}k
                  </button>
                ))}
              </div>
            </div>
            <div className="set-row">
              <div className="t"><b>Streaming</b><span>Words appear live</span></div>
              <Toggle label="Streaming" checked={settings.aiStreaming} onChange={(v) => updateSettings({ aiStreaming: v })} />
            </div>
            <div className="set-row">
              <div className="t"><b>Connection</b><span>{modelInstalled ? 'Model installed ✓' : 'Model not in list'}</span></div>
              <button className="mini-btn" onClick={runCheck} disabled={checking}>
                {checking ? 'Checking…' : 'Test'}
              </button>
            </div>
            {status && (
              <div className={`ai-status-line ${status.reachable ? 'online' : 'offline'}`}>
                {status.reachable ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                <span>{status.detail}</span>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="set-row">
              <div className="t"><b>Cloud brain</b><span>Optional, off by default</span></div>
              <Toggle label="Cloud brain" checked={settings.openaiEnabled} onChange={(v) => updateSettings({ openaiEnabled: v })} />
            </div>
            <div className="set-row">
              <div className="t"><b>API key</b><span>{keyStored ? 'Stored in OS keyring ✓' : keyringAvailable ? 'Not stored' : 'OS keyring unavailable; keys cannot be saved'}</span></div>
              {keyStored ? (
                <button className="mini-btn" onClick={forgetKey} disabled={keyBusy}>Forget</button>
              ) : (
                <div className="input-with-button">
                  <input
                    className="set-input" type="password" style={{ width: 96 }}
                    value={keyInput} onChange={(e) => setKeyInput(e.target.value)}
                    placeholder="sk-…" aria-label="OpenAI API key"
                  />
                  <button className="mini-btn" onClick={saveKey} disabled={keyBusy || !keyringAvailable || !keyInput.trim()}>Save</button>
                </div>
              )}
            </div>
            {keyError && <div className="mini-error" role="alert">{keyError}</div>}
            <div className="set-row">
              <div className="t"><b>Model</b><span>Cloud model name</span></div>
              <input className="set-input" value={settings.openaiModel} onChange={(e) => updateSettings({ openaiModel: e.target.value })} placeholder="gpt-4o-mini" spellCheck={false} />
            </div>
            <div className="set-row">
              <div className="t"><b>Allow cloud</b><span>Let prompts leave device</span></div>
              <Toggle label="Allow cloud" checked={settings.privacy.allowCloudAI} onChange={(v) => updateSettings({ privacy: { ...settings.privacy, allowCloudAI: v } })} />
            </div>
            <div className="set-row">
              <div className="t"><b>Connection</b><span>Validate key + reachability</span></div>
              <button className="mini-btn" onClick={runCheck} disabled={checking}>
                {checking ? 'Checking…' : 'Test'}
              </button>
            </div>
            {status && (
              <div className={`ai-status-line ${status.reachable ? 'online' : 'offline'}`}>
                {status.reachable ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                <span>{status.detail}</span>
              </div>
            )}
          </>
        )}
        <div className="set-row">
          <div className="t"><b>Screen looks</b><span>Let me see workspace</span></div>
          <Toggle label="Screen looks" checked={settings.privacy.allowScreenCapture} onChange={(v) => updateSettings({ privacy: { ...settings.privacy, allowScreenCapture: v } })} />
        </div>
        <div className="set-row">
          <div className="t"><b>Read notifications</b><span>Let AI summarize alerts</span></div>
          <Toggle label="Read notifications" checked={settings.privacy.allowNotificationAI} onChange={(v) => updateSettings({ privacy: { ...settings.privacy, allowNotificationAI: v } })} />
        </div>
        <div className="set-row">
          <div className="t"><b>System snapshot</b><span>Share metrics with AI</span></div>
          <Toggle label="System snapshot" checked={settings.context.allowSystemMetrics} onChange={(v) => updateSettings({ context: { ...settings.context, allowSystemMetrics: v } })} />
        </div>
      </div>

      <div className="set-group-title">Context sources</div>
      <div className="set-group">
        {getContextSourceStates().map((s) => (
          <div className="set-row" key={s.id}>
            <div className="t">
              <b style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                {s.available
                  ? <CheckCircle2 size={12} color="#2E9E6B" />
                  : <XCircle size={12} color="#C2B6AA" />}
                {s.label}
              </b>
              <span>{s.available ? (s.allowed ? 'On · only with permission' : 'Off') : (s.hint || 'Unavailable')}</span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export const SettingsTab: React.FC = () => {
  const { settings, updateSettings } = useBlinkyStore();
  const [clearDataBusy, setClearDataBusy] = useState(false);
  const [clearDataError, setClearDataError] = useState<string | null>(null);
  const [aiSettingsKey, setAiSettingsKey] = useState(0);
  const [newAppName, setNewAppName] = useState('');
  const [desktopWindowNote, setDesktopWindowNote] = useState('');

  useEffect(() => {
    if (!('__TAURI_INTERNALS__' in window)) {
      setDesktopWindowNote('Browser preview: launch with `npm run dev` to use the native floating desktop window.');
      return;
    }
    void import('@tauri-apps/api/core')
      .then(({ invoke }) => invoke<{ sessionType: string; desktop: string; note: string }>('get_desktop_window_info'))
      .then((info) => setDesktopWindowNote(`${info.desktop} · ${info.sessionType}: ${info.note}`))
      .catch(() => setDesktopWindowNote('Window placement and stacking are subject to desktop compositor policy.'));
  }, []);

  const clearLocalData = async () => {
    if (!window.confirm('Clear saved settings, chat, notification history, and the stored AI key? This cannot be undone.')) return;
    setClearDataBusy(true);
    setClearDataError(null);
    const failures: string[] = [];
    try {
      await migrateLegacyKey().catch(() => {});
      await clearOpenAIKey();
    } catch {
      failures.push('AI key');
    }
    try {
      await setAutostart(false);
    } catch {
      failures.push('autostart preference');
    }
    try {
      useBlinkyStore.getState().clearLocalData();
    } catch {
      failures.push('saved settings');
    } finally {
      setAiSettingsKey((key) => key + 1);
      setClearDataBusy(false);
    }
    if (failures.length) {
      setClearDataError(`Could not clear: ${failures.join(', ')}. Review the related settings and retry.`);
    }
  };

  const addAppToAllowlist = () => {
    const app = newAppName.trim();
    if (app && !settings.monitoredApps.some((name) => name.toLowerCase() === app.toLowerCase())) {
      updateSettings({ monitoredApps: [...settings.monitoredApps, app] });
    }
    setNewAppName('');
  };

  const positions: { id: WidgetPosition; label: string }[] = [
    { id: 'bottom-right', label: 'BR' },
    { id: 'bottom-left', label: 'BL' },
    { id: 'top-right', label: 'TR' },
    { id: 'top-left', label: 'TL' },
  ];
  const idles: { id: IdleBehavior; label: string }[] = [
    { id: 'float', label: 'Float' },
    { id: 'breathe', label: 'Breathe' },
    { id: 'still', label: 'Still' },
  ];
  const dots = ['#C4E5FC', '#FFD6E0', '#D8F3DC', '#E2D4F0', '#FFF3B0'];

  return (
    <div className="mini-scroll" style={{ overflowY: 'auto', maxHeight: 300 }}>
      {/* General */}
      <div className="set-group-title">General</div>
      {desktopWindowNote && <p className="desktop-window-note">{desktopWindowNote}</p>}
      <div className="set-group">
        <div className="set-row">
          <div className="t"><b>Start with system</b><span>Blinky wakes on login</span></div>
          <Toggle label="Start with system" checked={settings.autostart} onChange={async (v) => {
            try {
              await setAutostart(v);
              updateSettings({ autostart: v });
            } catch {
              setClearDataError('Could not update start-with-system. Check your desktop autostart permissions.');
            }
          }} />
        </div>
        <div className="set-row">
          <div className="t"><b>Always on top</b><span>Float above windows</span></div>
          <Toggle label="Always on top" checked={settings.alwaysOnTop} onChange={(v) => updateSettings({ alwaysOnTop: v })} />
        </div>
        <div className="set-row">
          <div className="t"><b>Corner</b><span>Where I live</span></div>
          <div className="seg">
            {positions.map((p) => (
              <button key={p.id} className={settings.position === p.id ? 'on' : ''} onClick={() => updateSettings({ position: p.id })}>{p.label}</button>
            ))}
          </div>
        </div>
        <div className="set-row">
          <div className="t"><b>Size</b><span>{Math.round((settings.scale || 1) * 100)}% of me</span></div>
          <input type="range" className="calm-range" min={0.85} max={1.2} step={0.05} value={settings.scale || 1} onChange={(e) => updateSettings({ scale: parseFloat(e.target.value) })} />
        </div>
      </div>

      {/* Character */}
      <div className="set-group-title">Character</div>
      <div className="set-group">
        <div className="set-row">
          <div className="t"><b>Energy</b><span>How bouncy I am</span></div>
          <input type="range" className="calm-range" min={0} max={1} step={0.1} value={settings.animationIntensity ?? 0.7} onChange={(e) => updateSettings({ animationIntensity: parseFloat(e.target.value) })} />
        </div>
        <div className="set-row">
          <div className="t"><b>Idle</b><span>What I do alone</span></div>
          <div className="seg">
            {idles.map((x) => (
              <button key={x.id} className={settings.idleBehavior === x.id ? 'on' : ''} onClick={() => updateSettings({ idleBehavior: x.id })}>{x.label}</button>
            ))}
          </div>
        </div>
        <div className="set-row">
          <div className="t"><b>Tint</b><span>Soft silicone color</span></div>
          <div className="dots-row">
            {dots.map((c) => (
              <button key={c} className={`dot-pick ${settings.siliconeColor === c ? 'on' : ''}`} style={{ background: c }} onClick={() => updateSettings({ siliconeColor: c })} aria-label={`Color ${c}`} />
            ))}
            <input type="color" value={settings.siliconeColor} onChange={(e) => updateSettings({ siliconeColor: e.target.value })} style={{ width: 24, height: 24, border: 'none', background: 'transparent', cursor: 'pointer' }} />
          </div>
        </div>
        <div className="set-row">
          <div className="t"><b>Follow cursor</b><span>Eyes follow you</span></div>
          <Toggle label="Follow cursor" checked={settings.enableLookAt} onChange={(v) => updateSettings({ enableLookAt: v })} />
        </div>
      </div>

      {/* Notifications */}
      <div className="set-group-title">Notifications</div>
      <div className="set-group">
        <div className="set-row">
          <div className="t"><b>Monitor notifications</b><span>Off by default · accepts forwarded app events</span></div>
          <Toggle
            label="Monitor notifications"
            checked={settings.privacy.allowNotificationMonitoring}
            onChange={(v) => updateSettings({ privacy: { ...settings.privacy, allowNotificationMonitoring: v } })}
          />
        </div>
        {settings.privacy.allowNotificationMonitoring && (
          <div className="app-monitor-list">
            <div className="t"><b>Allowed apps</b><span>Only selected forwarded events are stored</span></div>
            {[...new Set([...COMMON_NOTIFICATION_APPS, ...settings.monitoredApps])].map((app) => {
              const checked = settings.monitoredApps.some((name) => name.toLowerCase() === app.toLowerCase());
              return (
                <label className="app-monitor-option" key={app}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      const monitoredApps = checked
                        ? settings.monitoredApps.filter((name) => name.toLowerCase() !== app.toLowerCase())
                        : [...settings.monitoredApps, app];
                      updateSettings({ monitoredApps });
                      if (checked) useBlinkyStore.getState().removeNotificationsForApp(app);
                    }}
                  />
                  <span>{app}</span>
                </label>
              );
            })}
            <div className="app-monitor-add">
              <input
                className="set-input"
                aria-label="Add app to notification allowlist"
                placeholder="Add app name"
                value={newAppName}
                onChange={(event) => setNewAppName(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter') addAppToAllowlist(); }}
              />
              <button className="mini-btn" onClick={addAppToAllowlist}>Add</button>
            </div>
          </div>
        )}
        <div className="set-row">
          <div className="t"><b>Show bubbles</b><span>Pop above me</span></div>
          <Toggle label="Show bubbles" checked={settings.wakeOnNotification} onChange={(v) => updateSettings({ wakeOnNotification: v })} />
        </div>
        <div className="set-row">
          <div className="t"><b>Stay</b><span>{settings.notificationDuration}s on screen</span></div>
          <input type="range" className="calm-range" min={3} max={12} step={1} value={settings.notificationDuration || 6} onChange={(e) => updateSettings({ notificationDuration: parseInt(e.target.value) })} />
        </div>
        <div className="set-row">
          <div className="t"><b>Keep history</b><span>Remember past notes</span></div>
          <Toggle label="Keep history" checked={settings.notificationHistory} onChange={(v) => updateSettings({ notificationHistory: v })} />
        </div>
        <div className="set-row">
          <div className="t"><b>Notification sound</b><span>Short chime for new permitted alerts</span></div>
          <Toggle
            label="Notification sound"
            checked={settings.soundEffects && !settings.disableSounds}
            onChange={(v) => updateSettings({ soundEffects: v, disableSounds: !v })}
          />
        </div>
        <div className="set-row">
          <div className="t"><b>Volume</b><span>{Math.round(settings.notificationVolume * 100)}%</span></div>
          <input
            type="range"
            className="calm-range"
            min={0}
            max={1}
            step={0.05}
            value={settings.notificationVolume}
            disabled={!settings.soundEffects || settings.disableSounds}
            onChange={(event) => updateSettings({ notificationVolume: Number(event.target.value) })}
          />
        </div>
      </div>

      <div className="set-group-title">Privacy</div>
      <div className="set-group">
        <div className="set-row">
          <div className="t"><b>Microphone</b><span>Browser speech service may process audio; tap mic to start</span></div>
          <Toggle
            label="Microphone access"
            checked={settings.privacy.allowMicrophone}
            onChange={(v) => updateSettings({ privacy: { ...settings.privacy, allowMicrophone: v } })}
          />
        </div>
        <div className="set-row">
          <div className="t"><b>Clear local data</b><span>Settings, chats, notifications and AI key</span></div>
          <button className="mini-btn" onClick={clearLocalData} disabled={clearDataBusy}>
            {clearDataBusy ? 'Clearing…' : 'Clear data'}
          </button>
        </div>
        {clearDataError && <div className="mini-error" role="alert">{clearDataError}</div>}
      </div>

      {/* AI */}
      <AISettingsSection key={aiSettingsKey} />

      {/* Accessibility */}
      <div className="set-group-title">Accessibility</div>
      <div className="set-group">
        <div className="set-row">
          <div className="t"><b>Reduced motion</b><span>Gentle, still Blinky</span></div>
          <Toggle label="Reduced motion" checked={settings.reducedMotion} onChange={(v) => updateSettings({ reducedMotion: v })} />
        </div>
        <div className="set-row">
          <div className="t"><b>Quiet mode</b><span>No sounds at all</span></div>
          <Toggle label="Quiet mode" checked={settings.disableSounds || !settings.soundEffects} onChange={(v) => updateSettings({ disableSounds: v, soundEffects: !v })} />
        </div>
        <div className="set-row">
          <div className="t"><b>High contrast</b><span>Easier to read</span></div>
          <Toggle label="High contrast" checked={settings.highContrast} onChange={(v) => updateSettings({ highContrast: v })} />
        </div>
      </div>

      <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--faint)', textAlign: 'center', padding: '6px 0 2px' }}>
        Blinky 1.0 · made to be calm ✦
      </p>
    </div>
  );
};
