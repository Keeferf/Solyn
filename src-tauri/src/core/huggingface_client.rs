// src/core/huggingface_client.rs
use reqwest;
use serde_json;
use std::time::Duration;
use std::collections::HashMap;
use std::sync::Mutex;
use once_cell::sync::Lazy;
use tokio::fs;
use tokio::io::AsyncWriteExt;
use tauri;
use tauri::Manager;      // Add this for path()
use tauri::Emitter;       // Add this for emit()
use futures_util::StreamExt;
use crate::data::huggingface_model_types::{HFModelSummary, HFModelDetails, GGUFFileInfo, ModelFilter, SearchModelsResponse};
use crate::data::download_state::ModelAcquisitionProgress;

static MODEL_DETAILS_CACHE: Lazy<Mutex<HashMap<String, HFModelDetails>>> = 
    Lazy::new(|| Mutex::new(HashMap::new()));

static GGUF_MODELS_CACHE: Lazy<Mutex<HashMap<ModelFilter, Vec<HFModelSummary>>>> = 
    Lazy::new(|| Mutex::new(HashMap::new()));

static SEARCH_CACHE: Lazy<Mutex<HashMap<String, Vec<HFModelSummary>>>> = 
    Lazy::new(|| Mutex::new(HashMap::new()));

const MAX_MODELS: usize = 100;
const BATCH_SIZE: usize = 100;

fn extract_parameter_count(filename: &str) -> Option<String> {
    let lower = filename.to_lowercase();
    
    if lower.contains("70b") { return Some("70B".to_string()); }
    if lower.contains("13b") { return Some("13B".to_string()); }
    if lower.contains("8x7b") { return Some("8x7B".to_string()); }
    if lower.contains("7b") { return Some("7B".to_string()); }
    if lower.contains("3b") { return Some("3B".to_string()); }
    if lower.contains("1b") { return Some("1B".to_string()); }
    if lower.contains("405b") { return Some("405B".to_string()); }
    if lower.contains("125m") { return Some("125M".to_string()); }
    if lower.contains("350m") { return Some("350M".to_string()); }
    if lower.contains("1.5b") { return Some("1.5B".to_string()); }
    if lower.contains("2.7b") { return Some("2.7B".to_string()); }
    if lower.contains("6.7b") { return Some("6.7B".to_string()); }
    if lower.contains("14b") { return Some("14B".to_string()); }
    if lower.contains("22b") { return Some("22B".to_string()); }
    if lower.contains("34b") { return Some("34B".to_string()); }
    
    let patterns = [
        r"(\d+)x(\d+)b", 
        r"(\d+\.?\d*)b",
        r"(\d+)m",
    ];
    
    for pattern in patterns {
        if let Ok(re) = regex::Regex::new(pattern) {
            if let Some(caps) = re.captures(&lower) {
                if let Some(matched) = caps.get(0) {
                    let param = matched.as_str().to_uppercase();
                    return Some(param);
                }
            }
        }
    }
    
    None
}

fn extract_quantization(filename: &str) -> Option<String> {
    let name = filename.replace(".gguf", "");
    let patterns = [
        r"IQ[1-4]_[XSML]?",
        r"Q[2-8]_[0-9K_][0-9K_]*",
        r"Q[2-8]_[0-9]",
        r"F[1-9][0-9]?",
        r"q4_k_m",
        r"q5_k_m",
        r"q6_k",
        r"q8_0",
        r"q4_0",
        r"q5_0",
        r"q2_k",
        r"q3_k",
        r"f16",
        r"f32",
    ];
    
    for pattern in patterns {
        if let Ok(re) = regex::Regex::new(&format!(r"(?i){}", pattern)) {
            if let Some(caps) = re.captures(&name) {
                if let Some(matched) = caps.get(0) {
                    let quant = matched.as_str().to_uppercase();
                    let normalized = match quant.as_str() {
                        "Q4_K_M" => "Q4_K_M",
                        "Q5_K_M" => "Q5_K_M",
                        "Q6_K" => "Q6_K",
                        "Q8_0" => "Q8_0",
                        "Q4_0" => "Q4_0",
                        "Q5_0" => "Q5_0",
                        "Q2_K" => "Q2_K",
                        "Q3_K" => "Q3_K",
                        "F16" => "F16",
                        "F32" => "F32",
                        _ => &quant,
                    };
                    return Some(normalized.to_string());
                }
            }
        }
    }
    
    None
}

