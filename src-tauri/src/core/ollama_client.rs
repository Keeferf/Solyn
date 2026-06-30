use reqwest;
use serde_json;
use std::time::Duration;
use tauri::Manager;
use tauri::Emitter;
use crate::data::ollama_model_types::{OllamaModelInfo, ModelPullStatus};
use crate::data::download_state::InstallationInformation;
use crate::helpers::platform_detector::detect_operating_system;

pub async fn is_ollama_installed() -> Result<bool, String> {
    match fetch_ollama_version().await {
        Ok(_) => Ok(true),
        Err(_) => Ok(false),
    }
}

pub async fn fetch_ollama_version() -> Result<String, String> {
    let client = reqwest::Client::new();
    let response = client
        .get("http://localhost:11434/api/version")
        .timeout(Duration::from_secs(2))
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

pub async fn get_installation_instructions() -> Result<InstallationInformation, String> {
    let platform = detect_operating_system();
    
    let (command, estimated_time) = match platform.as_str() {
        "windows" => (
            "irm https://ollama.com/install.ps1 | iex".to_string(),
            "~5 minutes".to_string(),
        ),
        "macos" | "linux" => (
            "curl -fsSL https://ollama.com/install.sh | sh".to_string(),
            "~5 minutes".to_string(),
        ),
        _ => return Err("Unsupported platform".to_string()),
    };

    Ok(InstallationInformation {
        platform,
        command,
        estimated_time,
    })
}

pub async fn list_installed_ollama_models() -> Result<Vec<OllamaModelInfo>, String> {
    let client = reqwest::Client::new();
    let response = client
        .get("http://localhost:11434/api/tags")
        .timeout(Duration::from_secs(5))
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
                crate::data::ollama_model_types::ModelTechnicalDetails {
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

            Some(OllamaModelInfo {
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

pub async fn remove_ollama_model(model_name: String) -> Result<String, String> {
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

pub async fn initiate_model_pull(
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
                        if let Ok(progress) = serde_json::from_str::<ModelPullStatus>(line) {
                            let _ = window_clone.emit("model-pull-progress", progress);
                        }
                    }
                }
            }
        }
    });

    Ok(format!("Started pulling model: {}", model_name))
}

pub async fn get_installed_model_names() -> Vec<String> {
    if let Ok(models) = list_installed_ollama_models().await {
        models.into_iter().map(|m| m.name).collect()
    } else {
        Vec::new()
    }
}