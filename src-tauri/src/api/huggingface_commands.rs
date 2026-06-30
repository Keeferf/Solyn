// src/api/huggingface_commands.rs
use tauri;
use tauri::Manager;
use tauri::Emitter;
use crate::core::huggingface_client::{fetch_hugging_face_models, get_total_model_count};
use crate::core::model_downloader::{fetch_gguf_metadata, download_gguf_model};
use crate::events::progress_broadcaster::broadcast_model_acquisition_progress;
use crate::data::huggingface_model_types::HuggingFaceModelListing;

#[tauri::command]
pub async fn fetch_huggingface_models(
    page: Option<usize>,
    limit: Option<usize>,
) -> Result<Vec<HuggingFaceModelListing>, String> {
    println!("Fetching Hugging Face models - page: {:?}, limit: {:?}", page, limit);
    let result = fetch_hugging_face_models(page, limit).await;
    
    // Log the result for debugging
    match &result {
        Ok(models) => println!("Successfully fetched {} models", models.len()),
        Err(e) => println!("Error fetching models: {}", e),
    }
    
    result
}

#[tauri::command]
pub async fn get_huggingface_model_count() -> Result<usize, String> {
    println!("Fetching total model count");
    let result = get_total_model_count().await;
    match &result {
        Ok(count) => println!("Total models: {}", count),
        Err(e) => println!("Error fetching count: {}", e),
    }
    result
}

#[tauri::command]
pub async fn download_huggingface_model(
    app_handle: tauri::AppHandle,
    model_id: String,
) -> Result<String, String> {
    println!("Starting download for model: {}", model_id);
    
    let window = app_handle
        .get_webview_window("main")
        .ok_or("Main window not found")?;
    
    let window_clone = window.clone();
    let model_id_clone = model_id.clone();
    
    tokio::spawn(async move {
        broadcast_model_acquisition_progress(&window_clone, &model_id_clone, "downloading", 0, "Starting download...");
        
        let gguf_metadata = match fetch_gguf_metadata(&model_id_clone).await {
            Ok(info) => info,
            Err(e) => {
                let error_msg = format!("Failed to find GGUF file: {}", e);
                broadcast_model_acquisition_progress(&window_clone, &model_id_clone, "error", 0, &error_msg);
                let _ = window_clone.emit("model-download-error", model_id_clone);
                return;
            }
        };
        
        broadcast_model_acquisition_progress(&window_clone, &model_id_clone, "downloading", 20, 
            &format!("Downloading GGUF file: {}", gguf_metadata.filename));
        
        match download_gguf_model(&window_clone, &model_id_clone, &gguf_metadata).await {
            Ok(result) => {
                broadcast_model_acquisition_progress(&window_clone, &model_id_clone, "complete", 100, &result);
                let _ = window_clone.emit("model-download-complete", model_id_clone);
            }
            Err(e) => {
                let error_msg = format!("Download failed: {}", e);
                broadcast_model_acquisition_progress(&window_clone, &model_id_clone, "error", 0, &error_msg);
                let _ = window_clone.emit("model-download-error", model_id_clone);
            }
        }
    });
    
    Ok(format!("Started downloading model: {}", model_id))
}