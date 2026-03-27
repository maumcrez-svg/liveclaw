use std::process::Command;
use serde::Serialize;

#[derive(Serialize)]
pub struct FFmpegStatus {
    pub installed: bool,
    pub path: Option<String>,
    pub version: Option<String>,
}

/// Detect FFmpeg on the system
#[tauri::command]
pub fn detect_ffmpeg() -> FFmpegStatus {
    // Try common paths
    let paths = if cfg!(target_os = "windows") {
        vec!["ffmpeg", "ffmpeg.exe", r"C:\ffmpeg\bin\ffmpeg.exe"]
    } else {
        vec!["ffmpeg", "/usr/bin/ffmpeg", "/usr/local/bin/ffmpeg"]
    };

    for path in paths {
        if let Ok(output) = Command::new(path).arg("-version").output() {
            if output.status.success() {
                let version = String::from_utf8_lossy(&output.stdout)
                    .lines()
                    .next()
                    .unwrap_or("")
                    .to_string();
                return FFmpegStatus {
                    installed: true,
                    path: Some(path.to_string()),
                    version: Some(version),
                };
            }
        }
    }

    FFmpegStatus { installed: false, path: None, version: None }
}

/// Start FFmpeg capture + RTMP stream
#[tauri::command]
pub fn start_ffmpeg_stream(
    ffmpeg_path: String,
    capture_mode: String,  // "desktop" or "window:TITLE"
    rtmp_url: String,
    stream_key: String,
    resolution: Option<String>,
    fps: Option<u32>,
) -> Result<u32, String> {
    let res = resolution.unwrap_or_else(|| "1920x1080".to_string());
    let framerate = fps.unwrap_or(30);
    let full_rtmp = format!("{}/{}", rtmp_url, stream_key);

    let mut args: Vec<String> = Vec::new();

    // Input: platform-specific capture
    #[cfg(target_os = "linux")]
    {
        let display = std::env::var("DISPLAY").unwrap_or_else(|_| ":0".to_string());
        if capture_mode == "desktop" {
            args.extend_from_slice(&[
                "-f".into(), "x11grab".into(),
                "-framerate".into(), framerate.to_string(),
                "-video_size".into(), res.clone(),
                "-i".into(), display,
            ]);
        } else if capture_mode.starts_with("window:") {
            // Capture specific window by name
            let _window_name = &capture_mode[7..];
            // For now, capture full desktop (window capture via x11grab is complex)
            args.extend_from_slice(&[
                "-f".into(), "x11grab".into(),
                "-framerate".into(), framerate.to_string(),
                "-video_size".into(), res.clone(),
                "-i".into(), display,
            ]);
        }
        // Audio: capture system audio
        args.extend_from_slice(&[
            "-f".into(), "pulse".into(),
            "-i".into(), "default".into(),
        ]);
    }

    #[cfg(target_os = "windows")]
    {
        if capture_mode == "desktop" {
            args.extend_from_slice(&[
                "-f".into(), "gdigrab".into(),
                "-framerate".into(), framerate.to_string(),
                "-i".into(), "desktop".into(),
            ]);
        } else if capture_mode.starts_with("window:") {
            let window_title = &capture_mode[7..];
            args.extend_from_slice(&[
                "-f".into(), "gdigrab".into(),
                "-framerate".into(), framerate.to_string(),
                "-i".into(), format!("title={}", window_title),
            ]);
        }
        // Audio: Windows audio capture
        args.extend_from_slice(&[
            "-f".into(), "dshow".into(),
            "-i".into(), "audio=virtual-audio-capturer".into(),
        ]);
    }

    #[cfg(target_os = "macos")]
    {
        let _ = &capture_mode; // suppress unused warning; avfoundation uses device indices
        args.extend_from_slice(&[
            "-f".into(), "avfoundation".into(),
            "-framerate".into(), framerate.to_string(),
            "-i".into(), "1:0".into(), // screen:audio
        ]);
    }

    // Output encoding
    args.extend_from_slice(&[
        "-c:v".into(), "libx264".into(),
        "-preset".into(), "veryfast".into(),
        "-tune".into(), "zerolatency".into(),
        "-b:v".into(), "4500k".into(),
        "-maxrate".into(), "4500k".into(),
        "-bufsize".into(), "9000k".into(),
        "-pix_fmt".into(), "yuv420p".into(),
        "-g".into(), (framerate * 2).to_string(), // keyframe every 2s
        "-c:a".into(), "aac".into(),
        "-b:a".into(), "160k".into(),
        "-ar".into(), "44100".into(),
        "-f".into(), "flv".into(),
        full_rtmp,
    ]);

    eprintln!("[FFmpeg] Starting: {} {}", ffmpeg_path, args.join(" "));

    let child = Command::new(&ffmpeg_path)
        .args(&args)
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to start FFmpeg: {}", e))?;

    let pid = child.id();
    eprintln!("[FFmpeg] Started with PID: {}", pid);
    Ok(pid)
}

