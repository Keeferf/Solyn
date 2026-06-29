use serde::{Deserialize, Serialize};
use tauri::{Emitter, Manager};
use tauri_plugin_shell::ShellExt;


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
    pub stream: String, // "stdout", "stderr", "info", "success"
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

    let download_result = download_with_pty(&app_handle, &window, &platform).await;

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

// Helper function to clean output lines
fn clean_output_line(line: &str) -> String {
    let trimmed = line.trim();
    
    // Remove common prefixes that might be added by the script or shell
    let cleaned = trimmed
        .trim_start_matches("> ")
        .trim_start_matches(">>> ")
        .trim_start_matches(">> ")
        .trim_start_matches("$ ")
        .trim_start_matches("# ")
        .trim_start_matches("VERBOSE: ");
    
    // If the line is just a prefix character or empty, return empty
    if cleaned.is_empty() || cleaned == ">" || cleaned == ">>>" || cleaned == ">>" {
        return String::new();
    }
    
    // Remove specific verbose messages
    if cleaned.contains("GET with") && cleaned.contains("payload") {
        return String::new();
    }
    if cleaned.contains("received") && cleaned.contains("response of content type") {
        return String::new();
    }
    
    cleaned.to_string()
}

// Helper function to strip ANSI escape sequences
fn strip_ansi_escapes(text: &str) -> String {
    let mut result = String::with_capacity(text.len());
    let mut chars = text.chars().peekable();
    let mut in_escape = false;
    let mut in_bracket = false;
    
    while let Some(c) = chars.next() {
        if c == '\x1b' {
            in_escape = true;
            in_bracket = false;
            continue;
        }
        
        if in_escape {
            if c == '[' {
                in_bracket = true;
                continue;
            }
            
            if in_bracket {
                // Check if we're at the end of an ANSI sequence
                if c.is_ascii_alphabetic() || c == '@' {
                    in_escape = false;
                    in_bracket = false;
                    continue;
                }
                continue;
            } else {
                // Single character escape
                if c.is_ascii_alphabetic() {
                    in_escape = false;
                    continue;
                }
            }
        } else {
            result.push(c);
        }
    }
    
    result
}

async fn download_with_pty(
    app_handle: &tauri::AppHandle,
    window: &tauri::WebviewWindow,
    platform: &str,
) -> Result<(), String> {
    let window_clone = window.clone();
    let shell = app_handle.shell();
    
    let (shell_cmd, script_cmd) = match platform {
        "windows" => ("powershell", "irm https://ollama.com/install.ps1 | iex"),
        "macos" => ("sh", "curl -fsSL https://ollama.com/install.sh | sh"),
        "linux" => ("sh", "curl -fsSL https://ollama.com/install.sh | sh"),
        _ => return Err("Unsupported platform".to_string()),
    };

    emit_terminal_output(&window_clone, format!("Running installer for {}", platform).as_str(), "info");

    let (mut rx, _child) = shell
        .command(shell_cmd)
        .args(&["-c", script_cmd])
        .spawn()
        .map_err(|e| format!("Failed to spawn process: {}", e))?;

    // Stream output in real-time
    while let Some(event) = rx.recv().await {
        match event {
            tauri_plugin_shell::process::CommandEvent::Stdout(data) => {
                if let Ok(text) = String::from_utf8(data) {
                    for line in text.lines() {
                        let stripped = strip_ansi_escapes(line);
                        let cleaned = clean_output_line(&stripped);
                        
                        if !cleaned.is_empty() {
                            emit_terminal_output(&window_clone, &cleaned, "stdout");
                        }
                    }
                }
            }
            tauri_plugin_shell::process::CommandEvent::Stderr(data) => {
                if let Ok(text) = String::from_utf8(data) {
                    for line in text.lines() {
                        let stripped = strip_ansi_escapes(line);
                        let cleaned = clean_output_line(&stripped);
                        
                        if !cleaned.is_empty() {
                            emit_terminal_output(&window_clone, &cleaned, "stderr");
                        }
                    }
                }
            }
            tauri_plugin_shell::process::CommandEvent::Terminated(status) => {
                let msg = if status.code == Some(0) {
                    "Process completed successfully"
                } else {
                    "Process terminated with error"
                };
                emit_terminal_output(&window_clone, msg, "info");
            }
            _ => {}
        }
    }

    // Verify installation
    tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
    if let Ok(true) = check_ollama_installed().await {
        emit_terminal_output(&window, "✓ Ollama verified and running!", "success");
        Ok(())
    } else {
        emit_terminal_output(&window, "⚠️ Installation may be complete but Ollama verification failed.", "info");
        emit_terminal_output(&window, "Please run 'ollama serve' manually if needed.", "info");
        Ok(())
    }
}

fn emit_terminal_output(window: &tauri::WebviewWindow, line: &str, stream_type: &str) {
    let cleaned_line = clean_output_line(line);
    if cleaned_line.is_empty() {
        return;
    }
    
    let _ = window.emit("terminal-output", TerminalOutput {
        line: cleaned_line,
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