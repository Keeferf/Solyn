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
    let result = fetch_hugging_face_models(page, limit).await;
    result
}

#[tauri::command]
pub async fn get_huggingface_model_count() -> Result<usize, String> {
    let result = get_total_model_count().await;
    result
}

// Command to fetch full model details when modal opens
#[tauri::command]
pub async fn fetch_model_details(
    model_id: String,
) -> Result<HuggingFaceModelListing, String> {
    // Call the function from huggingface_client
    let result = crate::core::huggingface_client::fetch_model_details(&model_id).await;
    result
}

#[tauri::command]
pub async fn download_huggingface_model(
    app_handle: tauri::AppHandle,
    model_id: String,
    filename: String,
) -> Result<String, String> {
    let window = app_handle
        .get_webview_window("main")
        .ok_or("Main window not found")?;
    
    let window_clone = window.clone();
    let model_id_clone = model_id.clone();
    let filename_clone = filename.clone();
    
    tokio::spawn(async move {
        broadcast_model_acquisition_progress(&window_clone, &model_id_clone, "downloading", 0, "Starting download...");
        
        // Use the provided filename instead of fetching metadata
        // We need to get the file size for progress tracking
        let gguf_metadata = match fetch_gguf_metadata(&model_id_clone).await {
            Ok(info) => info,
            Err(e) => {
                let error_msg = format!("Failed to find GGUF file: {}", e);
                broadcast_model_acquisition_progress(&window_clone, &model_id_clone, "error", 0, &error_msg);
                let _ = window_clone.emit("model-download-error", model_id_clone);
                return;
            }
        };
        
        // Verify the filename exists
        if gguf_metadata.filename != filename_clone {
            // If the provided filename doesn't match, use the one from metadata
            // or try to find the correct one
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
        } else {
            // Use the provided filename
            broadcast_model_acquisition_progress(&window_clone, &model_id_clone, "downloading", 20, 
                &format!("Downloading GGUF file: {}", filename_clone));
            
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
        }
    });
    
    Ok(format!("Started downloading model: {}", model_id))
}