use tauri;
use tauri::Manager;
use tauri::Emitter;
use crate::core::huggingface_client::search_hugging_face_repository;
use crate::core::model_downloader::{fetch_gguf_metadata, download_gguf_model, generate_ollama_modelfile, import_model_into_ollama};
use crate::events::progress_broadcaster::broadcast_model_acquisition_progress;
use crate::data::huggingface_model_types::HuggingFaceModelListing;

#[tauri::command]
pub async fn search_huggingface_models(
    query: String,
    limit: Option<usize>,
) -> Result<Vec<HuggingFaceModelListing>, String> {
    search_hugging_face_repository(query, limit).await
}

#[tauri::command]
pub async fn download_huggingface_model(
    app_handle: tauri::AppHandle,
    model_id: String,
) -> Result<String, String> {
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
                broadcast_model_acquisition_progress(&window_clone, &model_id_clone, "error", 0, &format!("Failed to find GGUF file: {}", e));
                let _ = window_clone.emit("model-download-error", format!("Error finding GGUF for {}: {}", model_id_clone, e));
                return;
            }
        };
        
        broadcast_model_acquisition_progress(&window_clone, &model_id_clone, "downloading", 20, 
            &format!("Downloading GGUF file: {}", gguf_metadata.filename));
        
        if let Err(e) = download_gguf_model(&window_clone, &model_id_clone, &gguf_metadata).await {
            broadcast_model_acquisition_progress(&window_clone, &model_id_clone, "error", 0, &format!("Download failed: {}", e));
            let _ = window_clone.emit("model-download-error", format!("Error downloading {}: {}", model_id_clone, e));
            return;
        }
        
        broadcast_model_acquisition_progress(&window_clone, &model_id_clone, "converting", 70, "Creating Modelfile for Ollama...");
        
        if let Err(e) = generate_ollama_modelfile(&window_clone, &model_id_clone, &gguf_metadata).await {
            broadcast_model_acquisition_progress(&window_clone, &model_id_clone, "error", 0, &format!("Failed to create Modelfile: {}", e));
            let _ = window_clone.emit("model-download-error", format!("Error creating Modelfile for {}: {}", model_id_clone, e));
            return;
        }
        
        broadcast_model_acquisition_progress(&window_clone, &model_id_clone, "converting", 85, "Importing model into Ollama...");
        
        if let Err(e) = import_model_into_ollama(&model_id_clone).await {
            broadcast_model_acquisition_progress(&window_clone, &model_id_clone, "error", 0, &format!("Failed to import model: {}", e));
            let _ = window_clone.emit("model-download-error", format!("Error importing {} to Ollama: {}", model_id_clone, e));
            return;
        }
        
        broadcast_model_acquisition_progress(&window_clone, &model_id_clone, "complete", 100, "Model installed successfully!");
    });
    
    Ok(format!("Started downloading model: {}", model_id))
}