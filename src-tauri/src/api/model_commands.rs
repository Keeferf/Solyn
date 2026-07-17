use tauri::AppHandle;
use serde::{Deserialize, Serialize};
use crate::core::ollama_models::OllamaModelClient;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelImportRequest {
    pub model_name: String,
    pub modelfile_content: String,
}

#[tauri::command]
pub async fn create_ollama_model(
    _app_handle: AppHandle,
    request: ModelImportRequest,
) -> Result<String, String> {
    let model_client = OllamaModelClient::new();
    model_client.create_model(&request.model_name, &request.modelfile_content).await?;
    Ok(request.model_name)
}

#[tauri::command]
pub async fn list_ollama_models(_app_handle: AppHandle) -> Result<Vec<String>, String> {
    let model_client = OllamaModelClient::new();
    model_client.list_models().await
}

#[tauri::command]
pub async fn delete_ollama_model(
    _app_handle: AppHandle,
    model_name: String,
) -> Result<(), String> {
    let model_client = OllamaModelClient::new();
    model_client.delete_model(&model_name).await
}

#[tauri::command]
pub async fn check_ollama_health(_app_handle: AppHandle) -> Result<bool, String> {
    let model_client = OllamaModelClient::new();
    // We need to check if Ollama is running by trying to list models
    // or we could use the chat client's health check
    match model_client.list_models().await {
        Ok(_) => Ok(true),
        Err(_) => Ok(false),
    }
}