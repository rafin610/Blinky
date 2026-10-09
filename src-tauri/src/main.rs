// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, WebviewWindow};
use tokio_util::sync::CancellationToken;

static OPENAI_REQUESTS: OnceLock<Mutex<HashMap<String, CancellationToken>>> = OnceLock::new();

fn openai_requests() -> &'static Mutex<HashMap<String, CancellationToken>> {
    OPENAI_REQUESTS.get_or_init(|| Mutex::new(HashMap::new()))
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ScreenInfo {
    pub width: u32,
    pub height: u32,
    pub scale_factor: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SystemContext {
    pub cpu_usage: f32,
    pub ram_used_mb: u64,
    pub ram_total_mb: u64,
    pub battery_percent: Option<u8>,
    pub is_charging: bool,
    pub uptime_secs: u64,
    pub desktop_session: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SystemNotificationPayload {
    pub id: String,
    pub app_name: String,
    pub title: String,
    pub body: String,
    pub category: String,
    pub timestamp: u64,
}

// 1. Get Primary Screen Resolution & Scale
#[tauri::command]
fn get_screen_info(window: WebviewWindow) -> Result<ScreenInfo, String> {
    if let Ok(Some(monitor)) = window.current_monitor() {
        let size = monitor.size();
        let scale = monitor.scale_factor();
        Ok(ScreenInfo {
            width: size.width,
            height: size.height,
            scale_factor: scale,
        })
    } else {
        Ok(ScreenInfo {
            width: 1920,
            height: 1080,
            scale_factor: 1.0,
        })
    }
}

#[tauri::command]
fn get_desktop_window_info() -> serde_json::Value {
    let session_type = std::env::var("XDG_SESSION_TYPE").unwrap_or_else(|_| "unknown".to_string());
    let desktop = std::env::var("XDG_CURRENT_DESKTOP")
        .or_else(|_| std::env::var("DESKTOP_SESSION"))
        .unwrap_or_else(|_| "Linux desktop".to_string());
    let wayland = session_type.eq_ignore_ascii_case("wayland");
    serde_json::json!({
        "sessionType": session_type,
        "desktop": desktop,
        "note": if wayland {
            "Wayland compositor policy controls always-on-top and absolute placement. Native drag requests and saved-position restore may be restricted."
        } else {
            "X11 generally permits native dragging and programmatic placement; window-manager stacking policy still applies."
        }
    })
}

// 2. Linux System Context Monitoring (/proc, /sys)
#[tauri::command]
fn get_system_context() -> Result<SystemContext, String> {
    // Read CPU load avg from /proc/loadavg
    let mut cpu_usage = 0.0f32;
    if let Ok(loadavg) = fs::read_to_string("/proc/loadavg") {
        let parts: Vec<&str> = loadavg.split_whitespace().collect();
        if let Some(first) = parts.first() {
            if let Ok(val) = first.parse::<f32>() {
                cpu_usage = (val * 10.0).min(100.0);
            }
        }
    }

    // Read RAM from /proc/meminfo
    let mut ram_total_mb = 16384u64;
    let mut ram_available_mb = 8192u64;
    if let Ok(meminfo) = fs::read_to_string("/proc/meminfo") {
        for line in meminfo.lines() {
            if line.starts_with("MemTotal:") {
                if let Some(val) = line.split_whitespace().nth(1) {
                    if let Ok(kb) = val.parse::<u64>() {
                        ram_total_mb = kb / 1024;
                    }
                }
            } else if line.starts_with("MemAvailable:") {
                if let Some(val) = line.split_whitespace().nth(1) {
                    if let Ok(kb) = val.parse::<u64>() {
                        ram_available_mb = kb / 1024;
                    }
                }
            }
        }
    }
    let ram_used_mb = ram_total_mb.saturating_sub(ram_available_mb);

    // Read Uptime from /proc/uptime
    let mut uptime_secs = 0u64;
    if let Ok(uptime_str) = fs::read_to_string("/proc/uptime") {
        if let Some(first) = uptime_str.split_whitespace().next() {
            if let Ok(secs) = first.parse::<f64>() {
                uptime_secs = secs as u64;
            }
        }
    }

    // Read Battery from /sys/class/power_supply/BAT*
    let mut battery_percent: Option<u8> = None;
    let mut is_charging = false;
    if let Ok(entries) = fs::read_dir("/sys/class/power_supply") {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with("BAT") {
                let capacity_path = entry.path().join("capacity");
                let status_path = entry.path().join("status");
                if let Ok(cap_str) = fs::read_to_string(capacity_path) {
                    if let Ok(cap) = cap_str.trim().parse::<u8>() {
                        battery_percent = Some(cap);
                    }
                }
                if let Ok(stat_str) = fs::read_to_string(status_path) {
                    is_charging = stat_str.trim() == "Charging";
                }
                break;
            }
        }
    }

    // Desktop Environment Info
    let desktop_session = std::env::var("XDG_CURRENT_DESKTOP")
        .or_else(|_| std::env::var("DESKTOP_SESSION"))
        .unwrap_or_else(|_| "Linux".to_string());

    Ok(SystemContext {
        cpu_usage,
        ram_used_mb,
        ram_total_mb,
        battery_percent,
        is_charging,
        uptime_secs,
        desktop_session,
    })
}

// 3. Privacy-Enforced Screen Capture
//
// Wayland (the common case on modern Pop!_OS/COSMIC) forbids arbitrary
// pixel snooping, so the XDG Desktop Portal is used first: the compositor
// owns the permission prompt and the user sees exactly what is shared.
// On X11 the `screenshots` crate path is used. Capture only ever happens
// when the UI explicitly invokes this command (Analyze Screen button).
#[tauri::command]
fn capture_screen(opt_in: bool) -> Result<String, String> {
    if !opt_in {
        return Err("Screen capture is disabled by privacy settings. Please enable in Settings.".to_string());
    }

    let is_x11 = std::env::var("XDG_SESSION_TYPE")
        .map(|v| v.eq_ignore_ascii_case("x11"))
        .unwrap_or(false);

    if !is_x11 {
        return capture_via_portal();
    }

    capture_via_screenshots_crate()
}

fn png_bytes_to_data_url(png_bytes: &[u8]) -> String {
    use base64::Engine;
    let b64 = base64::engine::general_purpose::STANDARD.encode(png_bytes);
    format!("data:image/png;base64,{}", b64)
}

/// XDG Desktop Portal screenshot (Wayland-safe, permission-aware).
fn capture_via_portal() -> Result<String, String> {
    tauri::async_runtime::block_on(async {
        use ashpd::desktop::screenshot::Screenshot;
        let response = Screenshot::request()
            .modal(false)
            .interactive(false)
            .send()
            .await
            .map_err(|e| format!("Screen portal request failed: {}. The desktop may have denied access.", e))?;
        let uri = response
            .response()
            .map_err(|e| {
                let msg = e.to_string();
                if msg.contains("Cancelled") || msg.contains("cancelled") {
                    "Screen capture was dismissed.".to_string()
                } else {
                    format!("Screen portal was denied: {}", msg)
                }
            })?
            .uri()
            .clone();
        let path = uri
            .to_file_path()
            .map_err(|_| "Screen portal returned an unreadable file location.".to_string())?;
        let read_result = fs::read(&path);
        let _ = fs::remove_file(&path);
        let bytes = read_result
            .map_err(|e| format!("Could not read captured screenshot: {}", e))?;
        Ok(png_bytes_to_data_url(&bytes))
    })
}

/// Direct framebuffer capture (X11 sessions).
fn capture_via_screenshots_crate() -> Result<String, String> {
    // Capture primary display
    let screens = screenshots::Screen::all().map_err(|e| {
        format!(
            "Screen capture is unavailable here ({}). On Wayland this needs the desktop portal; on X11 check display access.",
            e
        )
    })?;
    let screen = screens.into_iter().next().ok_or("No screen found to capture")?;

    let image = screen.capture().map_err(|e| format!("Failed to capture screen: {}", e))?;

    // Encode to PNG bytes
    let mut png_bytes = Vec::new();
    let encoder = image::codecs::png::PngEncoder::new(&mut png_bytes);

    use image::ImageEncoder;
    encoder
        .write_image(
            image.as_raw(),
            image.width(),
            image.height(),
            image::ExtendedColorType::Rgba8,
        )
        .map_err(|e| format!("PNG encoding error: {}", e))?;

    Ok(png_bytes_to_data_url(&png_bytes))
}

// 4. Linux Autostart (~/.config/autostart/blinky.desktop)
fn autostart_desktop_path() -> Option<PathBuf> {
    dirs_next().map(|p| p.join(".config").join("autostart").join("blinky.desktop"))
}

fn dirs_next() -> Option<PathBuf> {
    std::env::var("HOME").ok().map(PathBuf::from)
}

#[tauri::command]
fn toggle_autostart(enable: bool) -> Result<bool, String> {
    if let Some(path) = autostart_desktop_path() {
        if enable {
            if let Some(parent) = path.parent() {
                let _ = fs::create_dir_all(parent);
            }
            let current_exe = std::env::current_exe()
                .unwrap_or_else(|_| PathBuf::from("/usr/bin/blinky"));
            let desktop_entry = format!(
                "[Desktop Entry]\nType=Application\nName=Blinky\nComment=Blinky Desktop Companion\nExec=\"{}\"\nTerminal=false\nCategories=Utility;\nX-GNOME-Autostart-enabled=true\n",
                current_exe.to_string_lossy()
            );
            fs::write(&path, desktop_entry).map_err(|e| e.to_string())?;
            Ok(true)
        } else {
            if path.exists() {
                let _ = fs::remove_file(path);
            }
            Ok(false)
        }
    } else {
        Err("Cannot resolve home directory".to_string())
    }
}

#[tauri::command]
fn is_autostart_enabled() -> bool {
    autostart_desktop_path().map(|p| p.exists()).unwrap_or(false)
}

// 5. Check Local Ollama Health
#[tauri::command]
async fn check_ollama(endpoint: Option<String>) -> Result<bool, String> {
    let url = endpoint.unwrap_or_else(|| "http://127.0.0.1:11434/api/tags".to_string());
    
    // Quick TCP connect check to 11434
    let parsed_url = url.replace("http://", "").replace("https://", "");
    let host_port = parsed_url.split('/').next().unwrap_or("127.0.0.1:11434");
    
    match tokio::net::TcpStream::connect(host_port).await {
        Ok(_) => Ok(true),
        Err(_) => Ok(false),
    }
}

// 7. OS keyring secrets (Secret Service on Linux).
// The OpenAI key lives here — never in settings files or logs.
#[tauri::command]
fn secret_available() -> bool {
    match keyring::Entry::new("com.blinky.companion", "probe") {
        Ok(entry) => match entry.get_password() {
            Ok(_) => true,
            Err(keyring::Error::NoEntry) => true, // backend works, just empty
            Err(_) => false,
        },
        Err(_) => false,
    }
}

#[tauri::command]
fn secret_set(service: String, account: String, secret: String) -> Result<(), String> {
    if service != "com.blinky.companion" || account != "openai-api-key" {
        return Err("Invalid credential slot.".to_string());
    }
    let entry =
        keyring::Entry::new(&service, &account).map_err(|e| format!("Keyring unavailable: {}", e))?;
    entry
        .set_password(&secret)
        .map_err(|e| format!("Could not store secret: {}", e))
}

#[tauri::command]
fn secret_has(service: String, account: String) -> Result<bool, String> {
    if service != "com.blinky.companion" || account != "openai-api-key" {
        return Err("Invalid credential slot.".to_string());
    }
    let entry =
        keyring::Entry::new(&service, &account).map_err(|e| format!("Keyring unavailable: {}", e))?;
    match entry.get_password() {
        Ok(_) => Ok(true),
        Err(keyring::Error::NoEntry) => Ok(false),
        Err(e) => Err(format!("Could not read secret: {}", e)),
    }
}

#[tauri::command]
fn secret_delete(service: String, account: String) -> Result<(), String> {
    if service != "com.blinky.companion" || account != "openai-api-key" {
        return Err("Invalid credential slot.".to_string());
    }
    let entry =
        keyring::Entry::new(&service, &account).map_err(|e| format!("Keyring unavailable: {}", e))?;
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(format!("Could not delete secret: {}", e)),
    }
}

