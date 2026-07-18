// src/core/huggingface/download.rs
use std::sync::atomic::Ordering;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};  
use tokio::fs;
use tokio::io::AsyncWriteExt;
use futures_util::StreamExt;
use log;

use crate::data::download_state::ModelAcquisitionProgress;
use crate::core::ollama::models::OllamaModelClient;
use super::cache::{generate_download_id, insert_cancellation_token, remove_cancellation_token, get_cancellation_token};
use super::modelfile::{write_modelfile, ModelFileConfig, write_metadata};
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
    let quantization = extract_quantization(filename);
    let parameter_count = extract_parameter_count(filename);
    
    // Create Modelfile config - simplified
    let config = ModelFileConfig {
        model_id: model_id.to_string(),
        gguf_filename: filename.to_string(),
        model_dir: model_dir.clone(),
    };
    
    let modelfile_path = match write_modelfile(&model_dir, &config).await {
        Ok(path) => {
            log::info!("Modelfile created at: {:?}", path);
            send_progress(app_handle, model_id, filename, "modelfile_created", 100.0, 
                "Modelfile created");
            path
        }
        Err(e) => {
            log::warn!("Failed to create Modelfile: {}", e);
            return Err(format!("Failed to create Modelfile: {}", e));
        }
    };
    
    // --- Generate metadata.json ---
    if let Err(e) = write_metadata(
        &model_dir, 
        model_id, 
        filename, 
        quantization.clone(), 
        parameter_count
    ).await {
        log::warn!("Failed to create metadata.json: {}", e);
        // Don't fail the whole download if metadata creation fails
    }
    
    // --- Create Ollama Model with retry logic ---
    send_progress(app_handle, model_id, filename, "creating_ollama_model", 100.0, 
        "Creating Ollama model...");
    
    let model_name = format!("{}_{}", 
        model_id.replace("/", "_"), 
        quantization.as_deref().unwrap_or("default")
    );
    
    let ollama_client = OllamaModelClient::new();
    let max_retries = 3;
    let mut current_retry = 0;
    let mut ollama_created = false;
    let mut last_error = String::new();
    
    while current_retry < max_retries && !ollama_created {
        current_retry += 1;
        
        if current_retry > 1 {
            let wait_seconds = 2u64.pow(current_retry as u32 - 1); // Exponential backoff: 2, 4, 8 seconds
            send_progress(app_handle, model_id, filename, "retrying_ollama_creation", 100.0, 
                &format!("Retrying Ollama model creation (attempt {}/{})...", current_retry, max_retries));
            
            tokio::time::sleep(tokio::time::Duration::from_secs(wait_seconds)).await;
        }
        
        match ollama_client.create_model(&model_name, &modelfile_path).await {
            Ok(message) => {
                ollama_created = true;
                log::info!("Ollama model created: {} - {}", model_name, message);
                
                send_progress(app_handle, model_id, filename, "ollama_model_created", 100.0, 
                    &format!("Ollama model '{}' created successfully", model_name));
                
                // Emit event for Ollama model created
                let _ = app_handle.emit("ollama-model-created", &serde_json::json!({
                    "model_name": model_name,
                    "model_id": model_id,
                    "quantization": quantization,
                    "attempt": current_retry,
                }));
            }
            Err(e) => {
                last_error = e.clone();
                log::warn!("Failed to create Ollama model (attempt {}/{}): {}", 
                    current_retry, max_retries, e);
                
                if current_retry < max_retries {
                    // Continue to next retry
                    continue;
                } else {
                    // All retries exhausted
                    log::error!("Failed to create Ollama model after {} attempts: {}", 
                        max_retries, last_error);
                    
                    send_progress(app_handle, model_id, filename, "ollama_model_failed", 100.0, 
                        &format!("Failed to create Ollama model: {}", last_error));
                    
                    // Emit event for Ollama model creation failure
                    let _ = app_handle.emit("ollama-model-creation-failed", &serde_json::json!({
                        "model_name": model_name,
                        "model_id": model_id,
                        "error": last_error,
                        "attempts": max_retries,
                    }));
                }
            }
        }
    }
    
    // --- Check if Ollama is running and warn user if not ---
    if !ollama_created {
        // Check if Ollama is running
        let ollama_running = match crate::core::ollama::client::is_ollama_running().await {
            Ok(running) => running,
            Err(_) => false,
        };
        
        if !ollama_running {
            send_progress(app_handle, model_id, filename, "ollama_not_running", 100.0, 
                "Ollama is not running. Model file downloaded but cannot create Ollama model. Please start Ollama and try importing manually.");
        } else {
            send_progress(app_handle, model_id, filename, "ollama_creation_failed", 100.0, 
                &format!("Failed to create Ollama model after {} attempts: {}. Please try importing manually.", 
                    max_retries, last_error));
        }
    }
    
    // Send completion
    send_progress(app_handle, model_id, filename, "complete", 100.0, "Download complete!");
    
    // Send separate completion event with Modelfile info
    let _ = app_handle.emit("model-download-complete", &serde_json::json!({
        "model_id": model_id,
        "filename": filename,
        "path": file_path.to_str().unwrap_or(""),
        "modelfile_path": modelfile_path.to_str().unwrap_or(""),
        "quantization": quantization,
        "ollama_model_name": model_name,
        "ollama_created": ollama_created,
    }));
    
    remove_cancellation_token(&download_id);
    
    // Return success even if Ollama creation failed (model files are still available)
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