use serde::{Deserialize, Serialize};
use std::process::{Command, Stdio};
use std::io::{BufRead, BufReader};
use tauri::{Emitter, Manager};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DownloadProgress {
    pub progress: u8,
    pub message: String,
    pub log: Option<String>,
    pub status: DownloadStatus,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum DownloadStatus {
    Idle,
    Downloading,
    Completed,
    Error,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct InstallInfo {
    pub platform: String,
    pub command: String,
    pub estimated_time: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TerminalOutput {
    pub line: String,
    pub stream: String, // "stdout" or "stderr"
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
            "2-3 minutes".to_string(),
        ),
        "macos" => (
            "curl -fsSL https://ollama.com/install.sh | sh".to_string(),
            "2-3 minutes".to_string(),
        ),
        "linux" => (
            "curl -fsSL https://ollama.com/install.sh | sh".to_string(),
            "2-3 minutes".to_string(),
        ),
        _ => return Err("Unsupported platform".to_string()),
    };

    Ok(InstallInfo {
        platform: platform.clone(),
        command,
        estimated_time,
    })
}

#[tauri::command]
async fn download_ollama(app_handle: tauri::AppHandle) -> Result<String, String> {
    let window = app_handle
        .get_webview_window("main")
        .ok_or("Main window not found")?;
    let platform = get_platform();

    emit_progress(
        &window,
        DownloadStatus::Downloading,
        0,
        "Starting download...".to_string(),
        None,
    );

    let download_result = match platform.as_str() {
        "windows" => download_windows(&window).await,
        "macos" => download_macos(&window).await,
        "linux" => download_linux(&window).await,
        _ => Err("Unsupported platform".to_string()),
    };

    if let Err(e) = download_result {
        emit_progress(
            &window,
            DownloadStatus::Error,
            0,
            format!("Download failed: {}", e),
            None,
        );
        return Err(e);
    }

    emit_progress(
        &window,
        DownloadStatus::Completed,
        100,
        "Ollama installed successfully!".to_string(),
        None,
    );

    Ok("Ollama installed successfully".to_string())
}

#[tauri::command]
fn get_platform_info() -> String {
    get_platform()
}

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

async fn download_windows(window: &tauri::WebviewWindow) -> Result<(), String> {
    emit_terminal_output(window, "Starting Ollama installation for Windows...", "info");
    
    let mut child = Command::new("powershell")
        .args(&[
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            "& { $ProgressPreference = 'Continue'; $VerbosePreference = 'Continue'; irm https://ollama.com/install.ps1 | iex }",
        ])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to start PowerShell: {}", e))?;

    let stdout = child.stdout.take().expect("Failed to capture stdout");
    let stderr = child.stderr.take().expect("Failed to capture stderr");

    // Spawn tasks to stream output
    let window_clone = window.clone();
    tokio::spawn(async move {
        let reader = BufReader::new(stdout);
        for line in reader.lines() {
            if let Ok(line) = line {
                if !line.is_empty() {
                    emit_terminal_output(&window_clone, &line, "stdout");
                    // Also update progress based on simple heuristics
                    update_progress_from_line(&window_clone, &line);
                }
            }
        }
    });

    let window_clone2 = window.clone();
    tokio::spawn(async move {
        let reader = BufReader::new(stderr);
        for line in reader.lines() {
            if let Ok(line) = line {
                if !line.is_empty() {
                    emit_terminal_output(&window_clone2, &line, "stderr");
                    update_progress_from_line(&window_clone2, &line);
                }
            }
        }
    });

    let status = child
        .wait()
        .map_err(|e| format!("Failed to wait for installation: {}", e))?;

    if !status.success() {
        return Err("Installation script exited with error".to_string());
    }

    emit_terminal_output(window, "✓ Installation completed successfully!", "success");
    Ok(())
}

async fn download_macos(window: &tauri::WebviewWindow) -> Result<(), String> {
    emit_terminal_output(window, "Starting Ollama installation for macOS...", "info");
    
    let mut child = Command::new("sh")
        .arg("-c")
        .arg("curl -fsSL https://ollama.com/install.sh | sh")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to run installation script: {}", e))?;

    let stdout = child.stdout.take().expect("Failed to capture stdout");
    let stderr = child.stderr.take().expect("Failed to capture stderr");

    let window_clone = window.clone();
    tokio::spawn(async move {
        let reader = BufReader::new(stdout);
        for line in reader.lines() {
            if let Ok(line) = line {
                if !line.is_empty() {
                    emit_terminal_output(&window_clone, &line, "stdout");
                    update_progress_from_line(&window_clone, &line);
                }
            }
        }
    });

    let window_clone2 = window.clone();
    tokio::spawn(async move {
        let reader = BufReader::new(stderr);
        for line in reader.lines() {
            if let Ok(line) = line {
                if !line.is_empty() {
                    emit_terminal_output(&window_clone2, &line, "stderr");
                    update_progress_from_line(&window_clone2, &line);
                }
            }
        }
    });

    let status = child
        .wait()
        .map_err(|e| format!("Failed to wait for installation: {}", e))?;

    if !status.success() {
        return Err("Installation failed".to_string());
    }

    emit_terminal_output(window, "✓ Installation completed successfully!", "success");
    Ok(())
}

async fn download_linux(window: &tauri::WebviewWindow) -> Result<(), String> {
    emit_terminal_output(window, "Starting Ollama installation for Linux...", "info");
    
    let mut child = Command::new("sh")
        .arg("-c")
        .arg("curl -fsSL https://ollama.com/install.sh | sh")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to run installation script: {}", e))?;

    let stdout = child.stdout.take().expect("Failed to capture stdout");
    let stderr = child.stderr.take().expect("Failed to capture stderr");

    let window_clone = window.clone();
    tokio::spawn(async move {
        let reader = BufReader::new(stdout);
        for line in reader.lines() {
            if let Ok(line) = line {
                if !line.is_empty() {
                    emit_terminal_output(&window_clone, &line, "stdout");
                    update_progress_from_line(&window_clone, &line);
                }
            }
        }
    });

    let window_clone2 = window.clone();
    tokio::spawn(async move {
        let reader = BufReader::new(stderr);
        for line in reader.lines() {
            if let Ok(line) = line {
                if !line.is_empty() {
                    emit_terminal_output(&window_clone2, &line, "stderr");
                    update_progress_from_line(&window_clone2, &line);
                }
            }
        }
    });

    let status = child
        .wait()
        .map_err(|e| format!("Failed to wait for installation: {}", e))?;

    if !status.success() {
        return Err("Installation failed".to_string());
    }

    emit_terminal_output(window, "✓ Installation completed successfully!", "success");
    Ok(())
}

fn update_progress_from_line(window: &tauri::WebviewWindow, line: &str) {
    // Simple heuristics to show progress without complex parsing
    let lower = line.to_lowercase();
    
    if lower.contains("download") || lower.contains("curl") {
        emit_progress(window, DownloadStatus::Downloading, 20, "Downloading...".to_string(), Some(line));
    } else if lower.contains("install") && !lower.contains("uninstall") {
        emit_progress(window, DownloadStatus::Downloading, 50, "Installing...".to_string(), Some(line));
    } else if lower.contains("extract") || lower.contains("unzip") {
        emit_progress(window, DownloadStatus::Downloading, 60, "Extracting files...".to_string(), Some(line));
    } else if lower.contains("service") || lower.contains("start") {
        emit_progress(window, DownloadStatus::Downloading, 75, "Starting services...".to_string(), Some(line));
    } else if lower.contains("complete") || lower.contains("success") || lower.contains("installed") {
        emit_progress(window, DownloadStatus::Downloading, 90, "Finalizing...".to_string(), Some(line));
    }
}

fn emit_terminal_output(window: &tauri::WebviewWindow, line: &str, stream_type: &str) {
    let _ = window.emit("terminal-output", TerminalOutput {
        line: line.to_string(),
        stream: stream_type.to_string(),
    });
}

fn emit_progress(
    window: &tauri::WebviewWindow,
    status: DownloadStatus,
    progress: u8,
    message: String,
    log: Option<&str>,
) {
    let progress_data = DownloadProgress {
        status,
        progress,
        message: if message.is_empty() { "Processing...".to_string() } else { message },
        log: log.map(|s| s.to_string()),
    };

    let _ = window.emit("download-progress", progress_data);
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