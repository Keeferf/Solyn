use std::path::PathBuf;
use std::sync::atomic::Ordering;
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};  
use tokio::fs;
use tokio::io::{AsyncWriteExt, BufWriter};
use futures_util::StreamExt;
use log;

use crate::data::download_state::ModelAcquisitionProgress;
use crate::core::ollama::models::OllamaModelClient;
use super::cache::{generate_download_id, insert_cancellation_token, remove_cancellation_token, get_cancellation_token};
use super::modelfile::{write_modelfile, ModelFileConfig, write_metadata};
use super::utils::{extract_parameter_count, extract_quantization};

// Buffer size: 8MB for optimal performance
const WRITE_BUFFER_SIZE: usize = 8 * 1024 * 1024; // 8MB
// Number of parallel chunks for download
const PARALLEL_CHUNKS: usize = 8;
// Minimum chunk size: 10MB to avoid too many small chunks
const MIN_CHUNK_SIZE: u64 = 10 * 1024 * 1024; // 10MB

/// Get the file path for a model download
fn get_model_file_path(app_handle: &AppHandle, model_id: &str, filename: &str) -> Result<(PathBuf, PathBuf, PathBuf), String> {
    let app_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;
    
    let models_dir = app_dir.join("models");
    let model_folder_name = model_id.replace("/", "_");
    let model_dir = models_dir.join(&model_folder_name);
    let file_path = model_dir.join(filename);
    let part_path = model_dir.join(format!("{}.part", filename));
    
    Ok((model_dir, file_path, part_path))
}

/// Get chunk file path for a specific chunk index
fn get_chunk_path(model_dir: &PathBuf, filename: &str, chunk_index: usize) -> PathBuf {
    model_dir.join(format!("{}.part.{}", filename, chunk_index))
}

/// Check if all chunks exist and are complete
async fn are_all_chunks_complete(model_dir: &PathBuf, filename: &str, num_chunks: usize, total_size: u64) -> bool {
    for i in 0..num_chunks {
        let chunk_path = get_chunk_path(model_dir, filename, i);
        if !chunk_path.exists() {
            return false;
        }
        
        if let Ok(metadata) = fs::metadata(&chunk_path).await {
            let expected_size = if i == num_chunks - 1 {
                // Last chunk may be smaller
                let remainder = total_size % (total_size / num_chunks as u64);
                if remainder > 0 {
                    total_size / num_chunks as u64 + remainder
                } else {
                    total_size / num_chunks as u64
                }
            } else {
                total_size / num_chunks as u64
            };
            
            if metadata.len() != expected_size {
                return false;
            }
        } else {
            return false;
        }
    }
    true
}

/// Get the total downloaded size from all chunks
async fn get_total_downloaded_size(model_dir: &PathBuf, filename: &str, num_chunks: usize) -> u64 {
    let mut total = 0;
    for i in 0..num_chunks {
        let chunk_path = get_chunk_path(model_dir, filename, i);
        if let Ok(metadata) = fs::metadata(&chunk_path).await {
            total += metadata.len();
        }
    }
    total
}

/// Clean up chunk files
async fn cleanup_chunk_files(model_dir: &PathBuf, filename: &str, num_chunks: usize) {
    for i in 0..num_chunks {
        let chunk_path = get_chunk_path(model_dir, filename, i);
        let _ = fs::remove_file(&chunk_path).await;
    }
}

/// Combine all chunks into the final file
async fn combine_chunks(
    model_dir: &PathBuf, 
    filename: &str, 
    file_path: &PathBuf, 
    num_chunks: usize
) -> Result<(), String> {
    let mut final_file = fs::OpenOptions::new()
        .write(true)
        .create(true)
        .truncate(true)
        .open(file_path)
        .await
        .map_err(|e| format!("Failed to create final file: {}", e))?;
    
    let mut buffered_writer = BufWriter::with_capacity(WRITE_BUFFER_SIZE, final_file);
    
    for i in 0..num_chunks {
        let chunk_path = get_chunk_path(model_dir, filename, i);
        let mut chunk_file = fs::File::open(&chunk_path)
            .await
            .map_err(|e| format!("Failed to open chunk {}: {}", i, e))?;
        
        // Read and write chunk in chunks to avoid memory issues
        let mut buffer = vec![0u8; WRITE_BUFFER_SIZE];
        loop {
            let bytes_read = tokio::io::AsyncReadExt::read(&mut chunk_file, &mut buffer)
                .await
                .map_err(|e| format!("Failed to read chunk {}: {}", i, e))?;
            
            if bytes_read == 0 {
                break;
            }
            
            buffered_writer.write_all(&buffer[..bytes_read])
                .await
                .map_err(|e| format!("Failed to write chunk {}: {}", i, e))?;
        }
    }
    
    buffered_writer.flush()
        .await
        .map_err(|e| format!("Failed to flush final file: {}", e))?;
    
    // Sync to disk
    if let Err(e) = buffered_writer.into_inner().sync_all().await {
        log::warn!("Failed to sync final file: {}", e);
    }
    
    Ok(())
}

