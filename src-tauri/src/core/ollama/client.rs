// src/core/ollama/client.rs
use reqwest;
use serde_json;
use std::time::Duration;
use crate::data::download_state::InstallationInformation;
use crate::helpers::platform_detector::detect_operating_system;
use tauri::AppHandle;

/// Main client for interacting with Ollama
pub struct OllamaClient {
    client: reqwest::Client,
    base_url: String,
}

impl OllamaClient {
    pub fn new() -> Self {
        Self {
            client: reqwest::Client::new(),
            base_url: "http://localhost:11434".to_string(),
        }
    }

    /// Check if Ollama is running
    pub async fn check_health(&self) -> Result<bool, String> {
        let response = self.client
            .get(&format!("{}/api/version", self.base_url))
            .timeout(Duration::from_secs(2))
            .send()
            .await;

        match response {
            Ok(resp) if resp.status().is_success() => Ok(true),
            _ => Ok(false),
        }
    }

    /// Get Ollama version
    pub async fn get_version(&self) -> Result<String, String> {
        let response = self.client
            .get(&format!("{}/api/version", self.base_url))
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
}

impl Default for OllamaClient {
    fn default() -> Self {
        Self::new()
    }
}

// ===== Standalone Functions =====

/// Check if Ollama is installed on the system
pub async fn is_ollama_installed() -> Result<bool, String> {
    #[cfg(target_os = "windows")]
    {
        // Try multiple methods to find Ollama without showing console windows
        use std::path::Path;
        use std::env;
        
        // Method 1: Check common installation paths
        let common_paths = [
            r"C:\Program Files\Ollama\ollama.exe",
            r"C:\Program Files (x86)\Ollama\ollama.exe",
            r"%LOCALAPPDATA%\Programs\Ollama\ollama.exe",
            r"%USERPROFILE%\AppData\Local\Programs\Ollama\ollama.exe",
        ];
        
        for path in common_paths.iter() {
            let expanded_path = if path.starts_with('%') {
                let path_str = path.to_string();
                if path_str.contains("%LOCALAPPDATA%") {
                    if let Ok(localappdata) = env::var("LOCALAPPDATA") {
                        path_str.replace("%LOCALAPPDATA%", &localappdata)
                    } else {
                        continue;
                    }
                } else if path_str.contains("%USERPROFILE%") {
                    if let Ok(userprofile) = env::var("USERPROFILE") {
                        path_str.replace("%USERPROFILE%", &userprofile)
                    } else {
                        continue;
                    }
                } else {
                    path_str
                }
            } else {
                path.to_string()
            };
            
            if Path::new(&expanded_path).exists() {
                return Ok(true);
            }
        }
        
        // Method 2: Try using where command with CREATE_NO_WINDOW
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        
        let output = std::process::Command::new("where")
            .arg("ollama")
            .creation_flags(CREATE_NO_WINDOW)
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .stdin(std::process::Stdio::null())
            .output();
            
        match output {
            Ok(output) => {
                if output.status.success() {
                    return Ok(true);
                }
            }
            Err(_) => {}
        }
        
        // Method 3: Check Windows Registry
        let registry_check = std::process::Command::new("reg")
            .args(&["query", r"HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\ollama.exe"])
            .creation_flags(CREATE_NO_WINDOW)
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .stdin(std::process::Stdio::null())
            .output();
            
        if let Ok(output) = registry_check {
            if output.status.success() {
                return Ok(true);
            }
        }
        
        Ok(false)
    }
    
    #[cfg(not(target_os = "windows"))]
    {
        match std::process::Command::new("which")
            .arg("ollama")
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .output() 
        {
            Ok(output) => Ok(output.status.success()),
            Err(_) => Ok(false),
        }
    }
}

/// Check if Ollama is running (server is responsive)
pub async fn is_ollama_running() -> Result<bool, String> {
    match fetch_ollama_version().await {
        Ok(_) => Ok(true),
        Err(_) => Ok(false),
    }
}

/// Fetch the Ollama version
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

/// Start Ollama service
pub async fn start_ollama(_app_handle: &AppHandle) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        const DETACHED_PROCESS: u32 = 0x00000008;
        const CREATE_NEW_PROCESS_GROUP: u32 = 0x00000200;
        
