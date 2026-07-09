use reqwest;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::time::Duration;
use tokio::sync::mpsc;
use std::path::Path;
use base64::engine::general_purpose::STANDARD as BASE64_STANDARD;
use base64::Engine;

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

    /// Create a new model using the Modelfile content
    pub async fn create_model_from_content(&self, model_name: &str, modelfile_content: &str, gguf_path: Option<&str>) -> Result<String, String> {
        let url = format!("{}/api/create", self.base_url);
        
        // Verify the Modelfile has a valid FROM path
        if !modelfile_content.contains("FROM") {
            return Err("Modelfile does not contain a FROM instruction".to_string());
        }
        
        // Log the Modelfile content for debugging
        println!("📝 Modelfile content:\n{}", modelfile_content);

        // Use the approach that works best with Ollama's API
        // Option 1: Use the files parameter with the GGUF file
        // Option 2: Use the modelfile parameter with absolute paths
        let mut payload = json!({
            "name": model_name,
            "stream": false,
        });

        // If we have a GGUF path, try using the files approach (more reliable)
        if let Some(path) = gguf_path {
            // Read the GGUF file as bytes
            let gguf_path_obj = Path::new(path);
            if gguf_path_obj.exists() {
                match std::fs::read(gguf_path_obj) {
                    Ok(gguf_data) => {
                        // Encode as base64 using the recommended Engine API
                        let base64_data = BASE64_STANDARD.encode(&gguf_data);
                        payload["files"] = json!({
                            "gguf_file": base64_data
                        });
                        println!("📤 Using files parameter with GGUF file (size: {} bytes)", gguf_data.len());
                    }
                    Err(e) => {
                        println!("⚠️ Failed to read GGUF file: {}, falling back to modelfile", e);
                        payload["modelfile"] = json!(modelfile_content);
                    }
                }
            } else {
                println!("⚠️ GGUF file not found at: {}, falling back to modelfile", path);
                payload["modelfile"] = json!(modelfile_content);
            }
        } else {
            // Fallback to modelfile approach
            payload["modelfile"] = json!(modelfile_content);
        }

        let response = self.client
            .post(&url)
            .json(&payload)
            .timeout(Duration::from_secs(300))
            .send()
            .await
            .map_err(|e| format!("Failed to create model: {}", e))?;

        let status = response.status();
        let response_text = response.text().await.unwrap_or_default();
        println!("📥 Ollama response: {}", response_text);

        if status.is_success() {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&response_text) {
                if let Some(error) = json.get("error") {
                    return Err(format!("Ollama error: {}", error));
                }
                if let Some(status_msg) = json.get("status") {
                    println!("✅ Model creation status: {}", status_msg);
                }
            }
            Ok("Model created successfully".to_string())
        } else {
            Err(format!("Failed to create model: {}", response_text))
        }
    }

    /// List available models
    pub async fn list_models(&self) -> Result<Vec<String>, String> {
        let url = format!("{}/api/tags", self.base_url);
        
        let response = self.client
            .get(&url)
            .timeout(Duration::from_secs(5))
            .send()
            .await
            .map_err(|e| format!("Failed to list models: {}", e))?;

        if response.status().is_success() {
            let data: Value = response.json()
                .await
                .map_err(|e| format!("Failed to parse response: {}", e))?;
            
            let models = data["models"]
                .as_array()
                .unwrap_or(&vec![])
                .iter()
                .filter_map(|m| m["name"].as_str().map(|s| s.to_string()))
                .collect();
            
            Ok(models)
        } else {
            Err("Failed to list models".to_string())
        }
    }

    /// Delete a model
    pub async fn delete_model(&self, model_name: &str) -> Result<(), String> {
        let url = format!("{}/api/delete", self.base_url);
        
        let payload = json!({
            "name": model_name,
        });

        let response = self.client
            .delete(&url)
            .json(&payload)
            .send()
            .await
            .map_err(|e| format!("Failed to delete model: {}", e))?;

        if response.status().is_success() {
            Ok(())
        } else {
            Err("Failed to delete model".to_string())
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