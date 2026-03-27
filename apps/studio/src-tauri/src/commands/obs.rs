use serde::Serialize;
use std::net::TcpStream;
use std::process::Command;
use std::time::Duration;

#[derive(Serialize)]
pub struct ObsStatus {
    pub installed: bool,
    pub path: Option<String>,
}

#[derive(Serialize)]
pub struct EnsureObsResult {
    pub success: bool,
    pub websocket_open: bool,
    pub obs_path: Option<String>,
    pub message: String,
}

fn is_websocket_open() -> bool {
    TcpStream::connect_timeout(
        &"127.0.0.1:4455".parse().unwrap(),
        Duration::from_secs(2),
    )
    .is_ok()
}

fn is_obs_running() -> bool {
    #[cfg(target_os = "linux")]
    {
        Command::new("pgrep").arg("-x").arg("obs").output()
            .map_or(false, |o| o.status.success())
    }
    #[cfg(target_os = "windows")]
    {
        Command::new("tasklist").args(["/FI", "IMAGENAME eq obs64.exe"])
            .output()
            .map_or(false, |o| String::from_utf8_lossy(&o.stdout).contains("obs64.exe"))
    }
    #[cfg(target_os = "macos")]
    {
        Command::new("pgrep").arg("-x").arg("obs").output()
            .map_or(false, |o| o.status.success())
    }
}

/// Single command that ensures OBS is running with WebSocket enabled.
/// Handles: detect → test WS → fix config → launch → wait → verify.
#[tauri::command]
pub fn ensure_obs_ready() -> EnsureObsResult {
    eprintln!("[ensure_obs_ready] Starting...");

    // 1. Check if OBS is installed
    let obs_path = match find_obs_path() {
        Some(p) => p,
        None => return EnsureObsResult {
            success: false, websocket_open: false, obs_path: None,
            message: "OBS Studio not found. Install it from obsproject.com".to_string(),
        },
    };

    eprintln!("[ensure_obs_ready] OBS found at: {}", obs_path);

    // 2. If OBS is already running with WebSocket open — done
    let running = is_obs_running();
    let ws_open = is_websocket_open();
    eprintln!("[ensure_obs_ready] Running: {}, WS open: {}", running, ws_open);

    if running && ws_open {
        return EnsureObsResult {
            success: true, websocket_open: true, obs_path: Some(obs_path),
            message: "OBS connected".to_string(),
        };
    }

    // 3. Fix WebSocket config
    eprintln!("[ensure_obs_ready] Fixing config...");
    enable_websocket_in_config();

    // 4. If OBS is running but WS closed, restart it
    if is_obs_running() {
        kill_existing_obs();
        std::thread::sleep(Duration::from_millis(1000));
    }

    // 5. Launch OBS
    eprintln!("[ensure_obs_ready] Launching OBS from: {}", obs_path);
    let launch_result = launch_obs_internal(&obs_path);
    if let Err(e) = launch_result {
        return EnsureObsResult {
            success: false, websocket_open: false, obs_path: Some(obs_path),
            message: format!("Failed to launch OBS: {}", e),
        };
    }

    // 6. Wait for WebSocket (up to 15 seconds)
    for _ in 0..15 {
        std::thread::sleep(Duration::from_secs(1));
        if is_websocket_open() {
            return EnsureObsResult {
                success: true, websocket_open: true, obs_path: Some(obs_path),
                message: "OBS ready".to_string(),
            };
        }
    }

    EnsureObsResult {
        success: false, websocket_open: false, obs_path: Some(obs_path),
        message: "OBS launched but WebSocket did not start. Check OBS WebSocket settings.".to_string(),
    }
}

