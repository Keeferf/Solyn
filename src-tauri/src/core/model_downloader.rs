// src/core/model_downloader.rs
use reqwest;
use serde_json;
use tauri::WebviewWindow;
use tokio::io::AsyncWriteExt;
use futures_util::StreamExt;
use crate::data::huggingface_model_types::GGUFFileInfo;
use crate::events::progress_broadcaster::broadcast_model_acquisition_progress;
use crate::core::huggingface_client::extract_gguf_files;

pub async fn fetch_gguf_metadata(model_id: &str) -> Result<GGUFFileInfo, String> {
    let client = reqwest::Client::new();
    
    // Use the full=true parameter to get all siblings
    let info_url = format!("https://huggingface.co/api/models/{}?full=true", model_id);
    
    let response = client
        .get(&info_url)
        .header("User-Agent", "SolynApp/1.0")
        .send()
        .await
        .map_err(|e| format!("Failed to get model info: {}", e))?;
    
    if !response.status().is_success() {
        return Err(format!("HTTP error: {}", response.status()));
    }
    
    let data: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse model info: {}", e))?;
    
    // Get siblings and add model_id to each for URL construction
    let siblings = data["siblings"]
        .as_array()
        .ok_or("No files found for model")?;
    
    let siblings_with_model_id = siblings.iter().map(|sibling| {
        let mut enhanced = sibling.clone();
        enhanced["model_id"] = serde_json::Value::String(model_id.to_string());
        enhanced
    }).collect::<Vec<_>>();
    
    let gguf_files = extract_gguf_files(Some(&siblings_with_model_id));
    
    if gguf_files.is_empty() {
        return Err("No GGUF files found in this model repository".to_string());
    }
    
    let selected_file = gguf_files.first().cloned().unwrap();
    Ok(selected_file)
}

pub async fn download_gguf_model(
    window: &WebviewWindow,
    model_id: &str,
    gguf_metadata: &GGUFFileInfo,
) -> Result<String, String> {
    let client = reqwest::Client::new();
    
    let model_name = model_id.replace("/", "-");
    let download_dir = std::path::Path::new("models").join(&model_name);
    std::fs::create_dir_all(&download_dir)
        .map_err(|e| format!("Failed to create model directory: {}", e))?;
    
    // Prefer the URL from metadata, fallback to constructing it
    let file_url = if !gguf_metadata.url.is_empty() {
        gguf_metadata.url.clone()
    } else {
        format!(
            "https://huggingface.co/{}/resolve/main/{}",
            model_id, gguf_metadata.filename
        )
    };
    
    broadcast_model_acquisition_progress(
        window,
        model_id,
        "downloading",
        30,
        &format!("Downloading {} ({:.1} MB)...", 
            gguf_metadata.filename,
            gguf_metadata.size as f64 / 1024.0 / 1024.0
        )
    );
    
    let response = client
        .get(&file_url)
        .header("User-Agent", "SolynApp/1.0")
        .send()
        .await
        .map_err(|e| format!("Failed to download GGUF file: {}", e))?;
    
    if !response.status().is_success() {
        return Err(format!("HTTP error: {}", response.status()));
    }
    
    let total_size = response.content_length().unwrap_or(gguf_metadata.size);
    let mut downloaded = 0u64;
    let mut stream = response.bytes_stream();
    
    let file_path = download_dir.join(&gguf_metadata.filename);
    let mut file = tokio::fs::File::create(&file_path)
        .await
        .map_err(|e| format!("Failed to create file: {}", e))?;
    
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("Download error: {}", e))?;
        downloaded += chunk.len() as u64;
        
        file.write_all(&chunk)
            .await
            .map_err(|e| format!("Failed to write file: {}", e))?;
        
        if total_size > 0 {
            let progress = 30 + ((downloaded as f64 / total_size as f64) * 40.0) as u8;
            let percent = (downloaded as f64 / total_size as f64) * 100.0;
            broadcast_model_acquisition_progress(
                window,
                model_id,
                "downloading",
                progress.min(70),
                &format!("Downloading... {:.1}%", percent)
            );
        }
    }
    
    file.flush().await.map_err(|e| format!("Failed to flush file: {}", e))?;
    
    let file_size_mb = gguf_metadata.size as f64 / 1024.0 / 1024.0;
    let result = format!("Successfully downloaded {} ({:.1} MB) to {}", 
        gguf_metadata.filename, file_size_mb, download_dir.display());
    
    Ok(result)
}