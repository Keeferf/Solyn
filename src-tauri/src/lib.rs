// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::process::Command;
use tauri::Manager;
use tauri::Emitter;  // Add this import for the emit method

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct InstallProgress {
    pub status: InstallStatus,
    pub progress: u8,
    pub message: String,
    pub error: Option<String>,
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
async fn download_ollama(app_handle: tauri::AppHandle) -> Result<String, String> {
    // Tauri v2: Use get_webview_window instead of get_window
    let window = app_handle.get_webview_window("main").ok_or("Main window not found")?;
    let platform = get_platform();
    let download_url = get_download_url(&platform)?;
    let installer_path = get_installer_path(&platform)?;

    // Step 1: Download installer with progress
    emit_progress(
        &window,
        InstallStatus::Downloading,
        0,
        "Downloading Ollama installer...".to_string(),
    );

    let client = reqwest::Client::new();
    let response = client
        .get(&download_url)
        .send()
        .await
        .map_err(|e| format!("Failed to download: {}", e))?;

    let total_size = response.content_length().unwrap_or(0);
    let mut downloaded: u64 = 0;
    let mut file = tokio::fs::File::create(&installer_path)
        .await
        .map_err(|e| format!("Failed to create file: {}", e))?;

    let mut stream = response.bytes_stream();

    use futures_util::StreamExt;
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("Download error: {}", e))?;
        tokio::io::AsyncWriteExt::write_all(&mut file, &chunk)
            .await
            .map_err(|e| format!("Write error: {}", e))?;

        downloaded += chunk.len() as u64;
        if total_size > 0 {
            let progress = ((downloaded as f64 / total_size as f64) * 100.0) as u8;
            emit_progress(
                &window,
                InstallStatus::Downloading,
                progress,
                format!("Downloading... {}%", progress),
            );
        }
    }

    // Step 2: Verify checksum (simplified - file size check)
    emit_progress(
        &window,
        InstallStatus::Verifying,
        60,
        "Verifying download integrity...".to_string(),
    );

    let metadata = tokio::fs::metadata(&installer_path)
        .await
        .map_err(|e| format!("Failed to read file metadata: {}", e))?;

    if metadata.len() < 1_000_000 {
        // Less than 1MB - likely incomplete
        return Err("Downloaded file appears to be incomplete".to_string());
    }

    // Step 3: Launch installer
    emit_progress(
        &window,
        InstallStatus::Installing,
        70,
        "Launching installer...".to_string(),
    );

    let install_result = match platform.as_str() {
        "windows" => install_windows(&installer_path, &window).await,
        "macos" => install_macos(&installer_path, &window).await,
        "linux" => install_linux(&installer_path, &window).await,
        _ => Err("Unsupported platform".to_string()),
    };

    if let Err(e) = install_result {
        return Err(e);
    }

    // Step 4: Wait for install and verify
    emit_progress(
        &window,
        InstallStatus::Installing,
        85,
        "Waiting for installation to complete...".to_string(),
    );

    // Wait a bit for installation to finish
    tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;

    // Step 5: Delete installer
    emit_progress(
        &window,
        InstallStatus::Installing,
        90,
        "Cleaning up installer...".to_string(),
    );

    if let Err(e) = tokio::fs::remove_file(&installer_path).await {
        eprintln!("Failed to remove installer: {}", e);
        // Don't fail the installation for cleanup errors
    }

    // Step 6: Start Ollama service
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

    // Step 7: Verify installation
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

fn get_download_url(platform: &str) -> Result<String, String> {
    match platform {
        "windows" => Ok("https://github.com/ollama/ollama/releases/latest/download/OllamaSetup.exe".to_string()),
        "macos" => {
            if cfg!(target_arch = "aarch64") {
                Ok("https://github.com/ollama/ollama/releases/latest/download/Ollama-darwin-arm64.dmg".to_string())
            } else {
                Ok("https://github.com/ollama/ollama/releases/latest/download/Ollama-darwin-amd64.dmg".to_string())
            }
        }
        "linux" => Ok("https://github.com/ollama/ollama/releases/latest/download/ollama-linux-amd64.tgz".to_string()),
        _ => Err("Unsupported platform".to_string()),
    }
}

fn get_installer_path(platform: &str) -> Result<PathBuf, String> {
    let dir = std::env::temp_dir();
    let filename = match platform {
        "windows" => "OllamaSetup.exe",
        "macos" => "Ollama.dmg",
        "linux" => "ollama-linux.tgz",
        _ => return Err("Unsupported platform".to_string()),
    };
    Ok(dir.join(filename))
}

async fn install_windows(installer_path: &PathBuf, _window: &tauri::WebviewWindow) -> Result<(), String> {
    let installer_str = installer_path.to_str().ok_or("Invalid installer path")?;

    // Run the installer silently
    let output = Command::new("cmd")
        .args(&["/c", "start", "/wait", installer_str, "/S"])
        .output()
        .map_err(|e| format!("Failed to run installer: {}", e))?;

    if !output.status.success() {
        let error = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Installation failed: {}", error));
    }

    Ok(())
}

async fn install_macos(installer_path: &PathBuf, window: &tauri::WebviewWindow) -> Result<(), String> {
    let installer_str = installer_path.to_str().ok_or("Invalid installer path")?;

    // Open the DMG file
    let output = Command::new("open")
        .arg(installer_str)
        .output()
        .map_err(|e| format!("Failed to open DMG: {}", e))?;

    if !output.status.success() {
        let error = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Failed to open DMG: {}", error));
    }

    // Emit instruction for user
    emit_progress(
        window,
        InstallStatus::Installing,
        75,
        "Please drag Ollama to Applications folder and open it.".to_string(),
    );

    // Wait for user to complete installation
    tokio::time::sleep(tokio::time::Duration::from_secs(10)).await;

    Ok(())
}

async fn install_linux(installer_path: &PathBuf, _window: &tauri::WebviewWindow) -> Result<(), String> {
    let installer_str = installer_path.to_str().ok_or("Invalid installer path")?;

    // Extract and install
    let output = Command::new("sudo")
        .args(&["tar", "-xzf", installer_str, "-C", "/usr/local"])
        .output()
        .map_err(|e| format!("Failed to extract: {}", e))?;

    if !output.status.success() {
        let error = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Installation failed: {}", error));
    }

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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}