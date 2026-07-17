use reqwest;
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tokio::sync::mpsc;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatRequest {
    pub model: String,
    pub messages: Vec<ChatMessage>,
    pub stream: bool,
    pub options: Option<ChatOptions>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatOptions {
    pub temperature: Option<f32>,
    pub top_p: Option<f32>,
    pub top_k: Option<i32>,
    pub num_ctx: Option<i32>,
    pub num_predict: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatResponse {
    pub message: ChatMessage,
    pub done: bool,
    pub total_duration: Option<u64>,
    pub load_duration: Option<u64>,
    pub prompt_eval_count: Option<i32>,
    pub prompt_eval_duration: Option<u64>,
    pub eval_count: Option<i32>,
    pub eval_duration: Option<u64>,
}

#[derive(Debug, Clone)]
pub enum ChatEvent {
    MessageChunk(String),
    Done(ChatResponse),
    Error(String),
}

pub struct OllamaChatClient {
    client: reqwest::Client,
    base_url: String,
}

impl OllamaChatClient {
    pub fn new() -> Self {
        Self {
            client: reqwest::Client::new(),
            base_url: "http://localhost:11434".to_string(),
        }
    }

    /// Check if Ollama is running
    pub async fn check_health(&self) -> Result<bool, String> {
        let response = self.client
            .get(&format!("{}/api/version", self.base_url))
            .timeout(Duration::from_secs(2))
            .send()
            .await;

        match response {
            Ok(resp) if resp.status().is_success() => Ok(true),
            _ => Ok(false),
        }
    }

    /// Send a chat message (streaming)
    pub async fn chat_stream(
        &self,
        model_name: &str,
        messages: Vec<ChatMessage>,
        options: Option<ChatOptions>,
    ) -> Result<mpsc::UnboundedReceiver<ChatEvent>, String> {
        let url = format!("{}/api/chat", self.base_url);
        
        let request = ChatRequest {
            model: model_name.to_string(),
            messages,
            stream: true,
            options,
        };

        let (tx, rx) = mpsc::unbounded_channel();

        let client = self.client.clone();
        tokio::spawn(async move {
            let response = client
                .post(&url)
                .json(&request)
                .timeout(Duration::from_secs(600))
                .send()
                .await;

            match response {
                Ok(resp) => {
                    if !resp.status().is_success() {
                        let _ = tx.send(ChatEvent::Error(format!("HTTP error: {}", resp.status())));
                        return;
                    }

                    match resp.text().await {
                        Ok(text) => {
                            for line in text.lines() {
                                if line.is_empty() {
                                    continue;
                                }
                                if let Ok(chunk) = serde_json::from_str::<ChatResponse>(line) {
                                    if !chunk.message.content.is_empty() {
                                        let _ = tx.send(ChatEvent::MessageChunk(chunk.message.content.clone()));
                                    }
                                    if chunk.done {
                                        let _ = tx.send(ChatEvent::Done(chunk));
                                        break;
                                    }
                                }
                            }
                        }
                        Err(e) => {
                            let _ = tx.send(ChatEvent::Error(format!("Failed to read response: {}", e)));
                        }
                    }
                }
                Err(e) => {
                    let _ = tx.send(ChatEvent::Error(format!("Request failed: {}", e)));
                }
            }
        });

        Ok(rx)
    }

    /// Send a chat message (non-streaming)
    pub async fn chat_sync(
        &self,
        model_name: &str,
        messages: Vec<ChatMessage>,
        options: Option<ChatOptions>,
    ) -> Result<ChatResponse, String> {
        let url = format!("{}/api/chat", self.base_url);
        
        let request = ChatRequest {
            model: model_name.to_string(),
            messages,
            stream: false,
            options,
        };

        let response = self.client
            .post(&url)
            .json(&request)
            .timeout(Duration::from_secs(300))
            .send()
            .await
            .map_err(|e| format!("Failed to send chat: {}", e))?;

        if response.status().is_success() {
            let chat_response: ChatResponse = response.json()
                .await
                .map_err(|e| format!("Failed to parse response: {}", e))?;
            Ok(chat_response)
        } else {
            let error_text = response.text().await.unwrap_or_default();
            Err(format!("Chat request failed: {}", error_text))
        }
    }
}

impl Default for OllamaChatClient {
    fn default() -> Self {
        Self::new()
    }
}