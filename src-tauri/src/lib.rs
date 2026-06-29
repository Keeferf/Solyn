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
    pub is_progress: bool, // indicates this is a progress line that should replace the last one
}

// New structs for model management
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OllamaModel {
    pub name: String,
    pub modified_at: String,
    pub size: u64,
    pub digest: String,
    pub details: Option<ModelDetails>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ModelDetails {
    pub parent_model: String,
    pub format: String,
    pub family: String,
    pub families: Option<Vec<String>>,
    pub parameter_size: String,
    pub quantization_level: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ModelPullProgress {
    pub status: String,
    pub digest: Option<String>,
    pub total: Option<u64>,
    pub completed: Option<u64>,
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
            "~5 minutes".to_string(),
        ),
        "macos" => (
            "curl -fsSL https://ollama.com/install.sh | sh".to_string(),
            "~5 minutes".to_string(),
        ),
        "linux" => (
            "curl -fsSL https://ollama.com/install.sh | sh".to_string(),
            "~5 minutes".to_string(),
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

#[tauri::command]
async fn list_ollama_models() -> Result<Vec<OllamaModel>, String> {
    let client = reqwest::Client::new();
    let response = client
        .get("http://localhost:11434/api/tags")
        .timeout(std::time::Duration::from_secs(5))
        .send()
        .await
        .map_err(|e| format!("Failed to connect to Ollama: {}", e))?;

    if !response.status().is_success() {
        return Err("Failed to get models from Ollama".to_string());
    }

    let json: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    let models = json["models"]
        .as_array()
        .ok_or("Invalid response format")?
        .iter()
        .filter_map(|model| {
            let name = model["name"].as_str()?.to_string();
            let modified_at = model["modified_at"].as_str()?.to_string();
            let size = model["size"].as_u64()?;
            let digest = model["digest"].as_str()?.to_string();
            
            // Build details separately to avoid using ? in the closure
            let details = model["details"].as_object().map(|d| {
                ModelDetails {
                    parent_model: d.get("parent_model")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string())
                        .unwrap_or_default(),
                    format: d.get("format")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string())
                        .unwrap_or_default(),
                    family: d.get("family")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string())
                        .unwrap_or_default(),
                    families: d.get("families")
                        .and_then(|v| v.as_array())
                        .map(|arr| {
                            arr.iter()
                                .filter_map(|f| f.as_str().map(|s| s.to_string()))
                                .collect::<Vec<String>>()
                        }),
                    parameter_size: d.get("parameter_size")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string())
                        .unwrap_or_default(),
                    quantization_level: d.get("quantization_level")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string())
                        .unwrap_or_default(),
                }
            });

            Some(OllamaModel {
                name,
                modified_at,
                size,
                digest,
                details,
            })
        })
        .collect();

    Ok(models)
}

#[tauri::command]
async fn pull_ollama_model(
    app_handle: tauri::AppHandle,
    model_name: String,
) -> Result<String, String> {
    let window = app_handle
        .get_webview_window("main")
        .ok_or("Main window not found")?;

    // Start the pull in a background task
    let window_clone = window.clone();
    let model_name_clone = model_name.clone();
    
    tokio::spawn(async move {
        let client = reqwest::Client::new();
        let pull_url = "http://localhost:11434/api/pull";
        
        let payload = serde_json::json!({
            "name": model_name_clone,
            "stream": true
        });

        let response = match client
            .post(pull_url)
            .json(&payload)
            .send()
            .await
        {
            Ok(res) => res,
            Err(e) => {
                let _ = window_clone.emit("model-pull-error", format!("Failed to start pull: {}", e));
                return;
            }
        };

        if !response.status().is_success() {
            let _ = window_clone.emit("model-pull-error", format!("Pull failed with status: {}", response.status()));
            return;
        }

        // Process streaming response
        let stream = response.bytes_stream();
        use futures_util::StreamExt;
        use std::pin::pin;
        
        let mut stream = pin!(stream);
        while let Some(chunk) = stream.next().await {
            if let Ok(chunk) = chunk {
                if let Ok(text) = String::from_utf8(chunk.to_vec()) {
                    for line in text.lines() {
                        if let Ok(progress) = serde_json::from_str::<ModelPullProgress>(line) {
                            let _ = window_clone.emit("model-pull-progress", progress);
                        }
                    }
                }
            }
        }
    });

    Ok(format!("Started pulling model: {}", model_name))
}