/// Stop FFmpeg process
#[tauri::command]
pub fn stop_ffmpeg_stream(pid: u32) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        Command::new("taskkill")
            .args(["/PID", &pid.to_string(), "/F"])
            .output()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(not(target_os = "windows"))]
    {
        // Send SIGTERM for graceful shutdown
        Command::new("kill")
            .arg(pid.to_string())
            .output()
            .map_err(|e| e.to_string())?;
    }
    eprintln!("[FFmpeg] Stopped PID: {}", pid);
    Ok(())
}

/// Take a single screenshot using FFmpeg (for preview)
#[tauri::command]
pub fn ffmpeg_screenshot(ffmpeg_path: String) -> Result<String, String> {
    let output_path = std::env::temp_dir().join("liveclaw_preview.jpg");
    let output_str = output_path.to_string_lossy().to_string();

    // Remove previous screenshot
    let _ = std::fs::remove_file(&output_path);

    let display_env;
    #[cfg(target_os = "linux")]
    let args = {
        display_env = std::env::var("DISPLAY").unwrap_or_else(|_| ":0".to_string());
        vec![
            "-y", "-f", "x11grab", "-video_size", "640x360",
            "-i", &display_env,
            "-frames:v", "1", "-q:v", "5", &output_str,
        ]
    };

    #[cfg(target_os = "windows")]
    let args = {
        display_env = String::new();
        let _ = &display_env;
        vec![
            "-y", "-f", "gdigrab", "-video_size", "640x360",
            "-i", "desktop", "-frames:v", "1", "-q:v", "5", &output_str,
        ]
    };

    #[cfg(target_os = "macos")]
    let args = {
        display_env = String::new();
        let _ = &display_env;
        vec![
            "-y", "-f", "avfoundation", "-video_size", "640x360",
            "-i", "1", "-frames:v", "1", "-q:v", "5", &output_str,
        ]
    };

    let status = Command::new(&ffmpeg_path)
        .args(&args)
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .map_err(|e| format!("Screenshot failed: {}", e))?;

    if !status.success() || !output_path.exists() {
        return Err("Screenshot capture failed".to_string());
    }

    // Read file and return as base64
    let bytes = std::fs::read(&output_path)
        .map_err(|e| format!("Failed to read screenshot: {}", e))?;
    let base64 = base64_encode(&bytes);
    let _ = std::fs::remove_file(&output_path);

    Ok(format!("data:image/jpeg;base64,{}", base64))
}

fn base64_encode(data: &[u8]) -> String {
    const CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut result = String::new();
    for chunk in data.chunks(3) {
        let b0 = chunk[0] as u32;
        let b1 = if chunk.len() > 1 { chunk[1] as u32 } else { 0 };
        let b2 = if chunk.len() > 2 { chunk[2] as u32 } else { 0 };
        let triple = (b0 << 16) | (b1 << 8) | b2;
        result.push(CHARS[((triple >> 18) & 0x3F) as usize] as char);
        result.push(CHARS[((triple >> 12) & 0x3F) as usize] as char);
        if chunk.len() > 1 {
            result.push(CHARS[((triple >> 6) & 0x3F) as usize] as char);
        } else {
            result.push('=');
        }
        if chunk.len() > 2 {
            result.push(CHARS[(triple & 0x3F) as usize] as char);
        } else {
            result.push('=');
        }
    }
    result
}
