use serde::Serialize;
use std::fs;
#[cfg(target_os = "windows")]
use std::io;
use std::path::{Path, PathBuf};
use std::process::Command;
use tauri::{AppHandle, Manager, Emitter};

#[allow(dead_code)]
const OBS_VERSION: &str = "32.1.0";

#[derive(Serialize, Clone)]
pub struct SetupProgress {
    pub stage: String,
    pub detail: String,
}

fn emit_progress(app: &AppHandle, stage: &str, detail: &str) {
    let _ = app.emit(
        "obs-setup-progress",
        SetupProgress {
            stage: stage.to_string(),
            detail: detail.to_string(),
        },
    );
}

fn obs_data_dir(app: &AppHandle) -> PathBuf {
    app.path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("obs-portable")
}

#[allow(unused_variables)]
fn obs_binary_path(base: &Path) -> PathBuf {
    #[cfg(target_os = "windows")]
    {
        // Direct path (if extracted flat)
        let direct = base.join("bin").join("64bit").join("obs64.exe");
        if direct.exists() {
            return direct;
        }

        // Search in extracted subdirectories (OBS zip creates OBS-Studio-VERSION-Windows-x64/)
        if let Ok(entries) = std::fs::read_dir(base) {
            for entry in entries.flatten() {
                let p = entry.path();
                if p.is_dir() {
                    let nested = p.join("bin").join("64bit").join("obs64.exe");
                    if nested.exists() {
                        return nested;
                    }
                }
            }
        }

        // Fallback to direct path even if it doesn't exist (will fail later with clear error)
        direct
    }
    #[cfg(target_os = "macos")]
    {
        base.join("OBS.app")
            .join("Contents")
            .join("MacOS")
            .join("obs")
    }
    #[cfg(target_os = "linux")]
    {
        // Linux: no portable, return system OBS
        PathBuf::from("/usr/bin/obs")
    }
}

fn obs_config_dir(base: &Path) -> PathBuf {
    #[cfg(target_os = "windows")]
    {
        base.join("config").join("obs-studio")
    }
    #[cfg(not(target_os = "windows"))]
    {
        base.join("config").join("obs-studio")
    }
}

#[derive(Serialize)]
pub struct ObsPortableStatus {
    pub ready: bool,
    pub obs_path: Option<String>,
    pub needs_download: bool,
    pub platform_supported: bool,
}

/// Check if bundled OBS portable is ready to use.
#[allow(unused_variables)]
#[tauri::command]
pub fn check_obs_portable(app: AppHandle) -> ObsPortableStatus {
    #[cfg(target_os = "linux")]
    {
        // Linux: no portable, check system OBS
        let system_obs = Command::new("which").arg("obs").output().ok();
        let found = system_obs.map_or(false, |o| o.status.success());
        return ObsPortableStatus {
            ready: found,
            obs_path: if found { Some("/usr/bin/obs".to_string()) } else { None },
            needs_download: false,
            platform_supported: false, // portable not supported on Linux
        };
    }

    #[cfg(not(target_os = "linux"))]
    {
        let base = obs_data_dir(&app);
        let binary = obs_binary_path(&base);
        let ready = binary.exists();
        ObsPortableStatus {
            ready,
            obs_path: if ready { binary.to_str().map(|s| s.to_string()) } else { None },
            needs_download: !ready,
            platform_supported: true,
        }
    }
}

