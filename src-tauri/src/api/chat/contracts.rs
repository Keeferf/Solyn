// src-tauri/src/api/chat/contracts.rs
use serde::Deserialize;
use std::sync::Arc;
use tokio::sync::Mutex;
use crate::core::ollama::chat::OllamaChatClient;

// Chat state
pub struct OllamaState {
    pub chat: Arc<OllamaChatClient>,
}

// Database state
#[derive(Clone)]
pub struct ChatDbState {
    pub db: Arc<Mutex<Option<crate::data::chat::ChatDatabase>>>,
}

// Request/Response structures for chat commands
#[derive(Debug, Deserialize)]
pub struct CreateSessionRequest {
    pub model_name: String,
    pub title: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ChatRequestData {
    pub session_id: Option<i64>,
    pub model: String,
    pub message: String,
    pub temperature: Option<f32>,
    pub top_p: Option<f32>,
    pub top_k: Option<i32>,
    pub num_ctx: Option<i32>,
    pub num_predict: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct ChatStreamData {
    pub session_id: Option<i64>,
    pub model: String,
    pub messages: Vec<ChatMessageData>,
    pub temperature: Option<f32>,
    pub top_p: Option<f32>,
    pub top_k: Option<i32>,
    pub num_ctx: Option<i32>,
    pub num_predict: Option<i32>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct ChatMessageData {
    pub role: String,
    pub content: String,
}