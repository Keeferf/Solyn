use tauri::{AppHandle, Manager, Emitter};
use crate::core::ollama_chat::{OllamaChatClient, ChatMessage, ChatOptions, ChatEvent};
use std::sync::Arc;
use tokio::sync::Mutex;
use serde::{Deserialize, Serialize};
use serde_json::json;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatRequestData {
    pub model: String,  // Now uses the Ollama model name directly
    pub message: String,
    pub temperature: Option<f32>,
    pub top_p: Option<f32>,
    pub top_k: Option<i32>,
    pub num_ctx: Option<i32>,
    pub num_predict: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatStreamData {
    pub model: String,
    pub messages: Vec<ChatMessageData>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessageData {
    pub role: String,
    pub content: String,
}

// Store Ollama chat client in app state
pub struct OllamaState {
    pub chat: Arc<OllamaChatClient>,
}

#[tauri::command]
pub async fn send_chat_message(
    app_handle: AppHandle,
    request: ChatRequestData,
) -> Result<String, String> {
    let state = app_handle.state::<Arc<Mutex<OllamaState>>>();
    let state = state.lock().await;
    
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
    
    let response = state.chat.chat_sync(&request.model, messages, Some(options)).await?;
    
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
    
    let state = app_handle.state::<Arc<Mutex<OllamaState>>>();
    let state = state.lock().await;
    
    let messages: Vec<ChatMessage> = request.messages
        .iter()
        .map(|m| ChatMessage {
            role: m.role.clone(),
            content: m.content.clone(),
        })
        .collect();
    
    let mut receiver = state.chat.chat_stream(&request.model, messages, None).await?;
    
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
    let ollama_state = OllamaState {
        chat: Arc::new(OllamaChatClient::new()),
    };
    app.manage(Arc::new(Mutex::new(ollama_state)));
}