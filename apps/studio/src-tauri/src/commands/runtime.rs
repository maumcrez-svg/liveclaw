use std::process::Command;
use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
pub struct RuntimeConfig {
    pub api_base_url: String,
    pub agent_id: String,
    pub agent_slug: String,
    pub agent_api_key: String,
    pub llm_api_key: String,
    pub llm_provider: Option<String>,
    pub voice_disabled: Option<bool>,
}

#[derive(Serialize)]
pub struct RuntimeStatus {
    pub running: bool,
    pub pid: Option<u32>,
}

/// Start the generic agent runtime as a child process
#[tauri::command]
pub fn start_agent_runtime(config: RuntimeConfig) -> Result<u32, String> {
    // Find node/tsx executable
    let node_cmd = if cfg!(target_os = "windows") { "node.exe" } else { "node" };

    // Check if node is available
    let node_check = Command::new(node_cmd).arg("--version").output();
    if node_check.is_err() || !node_check.unwrap().status.success() {
        return Err("Node.js is required to run agent runtime. Install from nodejs.org".to_string());
    }

    // For now, use tsx to run TypeScript directly
    let tsx_cmd = if cfg!(target_os = "windows") { "npx.cmd" } else { "npx" };

    let child = Command::new(tsx_cmd)
        .args(["tsx", "agents/generic/src/index.ts"])
        .env("API_BASE_URL", &config.api_base_url)
        .env("AGENT_ID", &config.agent_id)
        .env("AGENT_SLUG", &config.agent_slug)
        .env("AGENT_API_KEY", &config.agent_api_key)
        .env("LLM_API_KEY", &config.llm_api_key)
        .env("LLM_PROVIDER", config.llm_provider.as_deref().unwrap_or(""))
        .env("VOICE_DISABLED", if config.voice_disabled.unwrap_or(true) { "true" } else { "false" })
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to start agent runtime: {}", e))?;

    let pid = child.id();
    eprintln!("[Runtime] Agent runtime started with PID: {}", pid);
    Ok(pid)
}

/// Stop the agent runtime
#[tauri::command]
pub fn stop_agent_runtime(pid: u32) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        Command::new("taskkill")
            .args(["/PID", &pid.to_string(), "/F", "/T"])
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
    eprintln!("[Runtime] Stopped agent runtime PID: {}", pid);
    Ok(())
}