pub fn extract_gguf_files(siblings: Option<&Vec<serde_json::Value>>) -> Vec<GGUFFileInfo> {
    let mut gguf_files = Vec::new();
    
    if let Some(siblings) = siblings {
        for file in siblings {
            let filename = file["rfilename"].as_str()
                .or_else(|| file["filename"].as_str())
                .unwrap_or("");
            if filename.ends_with(".gguf") {
                let size = file["size"].as_u64()
                    .or_else(|| file["file_size"].as_u64())
                    .or_else(|| {
                        file["file"]["size"].as_u64()
                    })
                    .unwrap_or(0);

                let model_id = file.get("model_id")
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                
                let url = if !model_id.is_empty() {
                    format!("https://huggingface.co/{}/resolve/main/{}", model_id, filename)
                } else {
                    format!("https://huggingface.co/resolve/main/{}", filename)
                };

                let parameter_count = extract_parameter_count(filename);
                let quantization = extract_quantization(filename);
                
                gguf_files.push(GGUFFileInfo {
                    filename: filename.to_string(),
                    size,
                    url,
                    parameter_count,
                    quantization,
                });
            }
        }
    }
    
    gguf_files.sort_by(|a, b| b.size.cmp(&a.size));
    gguf_files
}

async fn fetch_file_sizes(model_id: &str, filenames: &[String]) -> HashMap<String, u64> {
    let mut size_map = HashMap::new();
    let client = reqwest::Client::new();
    
    let mut tasks = Vec::new();
    
    for filename in filenames {
        let client = client.clone();
        let model_id = model_id.to_string();
        let filename = filename.clone();
        
        let task = tokio::spawn(async move {
            let url = format!("https://huggingface.co/{}/resolve/main/{}", model_id, filename);
            let response = client
                .head(&url)
                .header("User-Agent", "SolynApp/1.0")
                .timeout(Duration::from_secs(10))
                .send()
                .await;
            
            if let Ok(response) = response {
                if let Some(size) = response
                    .headers()
                    .get("content-length")
                    .and_then(|v| v.to_str().ok())
                    .and_then(|s| s.parse::<u64>().ok())
                {
                    return Some((filename, size));
                }
            }
            None
        });
        
        tasks.push(task);
    }
    
    for task in tasks {
        if let Ok(Some((filename, size))) = task.await {
            size_map.insert(filename, size);
        }
    }
    
    size_map
}

async fn fetch_gguf_models_with_filter(filter: ModelFilter) -> Result<Vec<HFModelSummary>, String> {
    {
        let cache = GGUF_MODELS_CACHE.lock().unwrap();
        if let Some(models) = cache.get(&filter) {
            return Ok(models.clone());
        }
    }
    
    let client = reqwest::Client::new();
    let mut all_models = Vec::new();
    let mut page = 1;
    let mut consecutive_empty_pages = 0;
    
    let sort_param = match filter {
        ModelFilter::MostDownloads => "downloads",
        ModelFilter::MostLiked => "likes",
        ModelFilter::Recent => "lastModified",
    };
    
    loop {
        if all_models.len() >= MAX_MODELS {
            break;
        }

        let url = format!(
            "https://huggingface.co/api/models?search=gguf&sort={}&direction=-1&limit={}&page={}",
            sort_param, BATCH_SIZE, page
        );
        
        let response = client
            .get(&url)
            .header("User-Agent", "SolynApp/1.0")
            .header("Cache-Control", "no-cache")
            .timeout(Duration::from_secs(30))
            .send()
            .await
            .map_err(|e| format!("Failed to fetch Hugging Face models: {}", e))?;
        
        if !response.status().is_success() {
            return Err(format!("Hugging Face API error: {}", response.status()));
        }
        
        let data: serde_json::Value = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse response: {}", e))?;
        
        let items = if let Some(items_array) = data.as_array() {
            items_array.clone()
        } else if let Some(models_array) = data.get("models").and_then(|v| v.as_array()) {
            models_array.clone()
        } else {
            break;
        };
        
        if items.is_empty() {
            consecutive_empty_pages += 1;
            if consecutive_empty_pages > 2 {
                break;
            }
            page += 1;
            continue;
        }

        consecutive_empty_pages = 0;
        
        let remaining = MAX_MODELS - all_models.len();
        
        for item in items.iter().take(remaining) {
            let id = item["id"].as_str().unwrap_or("").to_string();
            if id.is_empty() {
                continue;
            }
            
            let siblings = item.get("siblings").and_then(|s| s.as_array());
            let has_gguf = siblings
                .map(|s| s.iter().any(|f| {
                    f["rfilename"].as_str()
                        .or_else(|| f["filename"].as_str())
                        .map(|name| name.ends_with(".gguf"))
                        .unwrap_or(false)
                }))
                .unwrap_or(false);
            
            if siblings.is_none() || has_gguf {
                let parts: Vec<&str> = id.split('/').collect();
                let author = parts.get(0).unwrap_or(&"").to_string();
                let name = parts.get(1).unwrap_or(&"").to_string();
                
                let created_at = item["created_at"].as_str()
                    .or_else(|| item["createdAt"].as_str())
                    .map(|s| s.to_string());
                
                let last_modified = item["last_modified"].as_str()
                    .or_else(|| item["lastModified"].as_str())
                    .map(|s| s.to_string());
                
                all_models.push(HFModelSummary {
                    id: id.clone(),
                    model_id: id,
                    author,
                    name,
                    downloads: item["downloads"].as_u64(),
                    likes: item["likes"].as_u64(),
                    created_at: created_at.clone(),
                    last_modified: last_modified.or(created_at),
                });
            }
        }
        
        page += 1;
        
        if items.len() < BATCH_SIZE {
            break;
        }
        
        if all_models.len() == 0 && page > 5 {
            break;
        }
    }
    
    {
        let mut cache = GGUF_MODELS_CACHE.lock().unwrap();
        cache.insert(filter, all_models.clone());
    }
    
    Ok(all_models)
}

