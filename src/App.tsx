import React, { useEffect } from 'react';
import { useBlinkyStore } from './store/blinkyStore';
import { Blinky3D } from './components/character/Blinky3D';
import { NotificationBubble } from './components/notifications/NotificationBubble';
import { InteractionPanel } from './components/panel/InteractionPanel';
import { setupSystemListeners, setupNotificationListener, fetchSystemContext } from './services/systemService';
import { stopVoiceRecognition } from './services/voiceService';
import { migrateLegacyKey } from './services/secureStore';
import { primeNotificationAudio } from './services/notificationSound';
import './app.css';

export const App: React.FC = () => {
  const { isPanelOpen, setSystemContext, settings, clearAllNotifications } = useBlinkyStore();

  useEffect(() => {
    setupSystemListeners().catch(() => {
      console.warn('Could not register the global shortcut.');
    });
    // Move any legacy plaintext OpenAI key into the OS keyring once.
    migrateLegacyKey().catch(() => {
      console.warn('Could not complete secure migration of legacy settings.');
    });
  }, []);

  useEffect(() => {
    if (!settings.context.allowSystemMetrics) return;
    const refresh = () => {
      fetchSystemContext().then((ctx) => setSystemContext(ctx));
    };
    refresh();
    const timer = setInterval(refresh, 8000);
    return () => clearInterval(timer);
  }, [settings.context.allowSystemMetrics, setSystemContext]);

  useEffect(() => {
    if (!settings.privacy.allowNotificationMonitoring || settings.monitoredApps.length === 0) {
      clearAllNotifications();
      return;
    }
    let active = true;
    let unlisten: (() => void) | undefined;
    setupNotificationListener().then((stop) => {
      if (active) unlisten = stop;
      else stop();
    }).catch(() => console.warn('Could not start notification monitoring.'));
    return () => {
      active = false;
      unlisten?.();
    };
  }, [settings.privacy.allowNotificationMonitoring, settings.monitoredApps, clearAllNotifications]);

  useEffect(() => {
    if (!settings.privacy.allowMicrophone) stopVoiceRecognition();
  }, [settings.privacy.allowMicrophone]);

  // Restore and constrain the native window position where the compositor allows it.
  useEffect(() => {
    if (!('__TAURI_INTERNALS__' in window)) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    let saveTimer: ReturnType<typeof setTimeout> | undefined;
    (async () => {
      try {
        const { getCurrentWindow, availableMonitors, primaryMonitor } = await import('@tauri-apps/api/window');
        const { PhysicalPosition } = await import('@tauri-apps/api/dpi');
        const win = getCurrentWindow();
        await win.setAlwaysOnTop(settings.alwaysOnTop);
        const monitors = await availableMonitors();
        const size = await win.outerSize();
        const savedPosition = localStorage.getItem('blinky_window_position');
        let desired: { x: number; y: number } | null = null;
        if (savedPosition) {
          try {
            const candidate = JSON.parse(savedPosition) as { x?: number; y?: number };
            if (Number.isFinite(candidate.x) && Number.isFinite(candidate.y)) {
              desired = { x: candidate.x!, y: candidate.y! };
            }
          } catch {
            localStorage.removeItem('blinky_window_position');
          }
        }
        const monitor = desired
          ? monitors.find((item) =>
              desired!.x >= item.position.x && desired!.x < item.position.x + item.size.width &&
              desired!.y >= item.position.y && desired!.y < item.position.y + item.size.height
            ) ?? await primaryMonitor()
          : await primaryMonitor();
        if (monitor) {
          const left = monitor.position.x;
          const top = monitor.position.y;
          const right = left + monitor.size.width - size.width;
          const bottom = top + monitor.size.height - size.height;
          desired = desired
            ? {
                x: Math.max(left, Math.min(desired.x, Math.max(left, right))),
                y: Math.max(top, Math.min(desired.y, Math.max(top, bottom))),
              }
            : {
                x: Math.max(left, right - 24),
                y: Math.max(top, bottom - 24),
              };
          try {
            await win.setPosition(new PhysicalPosition(desired.x, desired.y));
          } catch {
            // COSMIC/Wayland may ignore programmatic positioning.
          }
        }
        if (disposed) return;
        unlisten = await win.onMoved(({ payload }) => {
          if (saveTimer) clearTimeout(saveTimer);
          saveTimer = setTimeout(() => {
            try {
              localStorage.setItem('blinky_window_position', JSON.stringify({
                x: payload.x,
                y: payload.y,
              }));
            } catch {
              // Position restoration is best-effort when webview storage is unavailable.
            }
          }, 300);
        });
      } catch {
        // Wayland compositors may refuse absolute window placement.
      }
    })();
    return () => {
      disposed = true;
      if (saveTimer) clearTimeout(saveTimer);
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    if (!('__TAURI_INTERNALS__' in window)) return;
    void import('@tauri-apps/api/window').then(({ getCurrentWindow }) =>
      getCurrentWindow().setAlwaysOnTop(settings.alwaysOnTop)
    ).catch(() => {
      console.warn('The desktop compositor did not accept the always-on-top request.');
    });
  }, [settings.alwaysOnTop]);

  useEffect(() => {
    if (!('__TAURI_INTERNALS__' in window)) return;
    void (async () => {
      try {
        const { getCurrentWindow, availableMonitors, currentMonitor } = await import('@tauri-apps/api/window');
        const { LogicalSize, PhysicalPosition } = await import('@tauri-apps/api/dpi');
        const win = getCurrentWindow();
        const scale = await win.scaleFactor();
        const currentSize = await win.outerSize();
        const width = isPanelOpen ? 340 : 260;
        const height = isPanelOpen ? 620 : 260;
        const deltaWidth = (width * scale) - currentSize.width;
        const deltaHeight = (height * scale) - currentSize.height;
        if (!deltaWidth && !deltaHeight) return;
        await win.setSize(new LogicalSize(width, height));
        try {
          const oldPosition = await win.outerPosition();
          const monitors = await availableMonitors();
          const monitor = await currentMonitor();
          const bounds = monitor ?? monitors[0];
          let x = oldPosition.x - Math.round(deltaWidth / 2);
          let y = oldPosition.y - deltaHeight;
          if (bounds) {
            x = Math.max(bounds.position.x, Math.min(x, bounds.position.x + bounds.size.width - width * scale));
            y = Math.max(bounds.position.y, Math.min(y, bounds.position.y + bounds.size.height - height * scale));
          }
          await win.setPosition(new PhysicalPosition(x, y));
        } catch {
          // Wayland can permit resizing while refusing absolute repositioning.
        }
      } catch (error) {
        console.warn('The native window could not be resized for the interaction panel.', error);
      }
    })();
  }, [isPanelOpen]);

  useEffect(() => {
    const onGesture = () => primeNotificationAudio();
    window.addEventListener('pointerdown', onGesture, { once: true });
    window.addEventListener('keydown', onGesture, { once: true });
    return () => {
      window.removeEventListener('pointerdown', onGesture);
      window.removeEventListener('keydown', onGesture);
    };
  }, []);

  useEffect(() => {
    if (!isPanelOpen) return;
    const onOutsideClick = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && !target.closest('.blinky-panel, .blinky-character-zone')) {
        useBlinkyStore.getState().togglePanel(false);
      }
    };
    document.addEventListener('pointerdown', onOutsideClick);
    return () => document.removeEventListener('pointerdown', onOutsideClick);
  }, [isPanelOpen]);

  // Global hotkey: Ctrl+Space toggles Blinky (browser fallback; native via Tauri plugin)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const want = (settings.globalHotkey || 'Ctrl+Space').toLowerCase();
      const isCtrlSpace =
        (e.ctrlKey || e.metaKey) && e.code === 'Space';
      if (want.includes('ctrl+space') && isCtrlSpace) {
        e.preventDefault();
        useBlinkyStore.getState().togglePanel();
      }
      if (e.key === 'Escape' && useBlinkyStore.getState().isPanelOpen) {
        useBlinkyStore.getState().togglePanel(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [settings.globalHotkey]);

  const rootClass = [
    'blinky-app-root',
    isPanelOpen ? 'panel-open' : 'idle-only',
    settings.reducedMotion ? 'reduce-motion' : '',
    settings.highContrast ? 'high-contrast' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={rootClass}
      style={{ transform: `scale(${settings.scale || 1})` }}
    >
      {/* Notification arrives above Blinky, auto-dismisses quietly */}
      <NotificationBubble />

      {/* Compact panel only when Blinky is tapped */}
      <InteractionPanel />

      {/* Blinky herself — the primary UI. Nothing else when idle. */}
      <Blinky3D isPanelOpen={isPanelOpen} />
    </div>
  );
};

export default App;
