import { create } from 'zustand';
import {
  BlinkyAnimationName,
  BlinkyMood,
  NotificationItem,
  ChatMessage,
  SystemContextData,
  AppSettings,
  PanelView,
} from '../types';
import { playCuteNotificationSound } from '../services/notificationSound';

interface BlinkyStore {
  // Character state
  currentAnimation: BlinkyAnimationName;
  mood: BlinkyMood;
  isPanelOpen: boolean;
  activeTab: PanelView;
  isThinking: boolean;
  isListening: boolean;
  activeNotificationBubble: NotificationItem | null;

  // Data
  notifications: NotificationItem[];
  chatMessages: ChatMessage[];
  systemContext: SystemContextData;
  settings: AppSettings;

  // Actions
  playAnimation: (anim: BlinkyAnimationName) => void;
  setMood: (mood: BlinkyMood) => void;
  togglePanel: (open?: boolean) => void;
  setActiveTab: (tab: PanelView) => void;
  goHome: () => void;
  setThinking: (val: boolean) => void;
  setListening: (val: boolean) => void;

  // Notification actions
  addNotification: (notif: Omit<NotificationItem, 'id' | 'timestamp' | 'read'>) => void;
  dismissNotification: (id: string) => void;
  clearAllNotifications: () => void;
  removeNotificationsForApp: (appName: string) => void;
  dismissActiveBubble: () => void;