/// Download a single chunk with resume support
async fn download_chunk(
    url: &str,
    model_dir: &PathBuf,
    filename: &str,
    chunk_index: usize,
    start_byte: u64,
    end_byte: u64,
    cancel_token: &Arc<std::sync::atomic::AtomicBool>,
    client: &reqwest::Client,
) -> Result<(), String> {
    let chunk_path = get_chunk_path(model_dir, filename, chunk_index);
    
    // Check if chunk already exists and get its size
    let existing_size = if chunk_path.exists() {
        if let Ok(metadata) = fs::metadata(&chunk_path).await {
            metadata.len()
        } else {
            0
        }
    } else {
        0
    };
    
    let expected_size = end_byte - start_byte + 1;
    
    // If chunk is already complete, skip it
    if existing_size == expected_size {
        log::debug!("Chunk {} already complete, skipping", chunk_index);
        return Ok(());
    }
    
    // If chunk exists but is incomplete, resume from where we left off
    let resume_from = existing_size;
    let resume_start = start_byte + resume_from;
    
    // Open file for appending
    let file = if resume_from > 0 && chunk_path.exists() {
        tokio::fs::OpenOptions::new()
            .write(true)
            .append(true)
            .open(&chunk_path)
            .await
            .map_err(|e| format!("Failed to open chunk {} for resume: {}", chunk_index, e))?
    } else {
        // Create new file or overwrite if corrupted
        fs::File::create(&chunk_path)
            .await
            .map_err(|e| format!("Failed to create chunk {}: {}", chunk_index, e))?
    };
    
    let mut buffered_writer = BufWriter::with_capacity(WRITE_BUFFER_SIZE, file);
    let mut downloaded = resume_from;
    
    // Build request with range header if resuming
    let mut request_builder = client
        .get(url)
        .header("User-Agent", "SolynApp/1.0")
        .timeout(Duration::from_secs(3600));
    
    if resume_from > 0 {
        request_builder = request_builder.header("Range", format!("bytes={}-{}", resume_start, end_byte));
    } else {
        request_builder = request_builder.header("Range", format!("bytes={}-{}", start_byte, end_byte));
    }
    
    let response = request_builder
        .send()
        .await
        .map_err(|e| format!("Failed to download chunk {}: {}", chunk_index, e))?;
    
    if !response.status().is_success() && response.status() != reqwest::StatusCode::PARTIAL_CONTENT {
        return Err(format!("Chunk {} download failed with status: {}", chunk_index, response.status()));
    }
    
    let mut stream = response.bytes_stream();
    let mut buffer_bytes_written: u64 = 0;
    let buffer_capacity = WRITE_BUFFER_SIZE as u64;
    
    while let Some(chunk_result) = stream.next().await {
        // Check for cancellation
        if cancel_token.load(Ordering::SeqCst) {
            let _ = buffered_writer.flush().await;
            return Err("Download cancelled".to_string());
        }
        
        let chunk = chunk_result
            .map_err(|e| format!("Chunk {} download error: {}", chunk_index, e))?;
        
        buffered_writer.write_all(&chunk)
            .await
            .map_err(|e| format!("Chunk {} write error: {}", chunk_index, e))?;
        
        downloaded += chunk.len() as u64;
        buffer_bytes_written += chunk.len() as u64;
        
        // Auto-flush when buffer is full
        if buffer_bytes_written >= buffer_capacity {
            buffered_writer.flush()
                .await
                .map_err(|e| format!("Failed to flush chunk {}: {}", chunk_index, e))?;
            buffer_bytes_written = 0;
        }
    }
    
    // Final flush
    buffered_writer.flush()
        .await
        .map_err(|e| format!("Failed to flush chunk {}: {}", chunk_index, e))?;
    
    // Sync to disk
    if let Err(e) = buffered_writer.into_inner().sync_all().await {
        log::warn!("Failed to sync chunk {}: {}", chunk_index, e);
    }
    
    // Verify chunk size
    if downloaded != expected_size {
        return Err(format!(
            "Chunk {} incomplete: {}/{} bytes", 
            chunk_index, downloaded, expected_size
        ));
    }
    
    Ok(())
}