        let flags = CREATE_NO_WINDOW | DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP;
        
        let ollama_paths = [
            r"C:\Program Files\Ollama\ollama.exe",
            r"C:\Program Files (x86)\Ollama\ollama.exe",
            r"%LOCALAPPDATA%\Programs\Ollama\ollama.exe",
            r"%USERPROFILE%\AppData\Local\Programs\Ollama\ollama.exe",
        ];
        
        let mut started = false;
        for path in ollama_paths.iter() {
            let expanded_path = if path.starts_with('%') {
                use std::env;
                let path_str = path.to_string();
                if path_str.contains("%LOCALAPPDATA%") {
                    if let Ok(localappdata) = env::var("LOCALAPPDATA") {
                        path_str.replace("%LOCALAPPDATA%", &localappdata)
                    } else {
                        continue;
                    }
                } else if path_str.contains("%USERPROFILE%") {
                    if let Ok(userprofile) = env::var("USERPROFILE") {
                        path_str.replace("%USERPROFILE%", &userprofile)
                    } else {
                        continue;
                    }
                } else {
                    path_str
                }
            } else {
                path.to_string()
            };
            
            if std::path::Path::new(&expanded_path).exists() {
                let child = std::process::Command::new(&expanded_path)
                    .arg("serve")
                    .creation_flags(flags)
                    .stdout(std::process::Stdio::null())
                    .stderr(std::process::Stdio::null())
                    .stdin(std::process::Stdio::null())
                    .spawn();
                    
                if child.is_ok() {
                    started = true;
                    break;
                }
            }
        }
        
        if !started {
            let child = std::process::Command::new("ollama")
                .arg("serve")
                .creation_flags(flags)
                .stdout(std::process::Stdio::null())
                .stderr(std::process::Stdio::null())
                .stdin(std::process::Stdio::null())
                .spawn();
                
            if child.is_err() {
                return Err("Failed to start Ollama".to_string());
            }
        }
        
        tokio::time::sleep(tokio::time::Duration::from_secs(3)).await;
        
        if is_ollama_running().await? {
            Ok("Ollama started successfully".to_string())
        } else {
            Err("Ollama failed to start".to_string())
        }
    }
    
    #[cfg(target_os = "macos")]
    {
        let output = std::process::Command::new("open")
            .args(&["-a", "Ollama", "--background"])
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .output()
            .map_err(|e| format!("Failed to start Ollama: {}", e))?;
        
        if !output.status.success() {
            return Err("Failed to start Ollama".to_string());
        }
        
        tokio::time::sleep(tokio::time::Duration::from_secs(3)).await;
        
        if is_ollama_running().await? {
            Ok("Ollama started successfully".to_string())
        } else {
            Err("Ollama is starting but not ready yet".to_string())
        }
    }
    
    #[cfg(target_os = "linux")]
    {
        let output = std::process::Command::new("systemctl")
            .args(&["--user", "start", "ollama.service"])
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .output();
        
        if let Ok(output) = output {
            if output.status.success() {
                tokio::time::sleep(tokio::time::Duration::from_secs(3)).await;
                if is_ollama_running().await? {
                    return Ok("Ollama started successfully".to_string());
                }
            }
        }
        
        std::process::Command::new("nohup")
            .args(&["ollama", "serve", "&"])
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .spawn()
            .map_err(|e| format!("Failed to start Ollama: {}", e))?;
        
        tokio::time::sleep(tokio::time::Duration::from_secs(3)).await;
        
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

/// Get installation instructions for the current platform
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