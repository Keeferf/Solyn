use serde::{Deserialize, Serialize};
use std::sync::Arc;
use crate::core::ollama_chat::OllamaChatClient;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatRequestData {
    pub model: String,
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

// Internal state for chat
pub struct OllamaState {
    pub chat: Arc<OllamaChatClient>,
}