/// Attempt to download with parallel chunking
async fn attempt_download(
    model_id: &str,
    filename: &str,
    app_handle: &AppHandle,
    model_dir: &PathBuf,
    file_path: &PathBuf,
    _part_path: &PathBuf,
    cancel_token: &Arc<std::sync::atomic::AtomicBool>,
    download_id: &str,
    resume: bool,
) -> Result<(PathBuf, String), String> {
    let url = format!(
        "https://huggingface.co/{}/resolve/main/{}",
        model_id, filename
    );
    
    let client = reqwest::Client::new();
    
    // Get total file size first
    let head_response = client
        .head(&url)
        .header("User-Agent", "SolynApp/1.0")
        .send()
        .await
        .map_err(|e| format!("Failed to get file info: {}", e))?;
    
    let total_size = head_response
        .content_length()
        .ok_or_else(|| "Failed to get file size".to_string())?;
    
    // Determine chunk configuration
    let num_chunks = if total_size < MIN_CHUNK_SIZE * 2 {
        // For small files, use fewer chunks
        std::cmp::min(PARALLEL_CHUNKS, (total_size / MIN_CHUNK_SIZE) as usize + 1)
    } else {
        PARALLEL_CHUNKS
    };
    
    let chunk_size = total_size / num_chunks as u64;
    
    // Check if download is already complete
    if resume && file_path.exists() {
        if let Ok(metadata) = fs::metadata(file_path).await {
            if metadata.len() == total_size {
                send_progress(app_handle, model_id, filename, "already_complete", 100.0, "File already downloaded");
                let quantization = extract_quantization(filename).unwrap_or_else(|| "default".to_string());
                return Ok((file_path.clone(), quantization));
            }
        }
    }
    
    // Check if all chunks are complete (possible previous interrupted combine)
    if resume && are_all_chunks_complete(model_dir, filename, num_chunks, total_size).await {
        send_progress(app_handle, model_id, filename, "combining", 0.0, "Combining chunks...");
        combine_chunks(model_dir, filename, file_path, num_chunks).await?;
        cleanup_chunk_files(model_dir, filename, num_chunks).await;
        
        let quantization = extract_quantization(filename).unwrap_or_else(|| "default".to_string());
        send_progress(app_handle, model_id, filename, "complete", 100.0, "Download complete!");
        return Ok((file_path.clone(), quantization));
    }
    
    // Calculate progress from existing chunks
    let total_downloaded = if resume {
        get_total_downloaded_size(model_dir, filename, num_chunks).await
    } else {
        0
    };
    
    let initial_progress = (total_downloaded as f64 / total_size as f64) * 100.0;
    
    if resume && total_downloaded > 0 {
        send_progress(
            app_handle, 
            model_id, 
            filename, 
            "resuming", 
            initial_progress,
            &format!("Resuming download from {} bytes", total_downloaded)
        );
    } else {
        send_progress(app_handle, model_id, filename, "starting", 0.0, "Starting parallel download...");
    }
    
    // Create chunk tasks
    let mut handles = Vec::with_capacity(num_chunks);
    let cancel_token_clone = cancel_token.clone();
    let client_clone = client.clone();
    let model_dir_clone = model_dir.clone();
    let filename_clone = filename.to_string();
    let url_clone = url.clone();
    
    for i in 0..num_chunks {
        let start_byte = i as u64 * chunk_size;
        let end_byte = if i == num_chunks - 1 {
            total_size - 1
        } else {
            (i as u64 + 1) * chunk_size - 1
        };
        
        let cancel_token_for_task = cancel_token_clone.clone();
        let client_for_task = client_clone.clone();
        let model_dir_for_task = model_dir_clone.clone();
        let filename_for_task = filename_clone.clone();
        let url_for_task = url_clone.clone();
        
        let handle = tokio::spawn(async move {
            download_chunk(
                &url_for_task,
                &model_dir_for_task,
                &filename_for_task,
                i,
                start_byte,
                end_byte,
                &cancel_token_for_task,
                &client_for_task,
            ).await
        });
        
        handles.push((i, handle));
    }
    
    // Wait for all chunks to complete
    let mut completed = 0;
    let mut errors = Vec::new();
    let mut last_update = tokio::time::Instant::now();
    let update_interval = tokio::time::Duration::from_millis(500);
    
    while completed < handles.len() {
        // Check for cancellation
        if cancel_token.load(Ordering::SeqCst) {
            send_progress(app_handle, model_id, filename, "cancelled", 
                (get_total_downloaded_size(model_dir, filename, num_chunks).await as f64 / total_size as f64) * 100.0, 
                "Download cancelled");
            remove_cancellation_token(download_id);
            return Err("Download cancelled".to_string());
        }
        
        // Check progress of each chunk
        let now = tokio::time::Instant::now();
        if now - last_update >= update_interval {
            let total_downloaded = get_total_downloaded_size(model_dir, filename, num_chunks).await;
            let progress_percent = (total_downloaded as f64 / total_size as f64) * 100.0;
            let progress_rounded = (progress_percent * 10.0).round() / 10.0;
            
            send_progress(
                app_handle, 
                model_id, 
                filename, 
                "downloading", 
                progress_rounded,
                &format!("Downloading... {:.1}% ({}/{})", progress_rounded, total_downloaded, total_size)
            );
            
            last_update = now;
        }
        
        // Check if all handles are ready
        let mut all_done = true;
        for (i, handle) in &mut handles {
            if !handle.is_finished() {
                all_done = false;
                break;
            }
        }
        
        if all_done {
            break;
        }
        
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
    }
    
    // Collect results
    let mut all_success = true;
    for (i, handle) in handles {
        match handle.await {
            Ok(Ok(())) => {
                completed += 1;
            }
            Ok(Err(e)) => {
                all_success = false;
                errors.push(format!("Chunk {}: {}", i, e));
                log::warn!("Chunk {} failed: {}", i, e);
            }
            Err(e) => {
                all_success = false;
                errors.push(format!("Chunk {} task error: {}", i, e));
                log::warn!("Chunk {} task error: {}", i, e);
            }
        }
    }
    
    if !all_success {
        // Clean up incomplete chunks
        cleanup_chunk_files(model_dir, filename, num_chunks).await;
        
        let error_msg = if errors.is_empty() {
            "Download failed with unknown error".to_string()
        } else {
            errors.join("; ")
        };
        
        remove_cancellation_token(download_id);
        return Err(error_msg);
    }
    
    // All chunks downloaded - combine them
    send_progress(app_handle, model_id, filename, "combining", 0.0, "Combining chunks...");
    
    combine_chunks(model_dir, filename, file_path, num_chunks).await?;
    
    // Clean up chunk files
    cleanup_chunk_files(model_dir, filename, num_chunks).await;
    
    // Verify final file
    if let Ok(metadata) = fs::metadata(file_path).await {
        if metadata.len() != total_size {
            return Err(format!("Final file size mismatch: {}/{} bytes", metadata.len(), total_size));
        }
    } else {
        return Err("Failed to verify final file".to_string());
    }
    
    let quantization = extract_quantization(filename);
    
    Ok((file_path.clone(), quantization.unwrap_or_else(|| "default".to_string())))
}