/// Download, extract, and configure OBS Portable. Emits progress events.
#[tauri::command]
pub async fn setup_obs_portable(app: AppHandle) -> Result<String, String> {
    let base = obs_data_dir(&app);
    let binary = obs_binary_path(&base);

    // Already set up?
    if binary.exists() {
        return Ok(binary.to_str().unwrap_or("").to_string());
    }

    fs::create_dir_all(&base).map_err(|e| format!("Failed to create directory: {}", e))?;

    // Step 1: Download
    emit_progress(&app, "downloading", "Downloading OBS Studio...");

    let (download_url, archive_name) = get_download_info();
    let archive_path = base.join(&archive_name);

    // Try curl first (available on most systems)
    let curl_ok = Command::new("curl")
        .args([
            "-L",
            "-o",
            archive_path.to_str().unwrap(),
            &download_url,
            "--progress-bar",
            "--fail",
        ])
        .status()
        .map(|s| s.success())
        .unwrap_or(false);

    if !curl_ok {
        // Fallback: PowerShell (Windows) or wget (Linux/macOS)
        #[cfg(target_os = "windows")]
        {
            emit_progress(&app, "downloading", "Downloading OBS Studio (via PowerShell)...");
            let ps_status = Command::new("powershell")
                .args([
                    "-NoProfile",
                    "-ExecutionPolicy", "Bypass",
                    "-Command",
                    &format!(
                        "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '{}' -OutFile '{}' -UseBasicParsing",
                        download_url,
                        archive_path.to_str().unwrap()
                    ),
                ])
                .status()
                .map_err(|e| format!("Download failed: {}. Please install OBS manually from obsproject.com", e))?;

            if !ps_status.success() {
                return Err("Download failed. Please install OBS manually from obsproject.com/download".to_string());
            }
        }

        #[cfg(not(target_os = "windows"))]
        {
            // Try wget as fallback
            let wget_ok = Command::new("wget")
                .args(["-O", archive_path.to_str().unwrap(), &download_url])
                .status()
                .map(|s| s.success())
                .unwrap_or(false);

            if !wget_ok {
                return Err("Download failed. Please install OBS manually from obsproject.com/download".to_string());
            }
        }
    }

    if !archive_path.exists() {
        return Err("Download completed but file not found. Please install OBS manually.".to_string());
    }

    // Step 2: Extract
    emit_progress(&app, "extracting", "Extracting OBS Studio...");
    extract_archive(&archive_path, &base)?;

    // Clean up archive
    let _ = fs::remove_file(&archive_path);

    // Step 3: Configure
    emit_progress(&app, "configuring", "Configuring OBS for LiveClaw...");
    configure_obs_portable(&base)?;

    // Step 4: Verify — re-resolve binary path now that extraction is complete
    let binary = obs_binary_path(&base);
    if !binary.exists() {
        return Err(format!(
            "Setup completed but OBS binary not found at expected path: {}",
            binary.display()
        ));
    }

    emit_progress(&app, "ready", "OBS Studio is ready!");
    Ok(binary.to_str().unwrap_or("").to_string())
}

