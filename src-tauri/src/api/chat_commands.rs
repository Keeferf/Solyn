use tauri::{AppHandle, Manager, Emitter};
use crate::core::ollama_chat::{OllamaChatClient, ChatMessage, ChatOptions, ChatEvent};
use std::sync::Arc;
use tokio::sync::Mutex;
use serde::{Deserialize, Serialize};
use serde_json::json;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatRequestData {
    pub model_id: String,
    pub filename: String,
    pub message: String,
    pub temperature: Option<f32>,
    pub top_p: Option<f32>,
    pub top_k: Option<i32>,
    pub num_ctx: Option<i32>,
    pub num_predict: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatStreamData {
    pub model_id: String,
    pub filename: String,
    pub messages: Vec<ChatMessageData>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessageData {
    pub role: String,
    pub content: String,
}

// Store Ollama client in app state
pub struct ChatState {
    pub client: Arc<OllamaChatClient>,
}

// Helper to get or create model name
fn get_ollama_model_name(model_id: &str, filename: &str) -> String {
    let clean_model_id = model_id.replace("/", "_");
    let clean_filename = filename.replace(".gguf", "");
    format!("{}_{}", clean_model_id, clean_filename)
}

// Helper to find the GGUF file in the model directory
fn find_gguf_file(model_dir: &std::path::Path, filename: &str) -> Result<String, String> {
    // First try the exact filename
    let gguf_path = model_dir.join(filename);
    if gguf_path.exists() {
        if let Some(abs_path) = gguf_path.to_str() {
            return Ok(abs_path.replace('\\', "/"));
        }
    }
    
    // Try to find any .gguf file in the directory
    if let Ok(entries) = std::fs::read_dir(model_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if let Some(ext) = path.extension() {
                if ext == "gguf" {
                    if let Some(abs_path) = path.to_str() {
                        return Ok(abs_path.replace('\\', "/"));
                    }
                }
            }
        }
    }
    
    Err(format!("No .gguf file found in {:?}", model_dir))
}

// Helper to replace the FROM path in Modelfile with absolute path
fn replace_from_path(modelfile_content: &str, new_path: &str) -> String {
    let mut result = String::new();
    for line in modelfile_content.lines() {
        if line.trim().starts_with("FROM") {
            result.push_str(&format!("FROM {}", new_path));
        } else {
            result.push_str(line);
        }
        result.push('\n');
    }
    result
}

#[tauri::command]
pub async fn check_ollama_health(app_handle: AppHandle) -> Result<bool, String> {
    let state = app_handle.state::<Arc<Mutex<ChatState>>>();
    let state = state.lock().await;
    state.client.check_health().await
}

#[tauri::command]
pub async fn create_ollama_model(
    app_handle: AppHandle,
    model_id: String,
    filename: String,
) -> Result<String, String> {
    // Get the app data directory
    let app_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;
    
    let model_folder_name = model_id.replace("/", "_");
    let model_dir = app_dir.join("models").join(&model_folder_name);
    
    if !model_dir.exists() {
        return Err(format!("Model directory not found: {:?}", model_dir));
    }
    
    // Find the GGUF file first
    let gguf_abs_path = find_gguf_file(&model_dir, &filename)?;
    println!("📁 Found GGUF file at: {}", gguf_abs_path);
    
    // Find the Modelfile
    let modelfile_path = if let Some(quant) = crate::core::huggingface::extract_quantization(&filename) {
        let modelfile_name = format!("Modelfile_{}", quant.to_uppercase());
        let path = model_dir.join(&modelfile_name);
        if path.exists() {
            Some(path)
        } else {
            let fallback = model_dir.join("Modelfile");
            if fallback.exists() {
                Some(fallback)
            } else {
                None
            }
        }
    } else {
        let path = model_dir.join("Modelfile");
        if path.exists() {
            Some(path)
        } else {
            None
        }
    };
    
    let modelfile_path = modelfile_path
        .ok_or_else(|| format!("Modelfile not found for model: {} and file: {}", model_id, filename))?;
    
    // Read the Modelfile content
    let modelfile_content = std::fs::read_to_string(&modelfile_path)
        .map_err(|e| format!("Failed to read Modelfile: {}", e))?;
    
    println!("📝 Original Modelfile content:\n{}", modelfile_content);
    
    // Replace the FROM path with absolute path
    let updated_modelfile_content = replace_from_path(&modelfile_content, &gguf_abs_path);
    
    println!("📝 Updated Modelfile content:\n{}", updated_modelfile_content);
    
    // Create model in Ollama - pass the GGUF path separately
    let state = app_handle.state::<Arc<Mutex<ChatState>>>();
    let state = state.lock().await;
    let model_name = get_ollama_model_name(&model_id, &filename);
    
    // Pass both the modelfile content and the GGUF path
    state.client.create_model_from_content(&model_name, &updated_modelfile_content, Some(&gguf_abs_path)).await?;
    
    Ok(model_name)
}

#[tauri::command]
pub async fn list_ollama_models(app_handle: AppHandle) -> Result<Vec<String>, String> {
    let state = app_handle.state::<Arc<Mutex<ChatState>>>();
    let state = state.lock().await;
    state.client.list_models().await
}

#[tauri::command]
pub async fn delete_ollama_model(
    app_handle: AppHandle,
    model_name: String,
) -> Result<(), String> {
    let state = app_handle.state::<Arc<Mutex<ChatState>>>();
    let state = state.lock().await;
    state.client.delete_model(&model_name).await
}

#[tauri::command]
pub async fn send_chat_message(
    app_handle: AppHandle,
    request: ChatRequestData,
) -> Result<String, String> {
    let state = app_handle.state::<Arc<Mutex<ChatState>>>();
    let state = state.lock().await;
    
    let model_name = get_ollama_model_name(&request.model_id, &request.filename);
    
    let messages = vec![
        ChatMessage {
            role: "user".to_string(),
            content: request.message,
        }
    ];
    
    let options = ChatOptions {
        temperature: request.temperature,
        top_p: request.top_p,
        top_k: request.top_k,
        num_ctx: request.num_ctx,
        num_predict: request.num_predict,
    };
    
    let response = state.client.chat_sync(&model_name, messages, Some(options)).await?;
    
    Ok(response.message.content)
}

#[tauri::command]
pub async fn send_chat_stream(
    app_handle: AppHandle,
    request: ChatStreamData,
) -> Result<(), String> {
    let window = app_handle
        .get_webview_window("main")
        .ok_or("Main window not found")?;
    
    let state = app_handle.state::<Arc<Mutex<ChatState>>>();
    let state = state.lock().await;
    
    let model_name = get_ollama_model_name(&request.model_id, &request.filename);
    
    let messages: Vec<ChatMessage> = request.messages
        .iter()
        .map(|m| ChatMessage {
            role: m.role.clone(),
            content: m.content.clone(),
        })
        .collect();
    
    let mut receiver = state.client.chat_stream(&model_name, messages, None).await?;
    
    // Process streaming responses and emit events to frontend
    tokio::spawn(async move {
        while let Some(event) = receiver.recv().await {
            match event {
                ChatEvent::MessageChunk(chunk) => {
                    let _ = window.emit("chat-stream-chunk", json!({ "chunk": chunk }));
                }
                ChatEvent::Done(response) => {
                    let _ = window.emit("chat-stream-done", json!({ "response": response }));
                }
                ChatEvent::Error(error) => {
                    let _ = window.emit("chat-stream-error", json!({ "error": error }));
                }
            }
        }
    });
    
    Ok(())
}

// Initialize the chat state
pub fn init_chat_state(app: &tauri::App) {
    let chat_state = ChatState {
        client: Arc::new(OllamaChatClient::new()),
    };
    app.manage(Arc::new(Mutex::new(chat_state)));
}