fn openai_key() -> Result<String, String> {
    let entry = keyring::Entry::new("com.blinky.companion", "openai-api-key")
        .map_err(|_| "OS credential storage is unavailable.".to_string())?;
    entry
        .get_password()
        .map_err(|error| match error {
            keyring::Error::NoEntry => "No OpenAI API key is stored.".to_string(),
            _ => "Could not read the OpenAI API key from OS credential storage.".to_string(),
        })
}

#[tauri::command]
async fn openai_chat(
    request_id: String,
    model: String,
    messages: serde_json::Value,
    max_tokens: u32,
    temperature: Option<f32>,
) -> Result<String, String> {
    if model.trim().is_empty() {
        return Err("Choose an OpenAI model in Settings.".to_string());
    }
    let key = openai_key()?;
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(120))
        .build()
        .map_err(|_| "Could not create the cloud AI connection.".to_string())?;
    let mut body = serde_json::json!({
        "model": model,
        "messages": messages,
        "max_tokens": max_tokens,
    });
    if let Some(temperature) = temperature {
        body["temperature"] = serde_json::json!(temperature);
    }
    let cancellation = CancellationToken::new();
    {
        let mut requests = openai_requests()
            .lock()
            .map_err(|_| "Cloud request state is unavailable.".to_string())?;
        if requests.contains_key(&request_id) {
            return Err("Duplicate cloud request.".to_string());
        }
        requests.insert(request_id.clone(), cancellation.clone());
    }

    let request = async {
        let response = client
            .post("https://api.openai.com/v1/chat/completions")
            .bearer_auth(key)
            .json(&body)
            .send()
            .await
            .map_err(|_| "Cloud request failed. Check your connection.".to_string())?;
        if response.status() == reqwest::StatusCode::UNAUTHORIZED {
            return Err("OpenAI rejected the API key. Check it in Settings.".to_string());
        }
        if !response.status().is_success() {
            return Err(format!("OpenAI answered with status {}.", response.status().as_u16()));
        }
        let data: serde_json::Value = response
            .json()
            .await
            .map_err(|_| "OpenAI returned an unreadable response.".to_string())?;
        data["choices"][0]["message"]["content"]
            .as_str()
            .filter(|reply| !reply.trim().is_empty())
            .map(str::to_string)
            .ok_or_else(|| "OpenAI returned an empty response.".to_string())
    };
    let result = tokio::select! {
        _ = cancellation.cancelled() => Err("Request cancelled.".to_string()),
        response = request => response,
    };
    if let Ok(mut requests) = openai_requests().lock() {
        requests.remove(&request_id);
    }
    result
}