async fn search_gguf_models(
    query: &str,
    filter: ModelFilter,
) -> Result<Vec<HFModelSummary>, String> {
    let cache_key = format!("{}:{}", query, filter.as_str());
    {
        let cache = SEARCH_CACHE.lock().unwrap();
        if let Some(models) = cache.get(&cache_key) {
            return Ok(models.clone());
        }
    }
    
    let client = reqwest::Client::new();
    let mut all_models = Vec::new();
    let mut page = 1;
    let mut consecutive_empty_pages = 0;
    
    let sort_param = match filter {
        ModelFilter::MostDownloads => "downloads",
        ModelFilter::MostLiked => "likes",
        ModelFilter::Recent => "lastModified",
    };
    
    let encoded_query = urlencoding::encode(query);
    
    loop {
        if all_models.len() >= MAX_MODELS {
            break;
        }
        
        let url = format!(
            "https://huggingface.co/api/models?search={}+gguf&sort={}&direction=-1&limit={}&page={}",
            encoded_query, sort_param, BATCH_SIZE, page
        );
        
        let response = client
            .get(&url)
            .header("User-Agent", "SolynApp/1.0")
            .header("Cache-Control", "no-cache")
            .timeout(Duration::from_secs(30))
            .send()
            .await
            .map_err(|e| format!("Failed to search Hugging Face models: {}", e))?;
        
        if !response.status().is_success() {
            return Err(format!("Hugging Face API error: {}", response.status()));
        }
        
        let data: serde_json::Value = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse response: {}", e))?;
        
        let items = if let Some(items_array) = data.as_array() {
            items_array.clone()
        } else if let Some(models_array) = data.get("models").and_then(|v| v.as_array()) {
            models_array.clone()
        } else {
            break;
        };
        
        if items.is_empty() {
            consecutive_empty_pages += 1;
            if consecutive_empty_pages > 2 {
                break;
            }
            page += 1;
            continue;
        }
        
        consecutive_empty_pages = 0;
        let remaining = MAX_MODELS - all_models.len();
        
        for item in items.iter().take(remaining) {
            let id = item["id"].as_str().unwrap_or("").to_string();
            if id.is_empty() {
                continue;
            }
            
            let siblings = item.get("siblings").and_then(|s| s.as_array());
            let has_gguf = siblings
                .map(|s| s.iter().any(|f| {
                    f["rfilename"].as_str()
                        .or_else(|| f["filename"].as_str())
                        .map(|name| name.ends_with(".gguf"))
                        .unwrap_or(false)
                }))
                .unwrap_or(false);
            
            if siblings.is_none() || has_gguf {
                let parts: Vec<&str> = id.split('/').collect();
                let author = parts.get(0).unwrap_or(&"").to_string();
                let name = parts.get(1).unwrap_or(&"").to_string();
                
                let created_at = item["created_at"].as_str()
                    .or_else(|| item["createdAt"].as_str())
                    .map(|s| s.to_string());
                
                let last_modified = item["last_modified"].as_str()
                    .or_else(|| item["lastModified"].as_str())
                    .map(|s| s.to_string());
                
                all_models.push(HFModelSummary {
                    id: id.clone(),
                    model_id: id,
                    author,
                    name,
                    downloads: item["downloads"].as_u64(),
                    likes: item["likes"].as_u64(),
                    created_at: created_at.clone(),
                    last_modified: last_modified.or(created_at),
                });
            }
        }
        
        page += 1;
        
        if items.len() < BATCH_SIZE {
            break;
        }
        
        if all_models.is_empty() && page > 5 {
            break;
        }
    }
    
    {
        let mut cache = SEARCH_CACHE.lock().unwrap();
        cache.insert(cache_key, all_models.clone());
    }
    
    Ok(all_models)
}