  // Chat actions
  addChatMessage: (msg: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  updateLastChatMessage: (text: string) => void;
  clearChatHistory: () => void;
  clearLocalData: () => void;

  // Settings & System
  updateSettings: (newSettings: Partial<AppSettings>) => void;
  setSystemContext: (ctx: Partial<SystemContextData>) => void;
}

export const DEFAULT_SETTINGS: AppSettings = {
  privacyConsentVersion: 1,
  aiProvider: 'ollama',
  ollamaEndpoint: 'http://localhost:11434',
  ollamaModel: 'qwen3:8b',
  ollamaTemperature: 0.6,
  ollamaNumCtx: 8192,
  aiStreaming: true,
  openaiEnabled: false,
  openaiModel: 'gpt-4o-mini',
  context: {
    allowSystemMetrics: false,
  },
  privacy: {
    allowScreenCapture: false,
    allowCloudAI: false,
    allowNotificationAI: false,
    allowNotificationMonitoring: false,
    allowMicrophone: false,
    storeHistory: true
  },
  globalHotkey: 'Ctrl+Space',
  autostart: false,
  alwaysOnTop: true,
  monitoredApps: [],
  soundEffects: true,
  notificationVolume: 0.35,
  wakeOnNotification: true,
  siliconeColor: '#C4E5FC',
  roughness: 0.48,
  enableLookAt: true,
  enableAutoBlink: true,
  position: 'bottom-right',
  scale: 1,
  animationIntensity: 0.7,
  idleBehavior: 'float',
  notificationDuration: 6,
  notificationHistory: true,
  reducedMotion: false,
  disableSounds: false,
  highContrast: false,
};

// Load saved settings from localStorage
function loadSavedSettings(): AppSettings {
  try {
    const raw = localStorage.getItem('blinky_settings');
    if (raw) {
      const parsed = JSON.parse(raw);
      const { openaiApiKey: _legacyApiKey, ...savedSettings } = parsed;
      const needsPrivacyMigration = savedSettings.privacyConsentVersion !== 1;
      return {
        ...DEFAULT_SETTINGS,
        ...savedSettings,
        privacy: {
          ...DEFAULT_SETTINGS.privacy,
          ...(savedSettings.privacy || {}),
          ...(needsPrivacyMigration ? { allowNotificationMonitoring: false, allowMicrophone: false } : {}),
        },
        context: {
          ...DEFAULT_SETTINGS.context,
          ...(savedSettings.context || {}),
          ...(needsPrivacyMigration ? { allowSystemMetrics: false } : {}),
        },
        privacyConsentVersion: 1,
      };
    }
  } catch (e) {
    console.error('Failed to load saved settings.');
  }
  return DEFAULT_SETTINGS;
}

export const useBlinkyStore = create<BlinkyStore>((set, get) => ({
  currentAnimation: 'idle',
  mood: 'calm',
  isPanelOpen: false,
  activeTab: 'home',
  isThinking: false,
  isListening: false,
  activeNotificationBubble: null,

  notifications: [],

  chatMessages: [
    {
      id: 'welcome',
      sender: 'blinky',
      text: "Hi! I'm Blinky, your Linux desktop companion. Click me anytime, or ask me questions!",
      timestamp: Date.now()
    }
  ],

  systemContext: {
    cpuUsage: 12.5,
    ramUsedMb: 4096,
    ramTotalMb: 16384,
    batteryPercent: 88,
    isCharging: false,
    uptimeSecs: 7200,
    desktopSession: 'Pop!_OS (GNOME)'
  },

  settings: loadSavedSettings(),

  playAnimation: (anim) => {
    set({ currentAnimation: anim });
  },

  setMood: (mood) => {
    set({ mood });
    const animMap: Record<BlinkyMood, BlinkyAnimationName> = {
      calm: 'idle',
      happy: 'happy',
      thinking: 'thinking',
      sleepy: 'sleep',
      alert: 'notification',
      sad: 'error_sad'
    };
    set({ currentAnimation: animMap[mood] || 'idle' });
  },

  togglePanel: (open) => {
    set((state) => {
      const nextOpen = open !== undefined ? open : !state.isPanelOpen;
      // Opening the widget always lands on home for a calm re-entry,
      // and swallows any floating bubble (the list keeps the unread item).
      if (nextOpen && !state.isPanelOpen) {
        return { isPanelOpen: nextOpen, activeTab: 'home' as PanelView, activeNotificationBubble: null };
      }
      return { isPanelOpen: nextOpen };
    });
  },

  setActiveTab: (tab) => {
    set({ activeTab: tab, isPanelOpen: true, activeNotificationBubble: null });
  },

  goHome: () => {
    set({ activeTab: 'home', isPanelOpen: true, activeNotificationBubble: null });
  },

  setThinking: (val) => {
    set({
      isThinking: val,
      currentAnimation: val ? 'thinking' : 'idle'
    });
  },

  setListening: (val) => {
    set({
      isListening: val,
      currentAnimation: val ? 'notification' : 'idle'
    });
  },

  addNotification: (notif) => {
    const { settings } = get();

    // Check filter rules
    if (notif.category === 'ignored') return;
    const duplicate = get().notifications.some((item) =>
      item.appName.toLowerCase() === notif.appName.toLowerCase() &&
      item.title === notif.title &&
      item.body === notif.body &&
      Date.now() - item.timestamp < 4000
    );
    if (duplicate) return;

    const newNotif: NotificationItem = {
      ...notif,
      id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
      read: false
    };

    set((state) => ({
      notifications: [newNotif, ...state.notifications],
      // No floating bubble while the panel is open — the list + badge
      // already show it. Bubbles are for the quiet idle moment.
      activeNotificationBubble: state.isPanelOpen ? state.activeNotificationBubble : newNotif,
    }));

    // Trigger reaction if enabled
    if (settings.wakeOnNotification) {
      set({ currentAnimation: 'excited' });
    }
    if (settings.soundEffects && !settings.disableSounds) {
      void playCuteNotificationSound(settings.notificationVolume);
    }
  },

  dismissNotification: (id) => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
      activeNotificationBubble:
        state.activeNotificationBubble?.id === id ? null : state.activeNotificationBubble
    }));
  },

  clearAllNotifications: () => {
    set({ notifications: [], activeNotificationBubble: null });
  },

  removeNotificationsForApp: (appName) => {
    set((state) => ({
      notifications: state.notifications.filter((item) => item.appName.toLowerCase() !== appName.toLowerCase()),
      activeNotificationBubble:
        state.activeNotificationBubble?.appName.toLowerCase() === appName.toLowerCase()
          ? null
          : state.activeNotificationBubble,
    }));
  },

  dismissActiveBubble: () => {
    set({ activeNotificationBubble: null });
  },

  addChatMessage: (msg) => {
    const newMsg: ChatMessage = {
      ...msg,
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now()
    };
    set((state) => ({
      chatMessages: [...state.chatMessages, newMsg]
    }));
  },

  updateLastChatMessage: (text) => {
    set((state) => {
      const msgs = [...state.chatMessages];
      if (msgs.length > 0) {
        msgs[msgs.length - 1] = {
          ...msgs[msgs.length - 1],
          text
        };
      }
      return { chatMessages: msgs };
    });
  },

  clearChatHistory: () => {
    set({ chatMessages: [] });
  },

  clearLocalData: () => {
    let storageFailed = false;
    try {
      localStorage.removeItem('blinky_settings');
    } catch {
      storageFailed = true;
    }
    set({
      notifications: [],
      chatMessages: [],
      activeNotificationBubble: null,
      settings: {
        ...DEFAULT_SETTINGS,
        context: { ...DEFAULT_SETTINGS.context },
        privacy: { ...DEFAULT_SETTINGS.privacy },
        monitoredApps: [...DEFAULT_SETTINGS.monitoredApps],
      },
    });
    if (storageFailed) throw new Error('Could not remove saved settings.');
  },

  updateSettings: (newSettings) => {
    set((state) => {
      const updated = { ...state.settings, ...newSettings };
      try {
        localStorage.setItem('blinky_settings', JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to save settings.');
      }
      return { settings: updated };
    });
  },

  setSystemContext: (ctx) => {
    set((state) => ({
      systemContext: { ...state.systemContext, ...ctx }
    }));
  }
}));