#[tauri::command]
fn openai_cancel(request_id: String) {
    if let Ok(requests) = openai_requests().lock() {
        if let Some(token) = requests.get(&request_id) {
            token.cancel();
        }
    }
}

#[tauri::command]
async fn openai_check_connection() -> serde_json::Value {
    let key = match openai_key() {
        Ok(key) => key,
        Err(message) => {
            return serde_json::json!({ "reachable": false, "models": [], "detail": message });
        }
    };
    let client = match reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
    {
        Ok(client) => client,
        Err(_) => {
            return serde_json::json!({
                "reachable": false,
                "models": [],
                "detail": "Could not create the cloud AI connection."
            });
        }
    };
    match client
        .get("https://api.openai.com/v1/models")
        .bearer_auth(key)
        .send()
        .await
    {
        Ok(response) if response.status().is_success() => {
            serde_json::json!({ "reachable": true, "models": [], "detail": "Cloud key looks valid." })
        }
        Ok(response) if response.status() == reqwest::StatusCode::UNAUTHORIZED => {
            serde_json::json!({ "reachable": false, "models": [], "detail": "API key was rejected (401)." })
        }
        Ok(response) => serde_json::json!({
            "reachable": false,
            "models": [],
            "detail": format!("OpenAI answered with status {}.", response.status().as_u16())
        }),
        Err(_) => serde_json::json!({
            "reachable": false,
            "models": [],
            "detail": "Could not reach api.openai.com."
        }),
    }
}

