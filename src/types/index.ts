export type BlinkyAnimationName =
  | 'idle'
  | 'blink'
  | 'breathing'
  | 'floating'
  | 'happy'
  | 'notification'
  | 'click'
  | 'thinking'
  | 'sleep'
  | 'error_sad'
  | 'wave'
  | 'excited';

export type BlinkyMood = 'calm' | 'happy' | 'thinking' | 'sleepy' | 'alert' | 'sad';

export type NotificationCategory = 'important' | 'normal' | 'low' | 'ignored';

export type PanelView = 'home' | 'ask' | 'notifications' | 'analyze' | 'actions' | 'settings';

export interface NotificationItem {
  id: string;
  appName: string;
  title: string;
  body: string;
  category: NotificationCategory;
  timestamp: number;
  read: boolean;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'blinky';
  text: string;
  timestamp: number;
  screenSnapshot?: string;
  isStreaming?: boolean;
}

export interface SystemContextData {
  cpuUsage: number;
  ramUsedMb: number;
  ramTotalMb: number;
  batteryPercent: number | null;
  isCharging: boolean;
  uptimeSecs: number;
  desktopSession: string;
}

export type WidgetPosition =
  | 'bottom-right'
  | 'bottom-left'
  | 'top-right'
  | 'top-left';

export type IdleBehavior = 'float' | 'breathe' | 'still';

export interface AppSettings {
  /** Versioned privacy defaults; used to migrate older settings safely. */
  privacyConsentVersion: number;
  aiProvider: 'ollama' | 'openai';
  ollamaEndpoint: string;
  ollamaModel: string;
  /** Local sampling temperature for Ollama. */
  ollamaTemperature: number;
  /** Context window for Ollama (num_ctx). */
  ollamaNumCtx: number;
  /** Stream tokens into chat as they arrive. */
  aiStreaming: boolean;
  /** Cloud brain master switch. Off by default; Ollama works without it. */
  openaiEnabled: boolean;
  openaiModel: string;
  context: {
    /** Attach local system snapshot to AI requests. */
    allowSystemMetrics: boolean;
  };
  privacy: {
    allowScreenCapture: boolean;
    allowCloudAI: boolean;
    allowNotificationAI: boolean;
    allowNotificationMonitoring: boolean;
    allowMicrophone: boolean;
    storeHistory: boolean;
  };
  monitoredApps: string[];
  globalHotkey: string;
  autostart: boolean;
  alwaysOnTop: boolean;
  soundEffects: boolean;
  notificationVolume: number;
  wakeOnNotification: boolean;
  siliconeColor: string;
  roughness: number;
  enableLookAt: boolean;
  enableAutoBlink: boolean;
  // --- Premium companion additions (all optional-safe with defaults) ---
  position: WidgetPosition;
  scale: number; // 0.85 - 1.2
  animationIntensity: number; // 0 - 1
  idleBehavior: IdleBehavior;
  notificationDuration: number; // seconds, 3 - 15
  notificationHistory: boolean;
  reducedMotion: boolean;
  disableSounds: boolean;
  highContrast: boolean;
}
