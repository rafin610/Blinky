# Blinky — Linux Desktop Companion

![Platform](https://img.shields.io/badge/Platform-Linux%20%7C%20Pop!__OS%20%7C%20Ubuntu-orange)
![Tech Stack](https://img.shields.io/badge/Stack-Tauri%202%20%7C%20React%20%7C%20TypeScript%20%7C%20Three.js%20%7C%20Rust-blue)
![Architecture](https://img.shields.io/badge/3D%20Format-glTF%202.0%20(292%20KB)-green)
![Privacy](https://img.shields.io/badge/Privacy-Local--First%20%7C%20Opt--In%20Only-emerald)

**Blinky** is an intelligent, living 3D desktop companion application designed specifically for Linux desktop environments (Pop!_OS, Ubuntu, Debian, GNOME, X11 & Wayland). Blinky lives in a corner of your desktop as a transparent, borderless companion, with sensitive capabilities disabled until you opt in.

---

## 🌟 Primary Features

### 1. 🛸 Living Desktop Widget
- **Borderless & Transparent**: Operates as a transparent window floating directly over your Linux desktop without traditional application borders or frames.
- **Always-on-Top & Position Memory**: Stays unobtrusively in your preferred screen corner (defaults to bottom-right) and supports drag-and-drop repositioning.
- **Taskbar-Free & Lightweight**: Configured with `skipTaskbar: true` to prevent cluttering your GNOME/Pop!_OS dock.
- **Linux Autostart**: One-click startup configuration on system login (`~/.config/autostart/blinky.desktop`).

### 2. 🤖 High-Fidelity 3D Character Engine
- **Visual Match to Reference**: Smooth dome top, gentle pear-like waist flare, stubby flipper arms, dark charcoal oval eyes (`#222933`), sweet smile, and signature **double-lobe bottom cleft contour**.
- **All 12 Baked Animations**:
  1. `idle` (Organic breathing & autonomous natural blinking)
  2. `blink` (Snappy eye blink)
  3. `breathing` (Mindful deep chest expansion)
  4. `floating` (Weightless zero-gravity hover & drifting fins)
  5. `happy` (Joyful hop, flapping arms, smiling eyes & rosy cheek blush)
  6. `notification` (Alert double-pulse perk up & curious head tilt)
  7. `click` (Tactile spring squash physics & wobble rebound)
  8. `thinking` (Thoughtful head tilt, arm to chin, slow sway)
  9. `sleep` (Cozy slumber resting on bottom lobes)
  10. `error_sad` (Melancholic droop, sad frown, despondent tremor)
  11. `wave` (Warm greeting, right arm waving 3x)
  12. `excited` (High-energy happy dance & wiggle)
- **Interactive Cursor Look-At**: Blinky's head and eyes softly follow your mouse around the screen.
- **Tactile Squish Physics**: Clicking on Blinky triggers realistic spring-damping squash and stretch.

### 3. 💬 Compact Floating Interaction Panel
Clicking Blinky opens a floating glassmorphic panel containing:
- **Ask Blinky**: Real-time conversation with local Ollama (`llama3.2`) or optional OpenAI (`gpt-4o-mini`), speech-to-text voice recognition, and companion emotional synchronization.
- **Notifications**: Filtered notification feed categorized into *Important*, *Normal*, and *Low priority*, with app filter rules and dismiss actions.
- **Analyze Screen**: Privacy-gated screen capture with AI vision analysis ("Summarize workspace", "Find code errors", "Suggest next step").
- **Quick Actions**: Linux system context (CPU load, RAM usage, battery, uptime; collection is off until enabled) and companion emotional presets.
- **Settings**: AI provider selection, Ollama health check, privacy controls, Linux autostart toggle, and character appearance customizers.

### 4. 🔒 Privacy & Least Privilege
- **Local-first AI**: Ollama is the default and works independently; cloud AI requires both the Cloud brain and Allow cloud switches.
- **Screen capture**: Disabled until enabled in Settings and captured only after pressing Capture. Wayland uses the desktop screenshot portal without a direct-capture fallback.
- **Microphone**: Disabled until enabled in Settings, starts only after tapping the mic, displays a visible listening indicator, and leaves the transcript for review before sending.
- **Notifications**: Monitoring is off by default. When enabled, only individually allowlisted apps are observed. Sending notification headlines to AI is a separate opt-in.
- **Notification integration limitation**: Blinky accepts app notification events forwarded to its Tauri event listener; this build does not intercept the COSMIC notification center or other apps' system notifications. The in-app Preview action tests its notification UI, sound and animation without claiming system-wide monitoring.
- **Credentials**: OpenAI keys are stored in the OS keyring and cloud requests run in Rust; the key is never returned to frontend JavaScript or saved in browser storage.
- **Local data**: Chat and notification data stay in memory for the session. Settings provides Clear local data to remove saved preferences and the stored AI key.
- **No sensitive logs**: Notification bodies, screenshots, microphone audio and API keys are not logged.

### 5. ⌨️ Global Hotkey
- Configurable global shortcut (default: `Ctrl + Space`).
- Opens the interaction panel; it never enables voice input by itself.

---

## 🏗️ Architecture Overview

```
Blinky
│
├── Desktop Widget (Transparent, borderless, always-on-top, draggable)
│
├── 3D Character Engine (Three.js, 12 animations, rigged bones, morphs, squish physics)
│
├── Notification Manager (Category filters, toast bubble, app rules, reaction triggers)
│
├── Interaction Manager (Ask Blinky, Notifications, Analyze Screen, Quick Actions, Settings)
│
├── Global Hotkey Manager (Native Linux hotkey listener)
│
├── System Context Manager (Linux /proc/loadavg, /proc/meminfo, battery, uptime)
│
├── Screen Capture Manager (X11 / Wayland screenshots with privacy gate)
│
├── AI Engine (Local Ollama integration + Optional OpenAI API)
│
├── Voice System (Speech-to-text & companion speech synthesis)
│
├── Settings & Local Storage (Preferences, privacy toggles, widget placement)
│
└── Rust Native Backend (Tauri 2 backend, WebKitGTK, D-Bus, image encoding)
```

---

## 🚀 Running Blinky Locally

### Prerequisites
- Node.js 20+ and npm
- Rust & Cargo (`rustc 1.70+`)
- Linux packages: `libwebkit2gtk-4.1-dev`, `build-essential`, `curl`, `wget`, `file`, `libx11-dev`, `libssl-dev`

### 1. Install Dependencies
```bash
npm install
```

### 2. Run in Development Mode
The default development command launches the native Tauri desktop window (it does not open Chrome):
```bash
npm run dev
```

For a browser-only preview, use this separate command:
```bash
npm run web:dev
```
Then open `http://localhost:5173`.

The native character window starts compact. Click Blinky to open the existing panel; drag the character to move the actual native window. Position restore and always-on-top depend on compositor policy. In Wayland/COSMIC, absolute positioning and stacking may be denied even though the window remains transparent and native dragging may work. The Settings screen reports the current session limitation.

### 3. Build Native Linux Binary
To compile the standalone release binary:
```bash
cargo build --release --manifest-path src-tauri/Cargo.toml
```
The compiled binary will be located at:
`src-tauri/target/release/blinky`

---

## ⚙️ AI Configuration

Blinky talks to AI through a provider layer (`src/services/ai/`): UI → AI Manager → Ollama (default, local) or OpenAI (optional cloud). The UI never calls a provider directly.

### Local-first Ollama (default, verified)
- Blinky auto-discovers installed models via `GET /api/tags` and selects your Qwen model (`qwen3:8b`) by its exact installed name. Nothing is ever downloaded automatically.
- Requests set `think: false` (qwen3 "thinking" is slow on CPU) and stream tokens live, with a Stop button.
- Works fully offline once Ollama + model are present. Test: `npm run test:ai` (provider) and `npm run test:ai:manager` (manager, gates, vision gate).
- `qwen3:8b` is **text-only** (capabilities: completion, tools, thinking — no vision). Analyze Screen verifies vision support first and refuses to send images to a text-only model. Local OCR needs `sudo apt install tesseract-ocr` (not installed = honestly reported, never assumed).

### Settings → AI
Host URL, installed-model picker + refresh, temperature, context size (`num_ctx`), streaming toggle, Test connection, OpenAI enable + key (OS keyring via Secret Service; cloud keys cannot be saved outside the desktop app), context-source states (active window / selected text unavailable on Wayland — shown as such).

### Using OpenAI (Optional & Opt-In)
1. Open Blinky Settings → AI → **Brain: Cloud**, enable **Cloud brain**.
2. Save the API key (goes to the OS keyring, never to browser storage/settings files/git) and enable **Allow cloud**.
3. Image sends to the cloud always need explicit consent; Ollama never auto-falls-back to OpenAI.
# Blinky