/// Launch the bundled OBS in portable mode, minimized to tray.
#[tauri::command]
pub fn launch_bundled_obs(app: AppHandle) -> Result<u32, String> {
    let base = obs_data_dir(&app);
    let binary = obs_binary_path(&base);

    if !binary.exists() {
        return Err("OBS not found. Run setup first.".to_string());
    }

    #[cfg(target_os = "windows")]
    let child = {
        // Go up from bin/64bit/obs64.exe to OBS root (where data/ lives)
        let obs_root = binary.parent() // bin/64bit
            .and_then(|p| p.parent())   // bin
            .and_then(|p| p.parent())   // OBS root (e.g. OBS-Studio-32.1.0-Windows-x64)
            .unwrap_or_else(|| binary.parent().unwrap());

        eprintln!("[OBS Portable] Binary: {:?}", binary);
        eprintln!("[OBS Portable] Working dir: {:?}", obs_root);
        eprintln!("[OBS Portable] data/ exists: {}", obs_root.join("data").exists());

        let locale_check = obs_root.join("data").join("obs-studio").join("locale").join("en-US.ini");
        if !locale_check.exists() {
            eprintln!("[OBS Portable] WARNING: locale not found at {:?}", locale_check);
        }

        Command::new(&binary)
            .current_dir(obs_root)
            .args([
                "--portable",
                "--minimize-to-tray",
                "--disable-updater",
                "--websocket_port",
                "4455",
            ])
            .spawn()
            .map_err(|e| format!("Failed to launch OBS: {}", e))?
    };

    #[cfg(target_os = "macos")]
    let child = Command::new(&binary)
        .args([
            "--config-dir",
            obs_config_dir(&base).to_str().unwrap(),
            "--minimize-to-tray",
            "--websocket_port",
            "4455",
        ])
        .spawn()
        .map_err(|e| format!("Failed to launch OBS: {}", e))?;

    #[cfg(target_os = "linux")]
    let child = Command::new("obs")
        .env("XDG_SESSION_TYPE", "x11")
        .env("QT_QPA_PLATFORM", "xcb")
        .args([
            "--minimize-to-tray",
            "--websocket_port",
            "4455",
        ])
        .spawn()
        .map_err(|e| format!("Failed to launch OBS: {}", e))?;

    #[cfg(target_os = "linux")]
    {
        use std::time::Duration;
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
                for name in &["sharing your screen", "Share your screen", "Screencast", "pipewire"] {
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

    Ok(child.id())
}

/// Kill OBS process by PID.
#[tauri::command]
pub fn kill_obs_process(pid: u32) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        Command::new("taskkill")
            .args(["/PID", &pid.to_string(), "/F"])
            .output()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(not(target_os = "windows"))]
    {
        Command::new("kill")
            .arg(pid.to_string())
            .output()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

// ── internal helpers ────────────────────────────────────────────────

fn get_download_info() -> (String, String) {
    #[cfg(target_os = "windows")]
    {
        let url = format!(
            "https://github.com/obsproject/obs-studio/releases/download/{}/OBS-Studio-{}-Windows-x64.zip",
            OBS_VERSION, OBS_VERSION
        );
        (url, format!("OBS-Studio-{}-Windows-x64.zip", OBS_VERSION))
    }
    #[cfg(target_os = "macos")]
    {
        let url = format!(
            "https://github.com/obsproject/obs-studio/releases/download/{}/OBS-Studio-{}-macOS-Apple.dmg",
            OBS_VERSION, OBS_VERSION
        );
        (url, format!("OBS-Studio-{}-macOS-Apple.dmg", OBS_VERSION))
    }
    #[cfg(target_os = "linux")]
    {
        // Linux: not downloaded, use system OBS
        ("".to_string(), "".to_string())
    }
}

fn extract_archive(archive: &Path, dest: &Path) -> Result<(), String> {
    let ext = archive
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("");

    match ext {
        "zip" => extract_zip(archive, dest),
        "dmg" => extract_dmg(archive, dest),
        _ => Err(format!("Unknown archive format: {}", ext)),
    }
}

fn extract_zip(archive: &Path, dest: &Path) -> Result<(), String> {
    // Use system unzip/tar for reliability
    #[cfg(target_os = "windows")]
    {
        // Windows 10+ has tar that can handle zip
        let status = Command::new("tar")
            .args([
                "-xf",
                archive.to_str().unwrap(),
                "-C",
                dest.to_str().unwrap(),
            ])
            .status()
            .map_err(|e| format!("Failed to extract: {}", e))?;

        if !status.success() {
            // Fallback: PowerShell
            Command::new("powershell")
                .args([
                    "-NoProfile",
                    "-Command",
                    &format!(
                        "Expand-Archive -Path '{}' -DestinationPath '{}' -Force",
                        archive.display(),
                        dest.display()
                    ),
                ])
                .status()
                .map_err(|e| format!("Failed to extract: {}", e))?;
        }
        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    {
        let status = Command::new("unzip")
            .args(["-o", archive.to_str().unwrap(), "-d", dest.to_str().unwrap()])
            .status()
            .map_err(|e| format!("Failed to extract: {}", e))?;

        if !status.success() {
            return Err("Extraction failed".to_string());
        }
        Ok(())
    }
}

#[allow(unused_variables)]
fn extract_dmg(archive: &Path, dest: &Path) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        // Mount DMG
        let mount_output = Command::new("hdiutil")
            .args(["attach", archive.to_str().unwrap(), "-nobrowse", "-quiet"])
            .output()
            .map_err(|e| format!("Failed to mount DMG: {}", e))?;

        let mount_stdout = String::from_utf8_lossy(&mount_output.stdout);
        let mount_point = mount_stdout
            .lines()
            .last()
            .and_then(|line| line.split('\t').last())
            .map(|s| s.trim())
            .ok_or("Failed to find mount point")?;

        // Copy OBS.app
        let obs_app_src = format!("{}/OBS.app", mount_point);
        let obs_app_dst = dest.join("OBS.app");

        Command::new("cp")
            .args(["-R", &obs_app_src, obs_app_dst.to_str().unwrap()])
            .status()
            .map_err(|e| format!("Failed to copy OBS.app: {}", e))?;

        // Unmount
        let _ = Command::new("hdiutil")
            .args(["detach", mount_point, "-quiet"])
            .status();

        Ok(())
    }

    #[cfg(not(target_os = "macos"))]
    {
        Err("DMG extraction only supported on macOS".to_string())
    }
}

fn configure_obs_portable(base: &Path) -> Result<(), String> {
    let config = obs_config_dir(base);
    let profiles_dir = config.join("basic").join("profiles").join("Default");
    let scenes_dir = config.join("basic").join("scenes");

    fs::create_dir_all(&profiles_dir).map_err(|e| e.to_string())?;
    fs::create_dir_all(&scenes_dir).map_err(|e| e.to_string())?;

    // global.ini — WebSocket enabled, no auth, start hidden in tray
    let global_ini = config.join("basic").join("global.ini");
    fs::write(
        &global_ini,
        "[General]\n\
         Language=en-US\n\
         FirstRun=true\n\
         \n\
         [OBSWebSocket]\n\
         ServerEnabled=true\n\
         ServerPort=4455\n\
         Authenticated=false\n\
         ServerPassword=\n\
         AlertsEnabled=false\n\
         \n\
         [BasicWindow]\n\
         SysTrayEnabled=true\n\
         SysTrayWhenStarted=true\n\
         SysTrayMinimizeToTray=true\n\
         \n\
         [Basic]\n\
         SceneCollectionFile=LiveClaw\n\
         ProfileName=Default\n",
    )
    .map_err(|e| format!("Failed to write global.ini: {}", e))?;

    // profiles/Default/basic.ini — output settings
    let basic_ini = profiles_dir.join("basic.ini");
    fs::write(
        &basic_ini,
        "[Output]\n\
         Mode=Simple\n\
         \n\
         [SimpleOutput]\n\
         VBitrate=4500\n\
         ABitrate=160\n\
         StreamEncoder=x264\n\
         RecFormat=mkv\n\
         \n\
         [Video]\n\
         BaseCX=1920\n\
         BaseCY=1080\n\
         OutputCX=1920\n\
         OutputCY=1080\n\
         FPSType=1\n\
         FPSCommon=30\n",
    )
    .map_err(|e| format!("Failed to write basic.ini: {}", e))?;

    // scenes/LiveClaw.json — empty scene
    let scene_json = scenes_dir.join("LiveClaw.json");
    fs::write(
        &scene_json,
        "{\n  \"name\": \"LiveClaw\",\n  \"groups\": [],\n  \"sources\": []\n}\n",
    )
    .map_err(|e| format!("Failed to write scene: {}", e))?;

    // portable_mode.txt (Windows only)
    #[cfg(target_os = "windows")]
    {
        // The OBS zip extracts to a subdirectory. Find it and create the marker there.
        if let Some(obs_subdir) = find_obs_subdir(base) {
            let marker = obs_subdir.join("portable_mode.txt");
            fs::write(&marker, "").map_err(|e| format!("Failed to create portable marker: {}", e))?;

            // Also move our config into the OBS subdir
            let obs_config_dir = obs_subdir.join("config").join("obs-studio");
            if !obs_config_dir.exists() {
                fs::create_dir_all(&obs_config_dir).ok();
                // Copy our config into the OBS directory
                copy_dir_recursive(&config.join("basic"), &obs_config_dir.join("basic")).ok();
            }
        }
    }

    Ok(())
}

#[cfg(target_os = "windows")]
fn find_obs_subdir(base: &Path) -> Option<PathBuf> {
    // OBS zip extracts to OBS-Studio-VERSION-Windows-x64/
    if let Ok(entries) = fs::read_dir(base) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                let name = path.file_name()?.to_str()?;
                if name.starts_with("OBS-Studio") {
                    return Some(path);
                }
            }
        }
    }
    None
}

#[cfg(target_os = "windows")]
fn copy_dir_recursive(src: &Path, dst: &Path) -> io::Result<()> {
    fs::create_dir_all(dst)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let ty = entry.file_type()?;
        let dest_path = dst.join(entry.file_name());
        if ty.is_dir() {
            copy_dir_recursive(&entry.path(), &dest_path)?;
        } else {
            fs::copy(entry.path(), &dest_path)?;
        }
    }
    Ok(())
}
