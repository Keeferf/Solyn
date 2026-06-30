use reqwest;
use serde_json;
use std::time::Duration;
use tauri::WebviewWindow;
use tokio::io::AsyncWriteExt;
use futures_util::StreamExt;
use crate::data::huggingface_model_types::GGUFFileInfo;
use crate::events::progress_broadcaster::broadcast_model_acquisition_progress;
use crate::core::huggingface_client::extract_gguf_files;

pub async fn fetch_gguf_metadata(model_id: &str) -> Result<GGUFFileInfo, String> {
    let client = reqwest::Client::new();
    let info_url = format!("https://huggingface.co/api/models/{}", model_id);
    
    let response = client
        .get(&info_url)
        .header("User-Agent", "SolynApp/1.0")
        .send()
        .await
        .map_err(|e| format!("Failed to get model info: {}", e))?;
    
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
    
    Ok(gguf_files.first().cloned().unwrap())
}

pub async fn download_gguf_model(
    window: &WebviewWindow,
    model_id: &str,
    gguf_metadata: &GGUFFileInfo,
) -> Result<(), String> {
    let client = reqwest::Client::new();
    
    let model_name = model_id.replace("/", "-");
    let download_dir = std::path::Path::new("models").join(&model_name);
    std::fs::create_dir_all(&download_dir)
        .map_err(|e| format!("Failed to create model directory: {}", e))?;
    
    // Use the URL from the metadata, or construct it if not available
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
    
    Ok(())
}

pub async fn generate_ollama_modelfile(
    window: &WebviewWindow,
    model_id: &str,
    gguf_metadata: &GGUFFileInfo,
) -> Result<(), String> {
    let model_name = model_id.replace("/", "-");
    let model_dir = std::path::Path::new("models").join(&model_name);
    let gguf_path = model_dir.join(&gguf_metadata.filename);
    
    if !gguf_path.exists() {
        return Err("GGUF file not found".to_string());
    }
    
    let modelfile_content = format!(
        r#"FROM {}
TEMPLATE "{{ .Prompt }}"
SYSTEM "You are a helpful AI assistant."

# Model parameters
PARAMETER temperature 0.7
PARAMETER top_p 0.9
PARAMETER top_k 40
PARAMETER repeat_penalty 1.1

# GGUF quantization: {}
"#,
        gguf_path.display(),
        gguf_metadata.quantization
    );
    
    let modelfile_path = model_dir.join("Modelfile");
    std::fs::write(modelfile_path, modelfile_content)
        .map_err(|e| format!("Failed to create Modelfile: {}", e))?;
    
    broadcast_model_acquisition_progress(window, model_id, "converting", 75, "Modelfile created successfully");
    
    Ok(())
}

pub async fn import_model_into_ollama(model_id: &str) -> Result<(), String> {
    let model_name = model_id.replace("/", "-");
    let model_dir = std::path::Path::new("models").join(&model_name);
    let modelfile_path = model_dir.join("Modelfile");
    
    if !modelfile_path.exists() {
        return Err("Modelfile not found".to_string());
    }
    
    let modelfile_content = std::fs::read_to_string(modelfile_path)
        .map_err(|e| format!("Failed to read Modelfile: {}", e))?;
    
    let client = reqwest::Client::new();
    let payload = serde_json::json!({
        "name": model_name,
        "modelfile": modelfile_content,
        "stream": false,
    });
    
    let response = client
        .post("http://localhost:11434/api/create")
        .json(&payload)
        .timeout(Duration::from_secs(300))
        .send()
        .await
        .map_err(|e| format!("Failed to create model in Ollama: {}", e))?;
    
    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("Ollama create failed: {}", error_text));
    }
    
    Ok(())
}