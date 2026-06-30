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
    pub stream: String,
    pub is_progress: bool,
}

// Model management structs
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

// Hugging Face structs - only for GGUF models
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct HuggingFaceModel {
    pub id: String,
    pub description: Option<String>,
    pub pipeline_tag: Option<String>,
    pub likes: Option<u64>,
    pub downloads: Option<u64>,
    pub size: Option<u64>,
    pub last_modified: Option<String>,
    pub license: Option<String>,
    pub tags: Option<Vec<String>>,
    pub gguf_file: Option<String>, // The GGUF filename
    pub is_installed: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ModelDownloadProgress {
    pub model_id: String,
    pub status: String, // "downloading", "converting", "complete", "error"
    pub progress: u8,
    pub message: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GGUFModelInfo {
    pub filename: String,
    pub size: u64,
    pub quantization: String,
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

// Updated: Search Hugging Face models - only show GGUF models
#[tauri::command]
async fn search_huggingface_models(
    app_handle: tauri::AppHandle,
    query: String,
    limit: Option<usize>,
) -> Result<Vec<HuggingFaceModel>, String> {
    let limit = limit.unwrap_or(20);
    let client = reqwest::Client::new();
    
    // Search for models with GGUF files
    let url = format!(
        "https://huggingface.co/api/models?search={}+GGUF&limit={}&sort=downloads",
        query, limit
    );
    
    let response = client
        .get(&url)
        .header("User-Agent", "SolynApp/1.0")
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
        .map_err(|e| format!("Failed to search Hugging Face: {}", e))?;
    
    if !response.status().is_success() {
        return Err(format!("Hugging Face API error: {}", response.status()));
    }
    
    let data: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;
    
    let installed_models = get_installed_model_names().await;
    
    let mut models = Vec::new();
    
    for item in data.as_array().ok_or("Invalid response format")? {
        let id = item["id"].as_str().unwrap_or("").to_string();
        if id.is_empty() {
            continue;
        }
        
        // Check if this model has GGUF files
        let siblings = item["siblings"].as_array();
        let gguf_files = find_gguf_files(siblings);
        
        if gguf_files.is_empty() {
            continue; // Skip models without GGUF files
        }
        
        // Get the first GGUF file (usually the main one)
        let gguf_file = gguf_files.first().cloned();
        
        let model_name = id.replace("/", ":");
        let is_installed = installed_models.contains(&model_name);
        
        models.push(HuggingFaceModel {
            id: id.clone(),
            description: item["description"].as_str().map(|s| s.to_string()),
            pipeline_tag: item["pipeline_tag"].as_str().map(|s| s.to_string()),
            likes: item["likes"].as_u64(),
            downloads: item["downloads"].as_u64(),
            size: gguf_file.as_ref().map(|f| f.size),
            last_modified: item["lastModified"].as_str().map(|s| s.to_string()),
            license: item["license"].as_str().map(|s| s.to_string()),
            tags: item["tags"]
                .as_array()
                .map(|arr| {
                    arr.iter()
                        .filter_map(|t| t.as_str().map(|s| s.to_string()))
                        .collect()
                }),
            gguf_file: gguf_file.map(|f| f.filename),
            is_installed,
        });
    }
    
    Ok(models)
}

// New command: Download GGUF model from Hugging Face
#[tauri::command]
async fn download_huggingface_model(
    app_handle: tauri::AppHandle,
    model_id: String,
) -> Result<String, String> {
    let window = app_handle
        .get_webview_window("main")
        .ok_or("Main window not found")?;
    
    let window_clone = window.clone();
    let model_id_clone = model_id.clone();
    
    tokio::spawn(async move {
        emit_download_progress(&window_clone, &model_id_clone, "downloading", 0, "Starting download...");
        
        // Get GGUF file info
        let gguf_info = match get_gguf_file_info(&model_id_clone).await {
            Ok(info) => info,
            Err(e) => {
                emit_download_progress(&window_clone, &model_id_clone, "error", 0, &format!("Failed to find GGUF file: {}", e));
                let _ = window_clone.emit("model-download-error", format!("Error finding GGUF for {}: {}", model_id_clone, e));
                return;
            }
        };
        
        emit_download_progress(&window_clone, &model_id_clone, "downloading", 20, 
            &format!("Downloading GGUF file: {}", gguf_info.filename));
        
        // Download the GGUF file
        if let Err(e) = download_gguf_file(&window_clone, &model_id_clone, &gguf_info).await {
            emit_download_progress(&window_clone, &model_id_clone, "error", 0, &format!("Download failed: {}", e));
            let _ = window_clone.emit("model-download-error", format!("Error downloading {}: {}", model_id_clone, e));
            return;
        }
        
        emit_download_progress(&window_clone, &model_id_clone, "converting", 70, "Creating Modelfile for Ollama...");
        
        // Create Modelfile for Ollama
        if let Err(e) = create_modelfile_for_gguf(&window_clone, &model_id_clone, &gguf_info).await {
            emit_download_progress(&window_clone, &model_id_clone, "error", 0, &format!("Failed to create Modelfile: {}", e));
            let _ = window_clone.emit("model-download-error", format!("Error creating Modelfile for {}: {}", model_id_clone, e));
            return;
        }
        
        emit_download_progress(&window_clone, &model_id_clone, "converting", 85, "Importing model into Ollama...");
        
        if let Err(e) = import_model_to_ollama(&model_id_clone).await {
            emit_download_progress(&window_clone, &model_id_clone, "error", 0, &format!("Failed to import model: {}", e));
            let _ = window_clone.emit("model-download-error", format!("Error importing {} to Ollama: {}", model_id_clone, e));
            return;
        }
        
        emit_download_progress(&window_clone, &model_id_clone, "complete", 100, "Model installed successfully!");
    });
    
    Ok(format!("Started downloading model: {}", model_id))
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
    
    let cleaned = trimmed
        .trim_start_matches("> ")
        .trim_start_matches(">>> ")
        .trim_start_matches(">> ")
        .trim_start_matches("$ ")
        .trim_start_matches("# ")
        .trim_start_matches("VERBOSE: ");

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
                if c.is_ascii_alphabetic() || c == '@' {
                    in_escape = false;
                    in_bracket = false;
                    continue;
                }
                continue;
            } else {
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

// Helper function to process output stream
fn process_output_stream(window: &tauri::WebviewWindow, text: &str, stream_type: &str) {
    let mut current_line = String::new();
    
    for ch in text.chars() {
        match ch {
            '\r' => {
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

    emit_terminal_output(window, "Verifying Ollama installation...", "info", false);
    
    let max_attempts = 15;
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
                if attempts < max_attempts && attempts % 3 == 0 {
                    emit_terminal_output(window, &format!("Waiting for Ollama to start... (attempt {}/{})", attempts, max_attempts), "info", false);
                }
            }
            Err(_e) => {
                if attempts < max_attempts && attempts % 3 == 0 {
                    emit_terminal_output(window, &format!("Checking Ollama status... (attempt {}/{})", attempts, max_attempts), "info", false);
                }
            }
        }
    }
    
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
            Ok(())
        }
    }
}

// ============ GGUF Helper Functions ============

#[derive(Debug, Clone)]
struct GGUFFileInfo {
    filename: String,
    size: u64,
    quantization: String,
}

fn find_gguf_files(siblings: Option<&Vec<serde_json::Value>>) -> Vec<GGUFFileInfo> {
    let mut gguf_files = Vec::new();
    
    if let Some(siblings) = siblings {
        for file in siblings {
            let filename = file["rfilename"].as_str().unwrap_or("");
            
            // Check if it's a GGUF file
            if filename.ends_with(".gguf") {
                let size = file["size"].as_u64().unwrap_or(0);
                
                // Try to extract quantization from filename
                let quantization = extract_quantization(filename);
                
                gguf_files.push(GGUFFileInfo {
                    filename: filename.to_string(),
                    size,
                    quantization,
                });
            }
        }
    }
    
    // Sort by size (largest first, usually the main model)
    gguf_files.sort_by(|a, b| b.size.cmp(&a.size));
    gguf_files
}

fn extract_quantization(filename: &str) -> String {
    // Common GGUF quantization patterns
    let quant_patterns = [
        "Q8_0", "Q8_1", "Q6_K", "Q5_K", "Q5_0", "Q5_1",
        "Q4_K", "Q4_0", "Q4_1", "Q3_K", "Q3_0", "Q3_1",
        "Q2_K", "IQ4_NL", "IQ3_XS", "IQ2_XS", "FP16", "FP32",
    ];
    
    for pattern in quant_patterns {
        if filename.contains(pattern) {
            return pattern.to_string();
        }
    }
    
    "Unknown".to_string()
}

async fn get_installed_model_names() -> Vec<String> {
    if let Ok(models) = list_ollama_models().await {
        models.into_iter().map(|m| m.name).collect()
    } else {
        Vec::new()
    }
}

async fn get_gguf_file_info(model_id: &str) -> Result<GGUFFileInfo, String> {
    let client = reqwest::Client::new();
    let info_url = format!("https://huggingface.co/api/models/{}", model_id);
    
    let response = client
        .get(&info_url)
        .header("User-Agent", "SolynApp/1.0")
        .send()
        .await
        .map_err(|e| format!("Failed to get model info: {}", e))?;
    
    let data: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse model info: {}", e))?;
    
    let siblings = data["siblings"]
        .as_array()
        .ok_or("No files found for model")?;
    
    let gguf_files = find_gguf_files(Some(siblings));
    
    if gguf_files.is_empty() {
        return Err("No GGUF files found in this model repository".to_string());
    }
    
    // Return the largest GGUF file (usually the main model)
    Ok(gguf_files.first().cloned().unwrap())
}

async fn download_gguf_file(
    window: &tauri::WebviewWindow,
    model_id: &str,
    gguf_info: &GGUFFileInfo,
) -> Result<(), String> {
    let client = reqwest::Client::new();
    
    let model_name = model_id.replace("/", "-");
    let download_dir = std::path::Path::new("models").join(&model_name);
    std::fs::create_dir_all(&download_dir)
        .map_err(|e| format!("Failed to create model directory: {}", e))?;
    
    let file_url = format!(
        "https://huggingface.co/{}/resolve/main/{}",
        model_id, gguf_info.filename
    );
    
    emit_download_progress(
        window,
        model_id,
        "downloading",
        30,
        &format!("Downloading {} ({:.1} MB)...", 
            gguf_info.filename,
            gguf_info.size as f64 / 1024.0 / 1024.0
        )
    );
    
    let response = client
        .get(&file_url)
        .header("User-Agent", "SolynApp/1.0")
        .send()
        .await
        .map_err(|e| format!("Failed to download GGUF file: {}", e))?;
    
    if !response.status().is_success() {
        return Err(format!("HTTP error: {}", response.status()));
    }
    
    let total_size = response.content_length().unwrap_or(gguf_info.size);
    let mut downloaded = 0u64;
    let mut stream = response.bytes_stream();
    
    use futures_util::StreamExt;
    let file_path = download_dir.join(&gguf_info.filename);
    let mut file = tokio::fs::File::create(&file_path)
        .await
        .map_err(|e| format!("Failed to create file: {}", e))?;
    
    use tokio::io::AsyncWriteExt;
    
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("Download error: {}", e))?;
        downloaded += chunk.len() as u64;
        
        file.write_all(&chunk)
            .await
            .map_err(|e| format!("Failed to write file: {}", e))?;
        
        if total_size > 0 {
            let progress = 30 + ((downloaded as f64 / total_size as f64) * 40.0) as u8;
            let percent = (downloaded as f64 / total_size as f64) * 100.0;
            emit_download_progress(
                window,
                model_id,
                "downloading",
                progress.min(70),
                &format!("Downloading... {:.1}%", percent)
            );
        }
    }
    
    file.flush().await.map_err(|e| format!("Failed to flush file: {}", e))?;
    
    Ok(())
}