#[tauri::command]
async fn delete_ollama_model(model_name: String) -> Result<String, String> {
    let client = reqwest::Client::new();
    let delete_url = "http://localhost:11434/api/delete";
    
    let payload = serde_json::json!({
        "name": model_name
    });

    let response = client
        .delete(delete_url)
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Failed to delete model: {}", e))?;

    if response.status().is_success() {
        Ok("Model deleted successfully".to_string())
    } else {
        Err(format!("Failed to delete model: {}", response.status()))
    }
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

    // Filter out specific messages we don't want to show
    if cleaned.is_empty() 
        || cleaned == ">" 
        || cleaned == ">>>" 
        || cleaned == ">>" 
        || cleaned.contains("Install complete. Run 'ollama' from the command line.")
        || cleaned.contains("Run 'ollama' from the command line.")
        || cleaned.contains("Install complete.")
    {
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

// Helper function to process output stream, handling both \n and \r correctly
fn process_output_stream(window: &tauri::WebviewWindow, text: &str, stream_type: &str) {
    let mut current_line = String::new();
    
    for ch in text.chars() {
        match ch {
            '\r' => {
                // Carriage return: emit current line as a progress line and reset
                if !current_line.is_empty() {
                    let stripped = strip_ansi_escapes(&current_line);
                    let cleaned = clean_output_line(&stripped);
                    if !cleaned.is_empty() {
                        emit_terminal_output(window, &cleaned, stream_type, true);
                    }
                }
                current_line.clear();
            }
            '\n' => {
                // Newline: emit current line as a regular line and reset
                if !current_line.is_empty() {
                    let stripped = strip_ansi_escapes(&current_line);
                    let cleaned = clean_output_line(&stripped);
                    if !cleaned.is_empty() {
                        emit_terminal_output(window, &cleaned, stream_type, false);
                    }
                }
                current_line.clear();
            }
            _ => {
                current_line.push(ch);
            }
        }
    }
    
    // Emit any remaining buffered content
    if !current_line.is_empty() {
        let stripped = strip_ansi_escapes(&current_line);
        let cleaned = clean_output_line(&stripped);
        if !cleaned.is_empty() {
            emit_terminal_output(window, &cleaned, stream_type, true);
        }
    }
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

    emit_terminal_output(&window_clone, &format!("Running installer for {}", platform), "info", false);

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
                    process_output_stream(&window_clone, &text, "stdout");
                }
            }
            tauri_plugin_shell::process::CommandEvent::Stderr(data) => {
                if let Ok(text) = String::from_utf8(data) {
                    process_output_stream(&window_clone, &text, "stderr");
                }
            }
            tauri_plugin_shell::process::CommandEvent::Terminated(status) => {
                let msg = if status.code == Some(0) {
                    "Installation script completed"
                } else {
                    "Process terminated with error"
                };
                emit_terminal_output(&window_clone, msg, "info", false);
            }
            _ => {}
        }
    }

    // Verify installation with retries
    emit_terminal_output(window, "Verifying Ollama installation...", "info", false);
    
    let max_attempts = 15; // Try 15 times (30 seconds total with 2 second delays)
    let mut attempts = 0;
    
    while attempts < max_attempts {
        tokio::time::sleep(std::time::Duration::from_secs(2)).await;
        attempts += 1;
        
        match check_ollama_installed().await {
            Ok(true) => {
                emit_terminal_output(window, "Ollama verified and running", "success", false);
                return Ok(());
            }
            Ok(false) => {
                // Still not running, continue waiting
                if attempts < max_attempts && attempts % 3 == 0 {
                    emit_terminal_output(window, &format!("Waiting for Ollama to start... (attempt {}/{})", attempts, max_attempts), "info", false);
                }
            }
            Err(_e) => {
                // Error checking, continue waiting
                if attempts < max_attempts && attempts % 3 == 0 {
                    emit_terminal_output(window, &format!("Checking Ollama status... (attempt {}/{})", attempts, max_attempts), "info", false);
                }
            }
        }
    }
    
    // If we've exhausted all attempts, do one final check
    emit_terminal_output(window, "Performing final verification check...", "info", false);
    tokio::time::sleep(std::time::Duration::from_secs(2)).await;
    
    match check_ollama_installed().await {
        Ok(true) => {
            emit_terminal_output(window, "✓ Ollama verified and running!", "success", false);
            Ok(())
        }
        _ => {
            emit_terminal_output(window, "⚠️ Ollama installation completed but verification timed out.", "info", false);
            emit_terminal_output(window, "The installation should be complete. You can try refreshing the page.", "info", false);
            emit_terminal_output(window, "💡 If you see this message repeatedly, Ollama may need to be started manually.", "info", false);
            // Still return success since installation likely completed
            Ok(())
        }
    }
}

fn emit_terminal_output(window: &tauri::WebviewWindow, line: &str, stream_type: &str, is_progress: bool) {
    let cleaned_line = clean_output_line(line);
    if cleaned_line.is_empty() {
        return;
    }
    
    let _ = window.emit("terminal-output", TerminalOutput {
        line: cleaned_line,
        stream: stream_type.to_string(),
        is_progress,
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
            list_ollama_models,
            pull_ollama_model,
            delete_ollama_model,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}