fn launch_obs_internal(path: &str) -> Result<(), String> {
    #[cfg(target_os = "linux")]
    {
        let display = std::env::var("DISPLAY").unwrap_or_else(|_| ":0".to_string());

        Command::new(path)
            .env("DISPLAY", &display)
            .env("XDG_SESSION_TYPE", "x11")
            .env("QT_QPA_PLATFORM", "xcb")
            .args(["--minimize-to-tray", "--websocket_port", "4455"])
            .spawn()
            .map_err(|e| e.to_string())?;

        std::thread::spawn(|| {
            std::thread::sleep(Duration::from_secs(3));
            let _ = Command::new("xdotool")
                .args(["search", "--name", "OBS", "windowminimize", "--sync"])
                .output();
        });
    }
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg("-a").arg(path)
            .args(["--args", "--minimize-to-tray", "--websocket_port", "4455"])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "windows")]
    {
        Command::new(path)
            .args(["--minimize-to-tray", "--disable-updater", "--websocket_port", "4455"])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn detect_obs() -> ObsStatus {
    if let Some(path) = find_obs_path() {
        ObsStatus {
            installed: true,
            path: Some(path),
        }
    } else {
        ObsStatus {
            installed: false,
            path: None,
        }
    }
}

#[tauri::command]
pub fn launch_obs(path: String) -> Result<(), String> {
    // Kill any existing OBS first so we can relaunch with WebSocket enabled
    kill_existing_obs();
    // Enable WebSocket in OBS config
    enable_websocket_in_config();

    // Small delay for process cleanup
    std::thread::sleep(std::time::Duration::from_millis(500));

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg("-a")
            .arg(&path)
            .args(["--args", "--minimize-to-tray", "--websocket_port", "4455"])
            .spawn()
            .map_err(|e| format!("Failed to launch OBS: {}", e))?;
    }

    #[cfg(target_os = "windows")]
    {
        Command::new(&path)
            .args(["--minimize-to-tray", "--disable-updater", "--websocket_port", "4455"])
            .spawn()
            .map_err(|e| format!("Failed to launch OBS: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        let display = std::env::var("DISPLAY").unwrap_or_else(|_| ":0".to_string());

        Command::new(&path)
            .env("DISPLAY", &display)
            .env("XDG_SESSION_TYPE", "x11")
            .env("QT_QPA_PLATFORM", "xcb")
            .args(["--minimize-to-tray", "--websocket_port", "4455"])
            .spawn()
            .map_err(|e| format!("Failed to launch OBS: {}", e))?;

        // Hide OBS windows + portal dialogs as fast as possible
        std::thread::spawn(|| {
            for round in 0..40 {
                std::thread::sleep(Duration::from_millis(150));

                // Hide OBS main window
                if let Ok(out) = Command::new("xdotool").args(["search", "--name", "OBS"]).output() {
                    for wid in String::from_utf8_lossy(&out.stdout).lines() {
                        let wid = wid.trim();
                        if !wid.is_empty() {
                            let _ = Command::new("xdotool").args(["windowunmap", wid]).output();
                        }
                    }
                }

                // Hide PipeWire/Portal screen share dialog
                for name in &["sharing your screen", "Share your screen", "Screencast", "pipewire", "Arquivos em falta", "Missing Files", "missing file"] {
                    if let Ok(out) = Command::new("xdotool").args(["search", "--name", name]).output() {
                        for wid in String::from_utf8_lossy(&out.stdout).lines() {
                            let wid = wid.trim();
                            if !wid.is_empty() {
                                let _ = Command::new("xdotool").args(["windowunmap", wid]).output();
                            }
                        }
                    }
                }

                // After 15 rounds, slow down
                if round > 15 {
                    std::thread::sleep(Duration::from_millis(500));
                }
            }
        });
    }

    Ok(())
}

/// Ensure OBS WebSocket is enabled in the system OBS config.
fn enable_websocket_in_config() {
    let config_path = {
        #[cfg(target_os = "linux")]
        {
            dirs_next_config().map(|d| d.join("obs-studio").join("global.ini"))
        }
        #[cfg(target_os = "windows")]
        {
            std::env::var("APPDATA").ok().map(|d| {
                std::path::PathBuf::from(d)
                    .join("obs-studio")
                    .join("global.ini")
            })
        }
        #[cfg(target_os = "macos")]
        {
            std::env::var("HOME").ok().map(|h| {
                std::path::PathBuf::from(h)
                    .join("Library")
                    .join("Application Support")
                    .join("obs-studio")
                    .join("global.ini")
            })
        }
    };

    if let Some(path) = config_path {
        if path.exists() {
            let content = std::fs::read_to_string(&path).unwrap_or_default();
            if content.contains("[OBSWebSocket]") {
                // Replace existing section
                let mut new_content = String::new();
                let mut in_ws_section = false;
                let mut ws_written = false;
                for line in content.lines() {
                    if line.trim() == "[OBSWebSocket]" {
                        in_ws_section = true;
                        new_content.push_str("[OBSWebSocket]\n");
                        new_content.push_str("FirstLoad=false\n");
                        new_content.push_str("ServerEnabled=true\n");
                        new_content.push_str("ServerPort=4455\n");
                        new_content.push_str("AlertsEnabled=false\n");
                        new_content.push_str("AuthRequired=false\n");
                        new_content.push_str("ServerPassword=\n");
                        ws_written = true;
                        continue;
                    }
                    if in_ws_section {
                        if line.starts_with('[') {
                            in_ws_section = false;
                            new_content.push_str(line);
                            new_content.push('\n');
                        }
                        // Skip old WS settings
                        continue;
                    }
                    // Ensure FirstRun=false so OBS doesn't block on setup wizard
                    if line == "FirstRun=true" {
                        new_content.push_str("FirstRun=false\n");
                    } else {
                        new_content.push_str(line);
                        new_content.push('\n');
                    }
                }
                if ws_written {
                    let _ = std::fs::write(&path, new_content);
                }
            } else {
                // Append WS section + ensure FirstRun=false
                let content = content.replace("FirstRun=true", "FirstRun=false");
                let mut content = content;
                content.push_str("\n[OBSWebSocket]\nServerEnabled=true\nServerPort=4455\nAuthRequired=false\nServerPassword=\n");
                let _ = std::fs::write(&path, content);
            }
        } else {
            // Create minimal config
            if let Some(parent) = path.parent() {
                let _ = std::fs::create_dir_all(parent);
            }
            let _ = std::fs::write(
                &path,
                "[General]\nLanguage=en-US\n\n[OBSWebSocket]\nServerEnabled=true\nServerPort=4455\nAuthRequired=false\nServerPassword=\n",
            );
        }
    }
}

#[cfg(target_os = "linux")]
fn dirs_next_config() -> Option<std::path::PathBuf> {
    std::env::var("XDG_CONFIG_HOME")
        .ok()
        .map(std::path::PathBuf::from)
        .or_else(|| {
            std::env::var("HOME")
                .ok()
                .map(|h| std::path::PathBuf::from(h).join(".config"))
        })
}

fn kill_existing_obs() {
    #[cfg(target_os = "windows")]
    { let _ = Command::new("taskkill").args(["/IM", "obs64.exe", "/F"]).output(); }

    #[cfg(target_os = "linux")]
    { let _ = Command::new("pkill").arg("-f").arg("/usr/bin/obs").output(); }

    #[cfg(target_os = "macos")]
    { let _ = Command::new("pkill").arg("-f").arg("OBS").output(); }
}

fn find_obs_path() -> Option<String> {
    // Platform-specific OBS detection

    #[cfg(target_os = "windows")]
    {
        let known_paths = [
            r"C:\Program Files\obs-studio\bin\64bit\obs64.exe",
            r"C:\Program Files (x86)\obs-studio\bin\32bit\obs32.exe",
        ];
        for p in &known_paths {
            if std::path::Path::new(p).exists() {
                return Some(p.to_string());
            }
        }
        // Try PATH
        if let Ok(output) = Command::new("where").arg("obs64.exe").output() {
            if output.status.success() {
                if let Ok(s) = String::from_utf8(output.stdout) {
                    let trimmed = s.trim().to_string();
                    if !trimmed.is_empty() {
                        return Some(trimmed);
                    }
                }
            }
        }
        None
    }

    #[cfg(target_os = "macos")]
    {
        let app_path = "/Applications/OBS.app";
        if std::path::Path::new(app_path).exists() {
            return Some(app_path.to_string());
        }
        None
    }

    #[cfg(target_os = "linux")]
    {
        // Check common paths
        if let Ok(output) = Command::new("which").arg("obs").output() {
            if output.status.success() {
                if let Ok(s) = String::from_utf8(output.stdout) {
                    let trimmed = s.trim().to_string();
                    if !trimmed.is_empty() {
                        return Some(trimmed);
                    }
                }
            }
        }
        // Check flatpak
        if let Ok(output) = Command::new("flatpak")
            .args(["info", "--show-location", "com.obsproject.Studio"])
            .output()
        {
            if output.status.success() {
                return Some("flatpak run com.obsproject.Studio".to_string());
            }
        }
        // Check snap
        let snap_path = "/snap/bin/obs-studio";
        if std::path::Path::new(snap_path).exists() {
            return Some(snap_path.to_string());
        }
        None
    }
}
