import { SystemContextData } from '../types';
import { useBlinkyStore } from '../store/blinkyStore';

// Check if running inside Tauri environment
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

// Dynamically invoke Tauri command or fallback
async function invokeTauri<T>(command: string, args: Record<string, any> = {}): Promise<T> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<T>(command, args);
  }
  throw new Error('Not running inside Tauri');
}

/**
 * Fetch Linux system context (CPU load, RAM, Battery, Uptime)
 */
export async function fetchSystemContext(): Promise<SystemContextData> {
  if (!useBlinkyStore.getState().settings.context.allowSystemMetrics) {
    return useBlinkyStore.getState().systemContext;
  }
  try {
    const data = await invokeTauri<any>('get_system_context');
    return {
      cpuUsage: Math.round(data.cpu_usage * 10) / 10,
      ramUsedMb: data.ram_used_mb,
      ramTotalMb: data.ram_total_mb,
      batteryPercent: data.battery_percent,
      isCharging: data.is_charging,
      uptimeSecs: data.uptime_secs,
      desktopSession: data.desktop_session
    };
  } catch (e) {
    // Browser mock fallback
    return {
      cpuUsage: 14.2,
      ramUsedMb: 4200,
      ramTotalMb: 16384,
      batteryPercent: 85,
      isCharging: false,
      uptimeSecs: 14400,
      desktopSession: 'Pop!_OS (GNOME)'
    };
  }
}

/**
 * Capture current desktop screen with privacy opt-in
 */
export async function captureScreenNative(optIn: boolean): Promise<string> {
  if (!optIn) {
    throw new Error('Privacy settings prevent screen capture. Enable in Settings.');
  }

  try {
    return await invokeTauri<string>('capture_screen', { optIn });
  } catch (err: any) {
    if (!isTauri()) {
      // Return a simulated screenshot canvas data URL for browser testing
      return generateMockScreenCapture();
    }
    throw err;
  }
}

/**
 * Linux Autostart toggle
 */
export async function setAutostart(enable: boolean): Promise<boolean> {
  if (!isTauri()) return false;
  return invokeTauri<boolean>('toggle_autostart', { enable });
}

export async function checkAutostart(): Promise<boolean> {
  try {
    return await invokeTauri<boolean>('is_autostart_enabled');
  } catch (e) {
    return false;
  }
}

/**
 * Setup notification listener and global shortcut
 */
export async function setupSystemListeners() {
  if (!isTauri()) return;

  try {
    // Setup global shortcut
    const { register } = await import('@tauri-apps/plugin-global-shortcut');
    const shortcut = useBlinkyStore.getState().settings.globalHotkey || 'Ctrl+Space';
    await register(shortcut, () => {
      const { togglePanel } = useBlinkyStore.getState();
      togglePanel();
    });
  } catch (err) {
    throw new Error('Could not register the global shortcut.');
  }
}

export async function setupNotificationListener(): Promise<() => void> {
  if (!isTauri()) return () => {};
  const { settings } = useBlinkyStore.getState();
  if (!settings.privacy.allowNotificationMonitoring || settings.monitoredApps.length === 0) return () => {};
  const { listen } = await import('@tauri-apps/api/event');
  return listen<any>('system-notification', (event) => {
    const { settings, addNotification } = useBlinkyStore.getState();
    if (!settings.privacy.allowNotificationMonitoring) return;
    const payload = event.payload;
    const appName = typeof payload?.app_name === 'string' ? payload.app_name.trim().slice(0, 80) : '';
    if (!appName || !settings.monitoredApps.some((app) => app.toLowerCase() === appName.toLowerCase())) return;
    const categories = ['important', 'normal', 'low', 'ignored'] as const;
    const category = categories.includes(payload.category) ? payload.category : 'normal';
    addNotification({
      appName,
      title: typeof payload.title === 'string' ? payload.title.slice(0, 300) : '',
      body: typeof payload.body === 'string' ? payload.body.slice(0, 1500) : '',
      category,
    });
  });
}

/**
 * Helper to generate a mockup screen capture in browser test environment
 */
function generateMockScreenCapture(): string {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 360;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    // Desktop wallpaper simulation
    const grad = ctx.createLinearGradient(0, 0, 640, 360);
    grad.addColorStop(0, '#1E293B');
    grad.addColorStop(1, '#0F172A');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 640, 360);

    // Mock terminal window
    ctx.fillStyle = '#090D16';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.fillRect(60, 40, 520, 260);
    ctx.strokeRect(60, 40, 520, 260);

    // Mock text
    ctx.fillStyle = '#38BDF8';
    ctx.font = '14px monospace';
    ctx.fillText('ahmed@pop-os:~$ neofetch', 80, 80);
    ctx.fillStyle = '#94A3B8';
    ctx.fillText('OS: Pop!_OS 22.04 LTS x86_64', 80, 110);
    ctx.fillText('Host: Linux Desktop Companion "Blinky"', 80, 130);
    ctx.fillText('Uptime: 4 hours, 28 mins', 80, 150);
    ctx.fillText('Active Window: VSCode - Blinky Project', 80, 170);
  }
  return canvas.toDataURL('image/png');
}
