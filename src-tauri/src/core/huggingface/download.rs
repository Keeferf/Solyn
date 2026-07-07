// src/core/huggingface/download.rs
use std::sync::atomic::Ordering;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};  
use tokio::fs;
use tokio::io::AsyncWriteExt;
use futures_util::StreamExt;
use log;

use crate::data::download_state::ModelAcquisitionProgress;
use super::cache::{generate_download_id, insert_cancellation_token, remove_cancellation_token, get_cancellation_token};
use super::modelfile::{write_modelfile, ModelFileConfig, get_modelfile_name};
use super::utils::{extract_parameter_count, extract_quantization};

pub async fn download_model_file(
    model_id: &str,
    filename: &str,
    app_handle: &AppHandle,
) -> Result<(), String> {
    let download_id = generate_download_id(model_id, filename);
    
    // Create cancellation token
    let cancel_token = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
    insert_cancellation_token(download_id.clone(), cancel_token.clone());
    
    // Get the app's data directory
    let app_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;
    
    // Create directories
    let models_dir = app_dir.join("models");
    if !models_dir.exists() {
        fs::create_dir_all(&models_dir)
            .await
            .map_err(|e| format!("Failed to create models directory: {}", e))?;
    }
    
    let model_folder_name = model_id.replace("/", "_");
    let model_dir = models_dir.join(&model_folder_name);
    if !model_dir.exists() {
        fs::create_dir_all(&model_dir)
            .await
            .map_err(|e| format!("Failed to create model directory: {}", e))?;
    }
    
    let file_path = model_dir.join(filename);
    
    // Check if file already exists
    if file_path.exists() {
        remove_cancellation_token(&download_id);
        return Err(format!("File {} already exists", filename));
    }
    
    // Create download URL
    let url = format!(
        "https://huggingface.co/{}/resolve/main/{}",
        model_id, filename
    );
    
    let client = reqwest::Client::new();
    
    // Send initial progress
    send_progress(app_handle, model_id, filename, "starting", 0.0, "Starting download...");
    
    // Start download
    let response = client
        .get(&url)
        .header("User-Agent", "SolynApp/1.0")
        .timeout(Duration::from_secs(3600))
        .send()
        .await
        .map_err(|e| {
            remove_cancellation_token(&download_id);
            format!("Failed to start download: {}", e)
        })?;
    
    if !response.status().is_success() {
        remove_cancellation_token(&download_id);
        return Err(format!("Download failed with status: {}", response.status()));
    }
    
    let total_size = response
        .content_length()
        .ok_or_else(|| "Failed to get file size".to_string())?;
    
    // Download with progress
    let mut file = fs::File::create(&file_path)
        .await
        .map_err(|e| format!("Failed to create file: {}", e))?;
    
    let mut downloaded: u64 = 0;
    let mut stream = response.bytes_stream();
    
    let mut last_update = tokio::time::Instant::now();
    let update_interval = tokio::time::Duration::from_millis(500);
    
    while let Some(chunk_result) = stream.next().await {
        // Check for cancellation
        if cancel_token.load(Ordering::SeqCst) {
            send_progress(app_handle, model_id, filename, "cancelled", 
                (downloaded as f64 / total_size as f64) * 100.0, 
                "Download cancelled");
            
            let _ = fs::remove_file(&file_path).await;
            remove_cancellation_token(&download_id);
            return Err("Download cancelled".to_string());
        }
        
        let chunk = chunk_result
            .map_err(|e| format!("Download error: {}", e))?;
        
        file.write_all(&chunk)
            .await
            .map_err(|e| format!("Write error: {}", e))?;
        
        downloaded += chunk.len() as u64;
        
        // Update progress at most every 500ms
        if last_update.elapsed() >= update_interval {
            let progress_percent = (downloaded as f64 / total_size as f64) * 100.0;
            let progress_rounded = (progress_percent * 10.0).round() / 10.0;
            
            send_progress(app_handle, model_id, filename, "downloading", 
                progress_rounded, 
                &format!("Downloading... {:.1}%", progress_rounded));
            
            last_update = tokio::time::Instant::now();
        }
    }
    
    // Flush and sync file
    file.flush().await
        .map_err(|e| format!("Failed to flush file: {}", e))?;
    file.sync_all().await
        .map_err(|e| format!("Failed to sync file: {}", e))?;
    
    // --- Generate Modelfile ---
    send_progress(app_handle, model_id, filename, "generating_modelfile", 100.0, "Generating Modelfile...");
    
    // Extract model info
    let parts: Vec<&str> = model_id.split('/').collect();
    let author = parts.get(0).unwrap_or(&"").to_string();
    let model_name = parts.get(1).unwrap_or(&"").to_string();
    let quantization = extract_quantization(filename);
    let parameter_count = extract_parameter_count(filename);
    
    // Create Modelfile config with quantization-specific settings
    let config = ModelFileConfig {
        model_name: format!("{}/{}", author, model_name),
        model_id: model_id.to_string(),
        gguf_filename: filename.to_string(),
        quantization: quantization.clone(),
        parameter_count,
        model_dir: model_dir.clone(), // FIXED: Added missing field
    };
    
    match write_modelfile(&model_dir, &config).await {
        Ok(modelfile_path) => {
            log::info!("Modelfile created at: {:?}", modelfile_path);
            let modelfile_name = get_modelfile_name(quantization.as_ref());
            send_progress(app_handle, model_id, filename, "modelfile_created", 100.0, 
                &format!("Modelfile created: {}", modelfile_name));
        }
        Err(e) => {
            log::warn!("Failed to create Modelfile: {}", e);
            // Don't fail the whole download if Modelfile creation fails
        }
    }
    
    // Send completion
    send_progress(app_handle, model_id, filename, "complete", 100.0, "Download complete!");
    
    // Send separate completion event with Modelfile info
    let modelfile_name = get_modelfile_name(quantization.as_ref());
    let _ = app_handle.emit("model-download-complete", &serde_json::json!({
        "model_id": model_id,
        "filename": filename,
        "path": file_path.to_str().unwrap_or(""),
        "modelfile_path": model_dir.join(&modelfile_name).to_str().unwrap_or(""),
        "quantization": quantization,
    }));
    
    remove_cancellation_token(&download_id);
    Ok(())
}

pub fn cancel_download(model_id: &str, filename: &str) -> bool {
    let download_id = generate_download_id(model_id, filename);
    if let Some(token) = get_cancellation_token(&download_id) {
        token.store(true, Ordering::SeqCst);
        true
    } else {
        false
    }
}

fn send_progress(app_handle: &AppHandle, model_id: &str, filename: &str, 
                 status: &str, progress: f64, message: &str) {
    let progress_msg = ModelAcquisitionProgress {
        model_id: model_id.to_string(),
        filename: filename.to_string(),
        status: status.to_string(),
        progress,
        message: message.to_string(),
    };
    let _ = app_handle.emit("model-download-progress", progress_msg);
}