pub async fn fetch_hugging_face_models_page(
    page: usize,
    limit: usize,
    filter: &ModelFilter,
) -> Result<Vec<HFModelSummary>, String> {
    let all_models = fetch_gguf_models_with_filter(filter.clone()).await?;
    
    let start = (page - 1) * limit;
    let end = std::cmp::min(start + limit, all_models.len());
    
    if start >= all_models.len() {
        return Ok(Vec::new());
    }
    
    let page_models = all_models[start..end].to_vec();
    Ok(page_models)
}

pub async fn search_hugging_face_models(
    query: &str,
    page: usize,
    limit: usize,
    filter: &ModelFilter,
) -> Result<SearchModelsResponse, String> {
    if query.trim().is_empty() {
        let all_models = fetch_gguf_models_with_filter(filter.clone()).await?;
        let start = (page - 1) * limit;
        let end = std::cmp::min(start + limit, all_models.len());
        
        let models = if start >= all_models.len() {
            Vec::new()
        } else {
            all_models[start..end].to_vec()
        };
        
        return Ok(SearchModelsResponse {
            models,
            total: all_models.len(),
            has_more: end < all_models.len(),
        });
    }
    
    let all_models = search_gguf_models(query, filter.clone()).await?;
    let start = (page - 1) * limit;
    let end = std::cmp::min(start + limit, all_models.len());
    
    let models = if start >= all_models.len() {
        Vec::new()
    } else {
        all_models[start..end].to_vec()
    };
    
    Ok(SearchModelsResponse {
        models,
        total: all_models.len(),
        has_more: end < all_models.len(),
    })
}

pub async fn get_total_model_count_for_filter(filter: &ModelFilter) -> Result<usize, String> {
    let all_models = fetch_gguf_models_with_filter(filter.clone()).await?;
    Ok(all_models.len())
}

pub async fn get_search_model_count(query: &str, filter: &ModelFilter) -> Result<usize, String> {
    if query.trim().is_empty() {
        return get_total_model_count_for_filter(filter).await;
    }
    let all_models = search_gguf_models(query, filter.clone()).await?;
    Ok(all_models.len())
}

pub async fn fetch_model_details(model_id: &str) -> Result<HFModelDetails, String> {
    {
        let cache = MODEL_DETAILS_CACHE.lock().unwrap();
        if let Some(cached) = cache.get(model_id) {
            return Ok(cached.clone());
        }
    }
    
    let client = reqwest::Client::new();
    
    let url = format!("https://huggingface.co/api/models/{}?full=true", model_id);
    
    let response = client
        .get(&url)
        .header("User-Agent", "SolynApp/1.0")
        .timeout(Duration::from_secs(30))
        .send()
        .await
        .map_err(|e| format!("Failed to fetch model details: {}", e))?;
    
    if !response.status().is_success() {
        return Err(format!("Hugging Face API error: {}", response.status()));
    }
    
    let data: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;
    
    let id = data["id"].as_str().unwrap_or("").to_string();
    if id.is_empty() {
        return Err("Invalid model ID".to_string());
    }
    
    let siblings = data["siblings"].as_array();
    
    let mut gguf_filenames = Vec::new();
    let mut siblings_with_model_id = Vec::new();
    
    if let Some(siblings_vec) = siblings {
        for sibling in siblings_vec {
            let filename = sibling["rfilename"].as_str()
                .or_else(|| sibling["filename"].as_str())
                .unwrap_or("");
            
            if filename.ends_with(".gguf") {
                gguf_filenames.push(filename.to_string());
                
                let mut enhanced = sibling.clone();
                enhanced["model_id"] = serde_json::Value::String(id.clone());
                siblings_with_model_id.push(enhanced);
            }
        }
    }
    
    if !gguf_filenames.is_empty() {
        let size_map = fetch_file_sizes(&id, &gguf_filenames).await;
        
        for sibling in &mut siblings_with_model_id {
            if let Some(filename) = sibling["rfilename"].as_str()
                .or_else(|| sibling["filename"].as_str())
            {
                if let Some(&size) = size_map.get(filename) {
                    sibling["size"] = serde_json::Value::Number(size.into());
                }
            }
        }
    }
    
    let gguf_files = extract_gguf_files(Some(&siblings_with_model_id));
    
    if gguf_files.is_empty() {
        return Err("No GGUF files found in this model repository".to_string());
    }
    
    let parts: Vec<&str> = id.split('/').collect();
    let author = parts.get(0).unwrap_or(&"").to_string();
    let name = parts.get(1).unwrap_or(&"").to_string();
    
    let model = HFModelDetails {
        id: id.clone(),
        model_id: id.clone(),
        author,
        name: name.clone(),
        downloads: data["downloads"].as_u64(),
        likes: data["likes"].as_u64(),
        description: data["description"].as_str().map(|s| s.to_string()),
        gguf_files,
    };
    
    {
        let mut cache = MODEL_DETAILS_CACHE.lock().unwrap();
        cache.insert(model_id.to_string(), model.clone());
    }
    
    Ok(model)
}