async fn create_modelfile_for_gguf(
    window: &tauri::WebviewWindow,
    model_id: &str,
    gguf_info: &GGUFFileInfo,
) -> Result<(), String> {
    let model_name = model_id.replace("/", "-");
    let model_dir = std::path::Path::new("models").join(&model_name);
    let gguf_path = model_dir.join(&gguf_info.filename);
    
    if !gguf_path.exists() {
        return Err("GGUF file not found".to_string());
    }
    
    // Create a Modelfile that points to the GGUF file
    let modelfile_content = format!(
        r#"FROM {}
TEMPLATE "{{ .Prompt }}"
SYSTEM "You are a helpful AI assistant."

# Model parameters
PARAMETER temperature 0.7
PARAMETER top_p 0.9
PARAMETER top_k 40
PARAMETER repeat_penalty 1.1

# GGUF quantization: {}
"#,
        gguf_path.display(),
        gguf_info.quantization
    );
    
    let modelfile_path = model_dir.join("Modelfile");
    std::fs::write(modelfile_path, modelfile_content)
        .map_err(|e| format!("Failed to create Modelfile: {}", e))?;
    
    emit_download_progress(window, model_id, "converting", 75, "Modelfile created successfully");
    
    Ok(())
}

async fn import_model_to_ollama(model_id: &str) -> Result<(), String> {
    let model_name = model_id.replace("/", "-");
    let model_dir = std::path::Path::new("models").join(&model_name);
    let modelfile_path = model_dir.join("Modelfile");
    
    if !modelfile_path.exists() {
        return Err("Modelfile not found".to_string());
    }
    
    let modelfile_content = std::fs::read_to_string(modelfile_path)
        .map_err(|e| format!("Failed to read Modelfile: {}", e))?;
    
    let client = reqwest::Client::new();
    let payload = serde_json::json!({
        "name": model_name,
        "modelfile": modelfile_content,
        "stream": false,
    });
    
    let response = client
        .post("http://localhost:11434/api/create")
        .json(&payload)
        .timeout(std::time::Duration::from_secs(300)) // 5 minute timeout for large models
        .send()
        .await
        .map_err(|e| format!("Failed to create model in Ollama: {}", e))?;
    
    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("Ollama create failed: {}", error_text));
    }
    
    Ok(())
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

fn emit_download_progress(
    window: &tauri::WebviewWindow,
    model_id: &str,
    status: &str,
    progress: u8,
    message: &str,
) {
    let progress_data = ModelDownloadProgress {
        model_id: model_id.to_string(),
        status: status.to_string(),
        progress,
        message: message.to_string(),
    };
    
    let _ = window.emit("model-download-progress", progress_data);
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
            search_huggingface_models,
            download_huggingface_model,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}