// src/api/models/commands.rs
use tauri::{AppHandle, Manager};
use super::contracts::*;
use crate::core::huggingface::{
    clear_model_cache,
    download_model_file,
    cancel_download,
    delete_installed_model,
    delete_model_file,
    delete_model_quantization,
    write_modelfile,
    ModelFileConfig,
};
use crate::core::ollama::models::OllamaModelClient;
use std::path::PathBuf;

#[tauri::command]
pub async fn clear_models_cache(
    filter: Option<String>,
) -> Result<(), String> {
    let filter = match filter.as_deref() {
        Some("most_downloads") => Some(ModelFilter::MostDownloads),
        Some("most_liked") => Some(ModelFilter::MostLiked),
        Some("recent") => Some(ModelFilter::Recent),
        _ => None,
    };
    clear_model_cache(filter);
    Ok(())
}

#[tauri::command]
pub async fn download_huggingface_model(
    model_id: String,
    filename: String,
    app_handle: AppHandle,
) -> Result<(), String> {
    download_model_file(&model_id, &filename, &app_handle).await
}

#[tauri::command]
pub fn cancel_huggingface_download(
    model_id: String,
    filename: String,
) -> Result<bool, String> {
    Ok(cancel_download(&model_id, &filename))
}

#[tauri::command]
pub async fn delete_installed_model_command(
    app_handle: AppHandle,
    model_id: String,
) -> Result<(), String> {
    delete_installed_model(&app_handle, &model_id).await
}

#[tauri::command]
pub async fn delete_model_file_command(
    app_handle: AppHandle,
    model_id: String,
    filename: String,
) -> Result<(), String> {
    delete_model_file(&app_handle, &model_id, &filename).await
}

#[tauri::command]
pub async fn delete_model_quantization_command(
    app_handle: AppHandle,
    model_id: String,
    quantization: String,
) -> Result<(), String> {
    delete_model_quantization(&app_handle, &model_id, &quantization).await
}

#[tauri::command]
pub async fn generate_modelfile(
    model_id: String,
    filename: String,
    app_handle: AppHandle,
) -> Result<String, String> {
    let app_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;
    
    let model_folder_name = model_id.replace("/", "_");
    let model_dir = app_dir.join("models").join(&model_folder_name);
    
    if !model_dir.exists() {
        return Err("Model directory not found".to_string());
    }
    
    let config = ModelFileConfig {
        model_id: model_id.clone(),
        gguf_filename: filename,
        model_dir: model_dir.clone(),
    };
    
    let modelfile_path = write_modelfile(&model_dir, &config).await?;
    Ok(modelfile_path.to_str().unwrap_or("").to_string())
}

#[tauri::command]
pub async fn create_ollama_model(
    _app_handle: AppHandle,
    request: ModelImportRequest,
) -> Result<String, String> {
    let model_client = OllamaModelClient::new();
    let modelfile_path = PathBuf::from(&request.modelfile_path);
    model_client.create_model(&request.model_name, &modelfile_path).await?;
    Ok(request.model_name)
}

#[tauri::command]
pub async fn delete_ollama_model(
    _app_handle: AppHandle,
    model_name: String,
) -> Result<(), String> {
    let model_client = OllamaModelClient::new();
    model_client.delete_model(&model_name).await
}