pub fn clear_model_cache(filter: Option<ModelFilter>) {
    let mut cache = GGUF_MODELS_CACHE.lock().unwrap();
    if let Some(filter) = filter {
        cache.remove(&filter);
    } else {
        cache.clear();
    }
    
    let mut search_cache = SEARCH_CACHE.lock().unwrap();
    search_cache.clear();
}

// Download function - Fixed for Tauri 2.0
pub async fn download_model_file(
    model_id: &str,
    filename: &str,
    app_handle: &tauri::AppHandle,
) -> Result<(), String> {
    // Get the app's data directory
    let app_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;
    
    // Create models directory if it doesn't exist
    let models_dir = app_dir.join("models");
    if !models_dir.exists() {
        fs::create_dir_all(&models_dir)
            .await
            .map_err(|e| format!("Failed to create models directory: {}", e))?;
    }
    
    // Create model-specific subdirectory
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
        return Err(format!("File {} already exists", filename));
    }
    
    // Create download URL
    let url = format!(
        "https://huggingface.co/{}/resolve/main/{}",
        model_id, filename
    );
    
    let client = reqwest::Client::new();
    
    // Send initial progress
    let initial_progress = ModelAcquisitionProgress {
        model_id: model_id.to_string(),
        filename: filename.to_string(),
        status: "starting".to_string(),
        progress: 0.0,
        message: "Starting download...".to_string(),
    };
    let _ = app_handle.emit("model-download-progress", initial_progress);
    
    // Start download
    let response = client
        .get(&url)
        .header("User-Agent", "SolynApp/1.0")
        .timeout(Duration::from_secs(3600))
        .send()
        .await
        .map_err(|e| format!("Failed to start download: {}", e))?;
    
    if !response.status().is_success() {
        return Err(format!("Download failed with status: {}", response.status()));
    }
    
    // Get total file size
    let total_size = response
        .content_length()
        .ok_or_else(|| "Failed to get file size".to_string())?;
    
    // Create file and download with progress
    let mut file = fs::File::create(&file_path)
        .await
        .map_err(|e| format!("Failed to create file: {}", e))?;
    
    let mut downloaded: u64 = 0;
    let mut stream = response.bytes_stream();
    
    let mut last_update = tokio::time::Instant::now();
    let update_interval = tokio::time::Duration::from_millis(500);
    
    while let Some(chunk_result) = stream.next().await {
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
            
            let progress_msg = ModelAcquisitionProgress {
                model_id: model_id.to_string(),
                filename: filename.to_string(),
                status: "downloading".to_string(),
                progress: progress_rounded,
                message: format!("Downloading... {:.1}%", progress_rounded),
            };
            let _ = app_handle.emit("model-download-progress", progress_msg);
            
            last_update = tokio::time::Instant::now();
        }
    }
    
    // Flush and sync file
    file.flush().await
        .map_err(|e| format!("Failed to flush file: {}", e))?;
    file.sync_all().await
        .map_err(|e| format!("Failed to sync file: {}", e))?;
    
    // Send completion progress
    let complete_progress = ModelAcquisitionProgress {
        model_id: model_id.to_string(),
        filename: filename.to_string(),
        status: "complete".to_string(),
        progress: 100.0,
        message: "Download complete!".to_string(),
    };
    let _ = app_handle.emit("model-download-progress", complete_progress);
    
    // Send separate completion event
    let _ = app_handle.emit("model-download-complete", &serde_json::json!({
        "model_id": model_id,
        "filename": filename,
        "path": file_path.to_str().unwrap_or(""),
    }));
    
    Ok(())
}