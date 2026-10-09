/**
 * Blinky Context Manager — gathers ONLY explicitly permitted context.
 *
 * Every source has an independent switch and an availability state.
 * Sensitive sources (clipboard, screenshot, selected text) are never
 * collected silently: they arrive as explicit function arguments from
 * a user gesture (button tap, paste action, capture flow).
 *
 * Verified platform reality (this laptop, COSMIC/Wayland):
 * - System metrics (/proc,/sys): available.
 * - Notifications: available in-app once the user allows AI access.
 * - Active window / selected text: NOT available (no X11 query tools
 *   on Wayland, no portal wired) — reported as unavailable.
 * - Clipboard: manual attach only (WebView clipboard read on gesture).
 * - Screenshot: explicit capture flow only.
 * - OCR: unavailable (no tesseract) — setup hint provided.
 */

import { useBlinkyStore } from '../../store/blinkyStore';

export type ContextSourceId =
  | 'system-metrics'
  | 'notifications'
  | 'active-window'
  | 'selected-text'
  | 'clipboard'
  | 'screenshot'
  | 'ocr';

export interface ContextSourceState {
  id: ContextSourceId;
  label: string;
  /** User permission state. */
  allowed: boolean;
  /** Platform capability state. */
  available: boolean;
  /** Shown when unavailable or needs setup. */
  hint?: string;
}

export interface ContextPreviewItem {
  source: ContextSourceId;
  label: string;
  /** Short, safe-to-display summary of what will be sent. */
  detail: string;
}

export interface BuiltContext {
  /** Extra system-prompt lines derived from permitted sources. */
  systemExtra: string;
  /** Preview shown in UI ("what Blinky will include"). */
  preview: ContextPreviewItem[];
}

export interface ExplicitAttachments {
  /** Pasted/attached clipboard text from a user tap. Never auto-read. */
  clipboardText?: string;
  /** Screenshot bytes from the explicit capture flow. Never background. */
  screenshotBytes?: Uint8Array;
  /** A pasted terminal/app error the user asked about. */
  errorText?: string;
  /** A code snippet the user asked about. */
  codeText?: string;
}

function formatUptime(totalSecs: number): string {
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** Platform availability. No silent assumptions about Linux capabilities. */
export function getContextSourceStates(): ContextSourceState[] {
  const { settings } = useBlinkyStore.getState();
  return [
    {
      id: 'system-metrics',
      label: 'System metrics',
      allowed: settings.context.allowSystemMetrics,
      available: true,
      hint: 'CPU, RAM, battery, uptime from /proc and /sys.',
    },
    {
      id: 'notifications',
      label: 'Allowed notifications',
      allowed: settings.privacy.allowNotificationAI,
      available: true,
      hint: 'Only notifications you let Blinky read. Enable in Settings → AI.',
    },
    {
      id: 'active-window',
      label: 'Active window',
      allowed: false,
      available: false,
      hint: 'Unavailable on Wayland: no window-query API is wired up. Nothing is collected.',
    },
    {
      id: 'selected-text',
      label: 'Selected text',
      allowed: false,
      available: false,
      hint: 'Unavailable on Wayland: selection cannot be read in the background. Paste text instead.',
    },
    {
      id: 'clipboard',
      label: 'Clipboard',
      allowed: false,
      available: true,
      hint: 'Blinky does not read the clipboard; paste text manually into chat.',
    },
    {
      id: 'screenshot',
      label: 'Screenshot',
      allowed: settings.privacy.allowScreenCapture,
      available: true,
      hint: 'Only from the Analyze Screen capture button.',
    },
    {
      id: 'ocr',
      label: 'Local OCR',
      allowed: false,
      available: false,
      hint: 'Not installed. Run `sudo apt install tesseract-ocr` to enable text extraction.',
    },
  ];
}

/** Build the permitted context for one request. Minimum necessary only. */
export function buildContext(explicit: ExplicitAttachments = {}): BuiltContext {
  const { settings, systemContext, notifications } = useBlinkyStore.getState();
  const lines: string[] = [];
  const preview: ContextPreviewItem[] = [];

  if (settings.context.allowSystemMetrics && systemContext) {
    const ramPct = Math.round(
      (systemContext.ramUsedMb / Math.max(1, systemContext.ramTotalMb)) * 100
    );
    const summary =
      `CPU ${Math.round(systemContext.cpuUsage)}%, RAM ${ramPct}% ` +
      `(${Math.round(systemContext.ramUsedMb / 1024)}GB/${Math.round(systemContext.ramTotalMb / 1024)}GB), ` +
      `battery ${systemContext.batteryPercent != null ? `${systemContext.batteryPercent}%${systemContext.isCharging ? ' charging' : ''}` : 'on AC'}, ` +
      `uptime ${formatUptime(systemContext.uptimeSecs)}, desktop ${systemContext.desktopSession}`;
    lines.push(`Local system snapshot: ${summary}.`);
    preview.push({ source: 'system-metrics', label: 'System snapshot', detail: summary });
  }

  if (settings.privacy.allowNotificationAI && notifications.length > 0) {
    // Metadata only: app names + titles, max 5, truncated. Bodies stay local
    // unless the user pastes them explicitly.
    const items = notifications.slice(0, 5).map((n) => `${n.appName}: ${n.title}`.slice(0, 90));
    lines.push(`Recent notification headlines the user allowed: ${items.join(' | ')}.`);
    preview.push({
      source: 'notifications',
      label: `${Math.min(5, notifications.length)} notification headline(s)`,
      detail: items.join(' · '),
    });
  }

  if (explicit.clipboardText && explicit.clipboardText.trim()) {
    const text = explicit.clipboardText.slice(0, 4000);
    lines.push(`User-attached clipboard content:\n${text}`);
    preview.push({
      source: 'clipboard',
      label: 'Attached clipboard',
      detail: `${text.length} chars, attached by tap`,
    });
  }

  if (explicit.errorText && explicit.errorText.trim()) {
    const text = explicit.errorText.slice(0, 4000);
    lines.push(`User-pasted error to explain:\n${text}`);
    preview.push({ source: 'clipboard', label: 'Pasted error', detail: `${text.length} chars` });
  }

  if (explicit.codeText && explicit.codeText.trim()) {
    const text = explicit.codeText.slice(0, 6000);
    lines.push(`User-provided code to review:\n${text}`);
    preview.push({ source: 'clipboard', label: 'Provided code', detail: `${text.length} chars` });
  }

  if (explicit.screenshotBytes && explicit.screenshotBytes.length > 0) {
    preview.push({
      source: 'screenshot',
      label: 'Screen snapshot',
      detail: 'Attached from explicit capture, sent only on Analyze tap',
    });
  }

  return { systemExtra: lines.join('\n'), preview };
}

/** Read clipboard ONLY from an explicit user gesture. Never called on timers. */
export async function readClipboardOnGesture(): Promise<string> {
  try {
    if (!navigator.clipboard?.readText) {
      throw new Error('Clipboard reading is not available in this view. Paste the text manually instead.');
    }
    const text = await navigator.clipboard.readText();
    if (!text || !text.trim()) throw new Error('Clipboard is empty. Copy something first, then attach.');
    return text;
  } catch (err) {
    if (err instanceof Error) throw err;
    throw new Error('Could not read the clipboard. Paste the text manually instead.');
  }
}