// 8. Local OCR probe. No OCR engine is bundled; when tesseract exists
// the UI can offer text extraction, otherwise it shows a setup hint.
#[tauri::command]
fn check_ocr() -> Result<serde_json::Value, String> {
    let available = std::process::Command::new("tesseract")
        .arg("--version")
        .output()
        .map(|out| out.status.success())
        .unwrap_or(false);
    Ok(serde_json::json!({
        "available": available,
        "hint": "sudo apt install tesseract-ocr",
    }))
}

// 9. Test Notification Simulation
#[tauri::command]
fn emit_simulated_notification(
    app: AppHandle,
    app_name: String,
    title: String,
    body: String,
    category: String,
) -> Result<(), String> {
    let payload = SystemNotificationPayload {
        id: format!("notif-{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis()),
        app_name,
        title,
        body,
        category,
        timestamp: std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs(),
    };
    app.emit("system-notification", payload).map_err(|e| e.to_string())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            get_screen_info,
            get_desktop_window_info,
            get_system_context,
            capture_screen,
            toggle_autostart,
            is_autostart_enabled,
            check_ollama,
            secret_available,
            secret_set,
            secret_has,
            secret_delete,
            openai_chat,
            openai_cancel,
            openai_check_connection,
            check_ocr,
            emit_simulated_notification
        ])
        .setup(|app| {
            if let Some(main_window) = app.get_webview_window("main") {
                // Ensure the transparent window is presented smoothly
                let _ = main_window.show();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Blinky companion");
}
