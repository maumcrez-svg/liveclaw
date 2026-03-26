use serde::{Deserialize, Serialize};
use std::collections::hash_map::DefaultHasher;
use std::fs;
use std::hash::{Hash, Hasher};
use std::path::PathBuf;

/// File-based token storage with XOR encryption using a machine-derived key.
/// Prevents casual file reading. Phase 2 will upgrade to OS keychain.

fn token_path() -> PathBuf {
    let dir = dirs_next().unwrap_or_else(|| PathBuf::from("."));
    dir.join("liveclaw-studio-auth.json")
}

fn dirs_next() -> Option<PathBuf> {
    #[cfg(target_os = "linux")]
    {
        std::env::var("XDG_DATA_HOME")
            .ok()
            .map(PathBuf::from)
            .or_else(|| {
                std::env::var("HOME")
                    .ok()
                    .map(|h| PathBuf::from(h).join(".local/share"))
            })
    }
    #[cfg(target_os = "macos")]
    {
        std::env::var("HOME")
            .ok()
            .map(|h| PathBuf::from(h).join("Library/Application Support"))
    }
    #[cfg(target_os = "windows")]
    {
        std::env::var("APPDATA").ok().map(PathBuf::from)
    }
}

// ── Machine-derived encryption key ──────────────────────────────────

fn get_machine_key() -> [u8; 32] {
    let mut hasher = DefaultHasher::new();

    // Mix hostname
    if let Ok(hostname) = std::env::var("HOSTNAME")
        .or_else(|_| std::env::var("COMPUTERNAME"))
        .or_else(|_| {
            std::fs::read_to_string("/etc/hostname")
                .map(|s| s.trim().to_string())
        })
    {
        hostname.hash(&mut hasher);
    }

    // Mix username
    if let Ok(user) = std::env::var("USER").or_else(|_| std::env::var("USERNAME")) {
        user.hash(&mut hasher);
    }

    // Mix a salt
    "liveclaw-studio-v1".hash(&mut hasher);

    let hash = hasher.finish();
    let mut key = [0u8; 32];
    for i in 0..4 {
        let bytes = hash.rotate_left(i as u32 * 16).to_le_bytes();
        key[i * 8..(i + 1) * 8].copy_from_slice(&bytes);
    }
    key
}

fn encrypt(data: &[u8]) -> Vec<u8> {
    let key = get_machine_key();
    data.iter()
        .enumerate()
        .map(|(i, b)| b ^ key[i % key.len()])
        .collect()
}

fn decrypt(data: &[u8]) -> Vec<u8> {
    encrypt(data) // XOR is symmetric
}

// ── Token struct ────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone)]
pub struct StoredAuth {
    pub access_token: String,
    pub refresh_token: String,
    pub username: String,
}

#[tauri::command]
pub fn store_token(access_token: String, refresh_token: String, username: String) -> Result<(), String> {
    let data = StoredAuth {
        access_token,
        refresh_token,
        username,
    };
    let json = serde_json::to_string(&data).map_err(|e| e.to_string())?;
    let encrypted = encrypt(json.as_bytes());
    let path = token_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(&path, encrypted).map_err(|e| format!("Failed to store token: {}", e))
}

#[tauri::command]
pub fn get_token() -> Result<Option<StoredAuth>, String> {
    let path = token_path();
    if !path.exists() {
        return Ok(None);
    }
    let raw = fs::read(&path).map_err(|e| e.to_string())?;

    // Migration: if the file is valid plaintext JSON (old format), read it,
    // then re-encrypt and save so future reads use the encrypted path.
    let json_str = if let Ok(text) = std::str::from_utf8(&raw) {
        if serde_json::from_str::<StoredAuth>(text).is_ok() {
            // Old plaintext format — re-encrypt in place
            let encrypted = encrypt(text.as_bytes());
            let _ = fs::write(&path, encrypted);
            text.to_string()
        } else {
            // Not valid JSON text — try decrypting
            let decrypted = decrypt(&raw);
            String::from_utf8(decrypted).map_err(|e| e.to_string())?
        }
    } else {
        // Not valid UTF-8 — must be encrypted binary
        let decrypted = decrypt(&raw);
        String::from_utf8(decrypted).map_err(|e| e.to_string())?
    };

    let data: StoredAuth = serde_json::from_str(&json_str).map_err(|e| e.to_string())?;
    Ok(Some(data))
}

#[tauri::command]
pub fn clear_token() -> Result<(), String> {
    let path = token_path();
    if path.exists() {
        fs::remove_file(&path).map_err(|e| e.to_string())?;
    }
    Ok(())
}