pub async fn download_model_file(
    model_id: &str,
    filename: &str,
    app_handle: &AppHandle,
) -> Result<(), String> {
    let download_id = generate_download_id(model_id, filename);
    
    let cancel_token = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
    insert_cancellation_token(download_id.clone(), cancel_token.clone());
    
    let (model_dir, file_path, part_path) = get_model_file_path(app_handle, model_id, filename)?;
    
    if !model_dir.exists() {
        fs::create_dir_all(&model_dir)
            .await
            .map_err(|e| format!("Failed to create model directory: {}", e))?;
    }
    
    if file_path.exists() {
        // Check if there are partial chunks or the file is complete
        let mut has_chunks = false;
        for i in 0..PARALLEL_CHUNKS {
            let chunk_path = get_chunk_path(&model_dir, filename, i);
            if chunk_path.exists() {
                has_chunks = true;
                break;
            }
        }
        
        if !has_chunks {
            // File exists and no chunks, assume complete
            remove_cancellation_token(&download_id);
            return Err(format!("File {} already exists", filename));
        }
        // Otherwise, we'll resume with chunks
    }
    
    // Check if there are chunk files indicating a partial download
    let mut resume = false;
    for i in 0..PARALLEL_CHUNKS {
        let chunk_path = get_chunk_path(&model_dir, filename, i);
        if chunk_path.exists() {
            resume = true;
            break;
        }
    }
    
    // Also resume if .part file exists (legacy support)
    if !resume && part_path.exists() {
        resume = true;
        // Migrate .part to chunk format if needed
        // For simplicity, we'll just remove it and start fresh
        // In a production app, you might want to migrate it
        let _ = fs::remove_file(&part_path).await;
        resume = false;
    }
    
    let max_attempts = 2;
    let mut current_attempt = 0;
    let mut quantization = String::new();
    
    while current_attempt < max_attempts {
        current_attempt += 1;
        
        match attempt_download(
            model_id,
            filename,
            app_handle,
            &model_dir,
            &file_path,
            &part_path,
            &cancel_token,
            &download_id,
            resume,
        ).await {
            Ok((_path, quant)) => {
                quantization = quant;
                break;
            }
            Err(e) => {
                if current_attempt >= max_attempts {
                    remove_cancellation_token(&download_id);
                    return Err(e);
                }
                
                if resume {
                    log::warn!("Resume failed, retrying without resume: {}", e);
                    resume = false;
                    cleanup_chunk_files(&model_dir, filename, PARALLEL_CHUNKS).await;
                    if file_path.exists() {
                        fs::remove_file(&file_path).await.ok();
                    }
                } else {
                    remove_cancellation_token(&download_id);
                    return Err(e);
                }
            }
        }
    }
    
    // --- Generate Modelfile ---
    send_progress(app_handle, model_id, filename, "generating_modelfile", 100.0, "Generating Modelfile...");
    
    let config = ModelFileConfig {
        model_id: model_id.to_string(),
        gguf_filename: filename.to_string(),
        model_dir: model_dir.clone(),
    };
    
    let modelfile_path_final = match write_modelfile(&model_dir, &config).await {
        Ok(path) => {
            log::info!("Modelfile created at: {:?}", path);
            send_progress(app_handle, model_id, filename, "modelfile_created", 100.0, 
                "Modelfile created");
            path
        }
        Err(e) => {
            log::warn!("Failed to create Modelfile: {}", e);
            remove_cancellation_token(&download_id);
            return Err(format!("Failed to create Modelfile: {}", e));
        }
    };
    
    // --- Generate metadata.json ---
    let _parameter_count = extract_parameter_count(filename);
    if let Err(e) = write_metadata(
        &model_dir, 
        model_id, 
        filename, 
        Some(quantization.clone()), 
        _parameter_count
    ).await {
        log::warn!("Failed to create metadata.json: {}", e);
    }
    
    // --- Create Ollama Model with retry logic ---
    send_progress(app_handle, model_id, filename, "creating_ollama_model", 100.0, 
        "Creating Ollama model...");
    
    let model_name = format!("{}_{}", 
        model_id.replace("/", "_"), 
        quantization.as_str()
    );
    
    let ollama_client = OllamaModelClient::new();
    let max_retries = 3;
    let mut current_retry = 0;
    let mut ollama_created = false;
    let mut last_error = String::new();
    
    while current_retry < max_retries && !ollama_created {
        current_retry += 1;
        
        if current_retry > 1 {
            let wait_seconds = 2u64.pow(current_retry as u32 - 1);
            send_progress(app_handle, model_id, filename, "retrying_ollama_creation", 100.0, 
                &format!("Retrying Ollama model creation (attempt {}/{})...", current_retry, max_retries));
            
            tokio::time::sleep(tokio::time::Duration::from_secs(wait_seconds)).await;
        }
        
        match ollama_client.create_model(&model_name, &modelfile_path_final).await {
            Ok(message) => {
                ollama_created = true;
                log::info!("Ollama model created: {} - {}", model_name, message);
                
                send_progress(app_handle, model_id, filename, "ollama_model_created", 100.0, 
                    &format!("Ollama model '{}' created successfully", model_name));
                
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
                    continue;
                } else {
                    log::error!("Failed to create Ollama model after {} attempts: {}", 
                        max_retries, last_error);
                    
                    send_progress(app_handle, model_id, filename, "ollama_model_failed", 100.0, 
                        &format!("Failed to create Ollama model: {}", last_error));
                    
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
    
    let _ = app_handle.emit("model-download-complete", &serde_json::json!({
        "model_id": model_id,
        "filename": filename,
        "path": file_path.to_str().unwrap_or(""),
        "modelfile_path": modelfile_path_final.to_str().unwrap_or(""),
        "quantization": quantization,
        "ollama_model_name": model_name,
        "ollama_created": ollama_created,
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