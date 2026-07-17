use reqwest;
use serde_json::json;
use std::time::Duration;
use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
pub struct OllamaModel {
    pub name: String,
    pub modified_at: String,
    pub size: u64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct OllamaModelList {
    pub models: Vec<OllamaModel>,
}

pub struct OllamaModelClient {
    client: reqwest::Client,
    base_url: String,
}

impl OllamaModelClient {
    pub fn new() -> Self {
        Self {
            client: reqwest::Client::new(),
            base_url: "http://localhost:11434".to_string(),
        }
    }

    /// Create a new model using the Modelfile content
    pub async fn create_model(&self, model_name: &str, modelfile_content: &str) -> Result<String, String> {
        let url = format!("{}/api/create", self.base_url);
        
        // Verify the Modelfile has a valid FROM instruction
        if !modelfile_content.contains("FROM") {
            return Err("Modelfile does not contain a FROM instruction".to_string());
        }

        let payload = json!({
            "name": model_name,
            "modelfile": modelfile_content,
            "stream": false,
        });

        let response = self.client
            .post(&url)
            .json(&payload)
            .timeout(Duration::from_secs(300))
            .send()
            .await
            .map_err(|e| format!("Failed to create model: {}", e))?;

        let status = response.status();
        let response_text = response.text().await.unwrap_or_default();
        
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
            let data: OllamaModelList = response.json()
                .await
                .map_err(|e| format!("Failed to parse response: {}", e))?;
            
            let models: Vec<String> = data.models
                .into_iter()
                .map(|m| m.name)
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
}

impl Default for OllamaModelClient {
    fn default() -> Self {
        Self::new()
    }
}