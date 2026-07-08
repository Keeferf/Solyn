use reqwest;
use serde_json;
use std::time::Duration;
use crate::data::download_state::InstallationInformation;
use crate::helpers::platform_detector::detect_operating_system;
use tauri::AppHandle;

pub async fn is_ollama_installed() -> Result<bool, String> {
    // Simple check - try to find the ollama binary
    #[cfg(target_os = "windows")]
    let check_cmd = "where ollama";
    #[cfg(not(target_os = "windows"))]
    let check_cmd = "command -v ollama";
    
    // Use the check_cmd variable to suppress warning
    let _ = check_cmd;
    
    match std::process::Command::new(if cfg!(target_os = "windows") { "where" } else { "which" })
        .arg("ollama")
        .output() 
    {
        Ok(output) => Ok(output.status.success()),
        Err(_) => Ok(false),
    }
}

pub async fn is_ollama_running() -> Result<bool, String> {
    match fetch_ollama_version().await {
        Ok(_) => Ok(true),
        Err(_) => Ok(false),
    }
}

pub async fn fetch_ollama_version() -> Result<String, String> {
    let client = reqwest::Client::new();
    let response = client
        .get("http://localhost:11434/api/version")
        .timeout(Duration::from_secs(2))
        .send()
        .await
        .map_err(|e| format!("Failed to connect to Ollama: {}", e))?;

    if response.status().is_success() {
        let version_info: serde_json::Value = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse version: {}", e))?;
        Ok(version_info["version"]
            .as_str()
            .unwrap_or("unknown")
            .to_string())
    } else {
        Err("Ollama is not running".to_string())
    }
}

pub async fn start_ollama(_app_handle: &AppHandle) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        const DETACHED_PROCESS: u32 = 0x00000008;
        const CREATE_NEW_PROCESS_GROUP: u32 = 0x00000200;
        
        // Combine flags for maximum stealth
        let flags = CREATE_NO_WINDOW | DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP;
        
        std::process::Command::new("ollama")
            .arg("serve")
            .creation_flags(flags)
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .spawn()
            .map_err(|e| format!("Failed to start Ollama: {}", e))?;
        
        // Wait a moment for Ollama to start
        tokio::time::sleep(tokio::time::Duration::from_secs(3)).await;
        
        // Check if it's running
        if is_ollama_running().await? {
            Ok("Ollama started successfully".to_string())
        } else {
            Err("Ollama failed to start".to_string())
        }
    }
    
    #[cfg(target_os = "macos")]
    {
        // On macOS, use open with background flag
        let output = std::process::Command::new("open")
            .args(&["-a", "Ollama", "--background"])
            .output()
            .map_err(|e| format!("Failed to start Ollama: {}", e))?;
        
        if !output.status.success() {
            return Err("Failed to start Ollama".to_string());
        }
        
        // Wait for Ollama to start
        tokio::time::sleep(tokio::time::Duration::from_secs(3)).await;
        
        // Check if it's running
        if is_ollama_running().await? {
            Ok("Ollama started successfully".to_string())
        } else {
            Err("Ollama is starting but not ready yet".to_string())
        }
    }
    
    #[cfg(target_os = "linux")]
    {
        // Try systemctl first
        let output = std::process::Command::new("systemctl")
            .args(&["--user", "start", "ollama.service"])
            .output();
        
        if let Ok(output) = output {
            if output.status.success() {
                tokio::time::sleep(tokio::time::Duration::from_secs(3)).await;
                if is_ollama_running().await? {
                    return Ok("Ollama started successfully".to_string());
                }
            }
        }
        
        // Fallback to direct command with nohup
        std::process::Command::new("nohup")
            .args(&["ollama", "serve", "&"])
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .spawn()
            .map_err(|e| format!("Failed to start Ollama: {}", e))?;
        
        tokio::time::sleep(tokio::time::Duration::from_secs(3)).await;
        
        // Check if it's running
        if is_ollama_running().await? {
            Ok("Ollama started successfully".to_string())
        } else {
            Err("Ollama is starting but not ready yet".to_string())
        }
    }
    
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        Err("Unsupported platform for starting Ollama".to_string())
    }
}

pub async fn get_installation_instructions() -> Result<InstallationInformation, String> {
    let platform = detect_operating_system();
    
    let (command, estimated_time) = match platform.as_str() {
        "windows" => (
            "irm https://ollama.com/install.ps1 | iex".to_string(),
            "~5 minutes".to_string(),
        ),
        "macos" | "linux" => (
            "curl -fsSL https://ollama.com/install.sh | sh".to_string(),
            "~5 minutes".to_string(),
        ),
        _ => return Err("Unsupported platform".to_string()),
    };

    Ok(InstallationInformation {
        platform,
        command,
        estimated_time,
    })
}