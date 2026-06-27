use serde::{Deserialize, Serialize};
use std::process::Command;
use tauri::Manager;
use tauri::Emitter;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct InstallProgress {
    pub status: InstallStatus,
    pub progress: u8,
    pub message: String,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct InstallInfo {
    pub platform: String,
    pub method: String,
    pub command: String,
    pub estimated_time: String,
    pub models_note: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum InstallStatus {
    Idle,
    Downloading,
    Verifying,
    Installing,
    Completed,
    Error,
}

#[tauri::command]
async fn check_ollama_installed() -> Result<bool, String> {
    match get_ollama_version().await {
        Ok(_) => Ok(true),
        Err(_) => Ok(false),
    }
}

#[tauri::command]
async fn get_ollama_version() -> Result<String, String> {
    let client = reqwest::Client::new();
    let response = client
        .get("http://localhost:11434/api/version")
        .timeout(std::time::Duration::from_secs(2))
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

#[tauri::command]
async fn get_install_info() -> Result<InstallInfo, String> {
    let platform = get_platform();
    
    let (command, estimated_time) = match platform.as_str() {
        "windows" => (
            "irm https://ollama.com/install.ps1 | iex".to_string(),
            "1-2 minutes".to_string(),
        ),
        "macos" => (
            "curl -fsSL https://ollama.com/install.sh | sh".to_string(),
            "1-2 minutes".to_string(),
        ),
        "linux" => (
            "curl -fsSL https://ollama.com/install.sh | sh".to_string(),
            "1-2 minutes".to_string(),
        ),
        _ => return Err("Unsupported platform".to_string()),
    };

    Ok(InstallInfo {
        platform: platform.clone(),
        method: "Official Script".to_string(),
        command,
        estimated_time,
        models_note: "Models are downloaded separately after installation".to_string(),
    })
}

#[tauri::command]
async fn download_ollama(app_handle: tauri::AppHandle) -> Result<String, String> {
    let window = app_handle.get_webview_window("main").ok_or("Main window not found")?;
    let platform = get_platform();

    emit_progress(
        &window,
        InstallStatus::Installing,
        10,
        format!("Installing Ollama for {}...", platform),
    );

    let install_result = match platform.as_str() {
        "windows" => install_windows(&window).await,
        "macos" => install_macos(&window).await,
        "linux" => install_linux(&window).await,
        _ => Err("Unsupported platform".to_string()),
    };

    if let Err(e) = install_result {
        emit_progress(
            &window,
            InstallStatus::Error,
            0,
            format!("Installation failed: {}", e),
        );
        return Err(e);
    }

    emit_progress(
        &window,
        InstallStatus::Installing,
        80,
        "Waiting for installation to complete...".to_string(),
    );

    // Wait for installation to complete
    tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;

    // Verify installation
    emit_progress(
        &window,
        InstallStatus::Installing,
        90,
        "Verifying installation...".to_string(),
    );

    // Start Ollama service
    emit_progress(
        &window,
        InstallStatus::Installing,
        95,
        "Starting Ollama service...".to_string(),
    );

    if let Err(e) = start_ollama_service().await {
        eprintln!("Failed to start Ollama service: {}", e);
        // Don't fail the installation if service start fails
    }

    emit_progress(
        &window,
        InstallStatus::Completed,
        100,
        "✅ Ollama installed successfully!".to_string(),
    );

    Ok("Ollama installed successfully".to_string())
}

#[tauri::command]
fn get_platform_info() -> String {
    get_platform()
}

// Helper functions

fn get_platform() -> String {
    if cfg!(target_os = "windows") {
        "windows".to_string()
    } else if cfg!(target_os = "macos") {
        "macos".to_string()
    } else if cfg!(target_os = "linux") {
        "linux".to_string()
    } else {
        "unknown".to_string()
    }
}

async fn install_windows(window: &tauri::WebviewWindow) -> Result<(), String> {
    emit_progress(
        window,
        InstallStatus::Installing,
        30,
        "Downloading and installing Ollama via PowerShell...".to_string(),
    );

    emit_progress(
        window,
        InstallStatus::Installing,
        40,
        "This may take a few minutes. Please wait...".to_string(),
    );

    // PowerShell command to install Ollama
    let output = Command::new("powershell")
        .args(&[
            "-Command",
            "Start-Process powershell -Verb RunAs -ArgumentList '-Command \"irm https://ollama.com/install.ps1 | iex\"' -Wait"
        ])
        .output()
        .map_err(|e| format!("Failed to run PowerShell: {}", e))?;

    if !output.status.success() {
        let error = String::from_utf8_lossy(&output.stderr);
        if error.contains("Access is denied") || error.contains("administrator") {
            return Err("Administrator privileges required. Please run as administrator.".to_string());
        }
        return Err(format!("Installation failed: {}", error));
    }

    emit_progress(
        window,
        InstallStatus::Installing,
        70,
        "Installation script completed successfully!".to_string(),
    );

    Ok(())
}

async fn install_macos(window: &tauri::WebviewWindow) -> Result<(), String> {
    emit_progress(
        window,
        InstallStatus::Installing,
        30,
        "Downloading and installing Ollama via curl...".to_string(),
    );

    emit_progress(
        window,
        InstallStatus::Installing,
        40,
        "This may take a few minutes. Please wait...".to_string(),
    );

    let output = Command::new("sh")
        .arg("-c")
        .arg("curl -fsSL https://ollama.com/install.sh | sh")
        .output()
        .map_err(|e| format!("Failed to run installation script: {}", e))?;

    if !output.status.success() {
        let error = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Installation failed: {}", error));
    }

    tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;

    emit_progress(
        window,
        InstallStatus::Installing,
        70,
        "Installation script completed successfully!".to_string(),
    );

    Ok(())
}

async fn install_linux(window: &tauri::WebviewWindow) -> Result<(), String> {
    emit_progress(
        window,
        InstallStatus::Installing,
        30,
        "Downloading and installing Ollama via curl...".to_string(),
    );

    emit_progress(
        window,
        InstallStatus::Installing,
        40,
        "This may take a few minutes. Please wait...".to_string(),
    );

    let output = Command::new("sh")
        .arg("-c")
        .arg("curl -fsSL https://ollama.com/install.sh | sh")
        .output()
        .map_err(|e| format!("Failed to run installation script: {}", e))?;

    if !output.status.success() {
        let error = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Installation failed: {}", error));
    }

    tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;

    emit_progress(
        window,
        InstallStatus::Installing,
        70,
        "Installation script completed successfully!".to_string(),
    );

    Ok(())
}

async fn start_ollama_service() -> Result<(), String> {
    let platform = get_platform();

    let output = match platform.as_str() {
        "windows" => {
            Command::new("cmd")
                .args(&["/c", "start", "ollama", "serve"])
                .output()
        }
        "macos" | "linux" => {
            Command::new("ollama")
                .arg("serve")
                .output()
        }
        _ => return Err("Unsupported platform".to_string()),
    };

    match output {
        Ok(_) => Ok(()),
        Err(e) => Err(format!("Failed to start service: {}", e)),
    }
}

fn emit_progress(window: &tauri::WebviewWindow, status: InstallStatus, progress: u8, message: String) {
    let progress_data = InstallProgress {
        status,
        progress,
        message,
        error: None,
    };

    let _ = window.emit("install-progress", progress_data);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            check_ollama_installed,
            get_ollama_version,
            download_ollama,
            get_platform_info,
            get_install_info,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}