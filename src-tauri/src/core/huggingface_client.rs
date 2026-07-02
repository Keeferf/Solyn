use reqwest;
use serde_json;
use std::time::Duration;
use std::collections::HashMap;
use std::sync::Mutex;
use once_cell::sync::Lazy;
use crate::data::huggingface_model_types::{HFModelSummary, HFModelDetails, GGUFFileInfo};

static MODEL_DETAILS_CACHE: Lazy<Mutex<HashMap<String, HFModelDetails>>> = 
    Lazy::new(|| Mutex::new(HashMap::new()));

// Cache for GGUF models (limited to 500)
static GGUF_MODELS_CACHE: Lazy<Mutex<Option<Vec<HFModelSummary>>>> = 
    Lazy::new(|| Mutex::new(None));

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

// Fetch up to 500 GGUF models using search API
async fn fetch_gguf_models() -> Result<Vec<HFModelSummary>, String> {
    // Check cache first
    {
        let cache = GGUF_MODELS_CACHE.lock().unwrap();
        if let Some(models) = cache.as_ref() {
            println!("📊 [BACKEND] Returning cached GGUF models: {}", models.len());
            return Ok(models.clone());
        }
    }
    
    println!("🔄 [BACKEND] Fetching up to 500 GGUF models from Hugging Face using search API...");
    
    let client = reqwest::Client::new();
    let target_count = 500;
    let batch_size = 50; // HF search API limit
    let mut all_models = Vec::new();
    let mut page = 1;
    let mut consecutive_empty_pages = 0;
    
    // Keep fetching pages until we reach 500 or run out of models
    loop {
        // Stop if we've reached our target
        if all_models.len() >= target_count {
            println!("✅ [BACKEND] Reached target of {} models", target_count);
            break;
        }

        // Use search API with gguf query
        let url = format!(
            "https://huggingface.co/api/models?search=gguf&sort=downloads&direction=-1&limit={}&page={}",
            batch_size, page
        );
        
        println!("🔍 [BACKEND] Fetching search page {}: offset={}, expecting up to {} models (have {} so far)",
            page, (page - 1) * batch_size, batch_size, all_models.len());
        
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
        
        // Search API returns array directly
        let items = if let Some(items_array) = data.as_array() {
            items_array.clone()
        } else if let Some(models_array) = data.get("models").and_then(|v| v.as_array()) {
            models_array.clone()
        } else {
            println!("⚠️ [BACKEND] Could not parse response as array or models object");
            break;
        };
        
        if items.is_empty() {
            println!("📭 [BACKEND] Received empty page at page {}", page);
            consecutive_empty_pages += 1;
            if consecutive_empty_pages > 2 {
                println!("⚠️ [BACKEND] Got multiple empty pages, stopping");
                break;
            }
            page += 1;
            continue;
        }

        consecutive_empty_pages = 0;
        
        println!("📊 [BACKEND] Received {} items in search page {}", items.len(), page);
        
        // Debug: Print first 3 model IDs from this page
        println!("🔍 [BACKEND] First 3 model IDs in this page:");
        for (i, item) in items.iter().take(3).enumerate() {
            if let Some(id) = item["id"].as_str() {
                println!("  [{}] {}", i + 1, id);
            }
        }
        
        // Process items and verify they actually have GGUF files
        let remaining = target_count - all_models.len();
        let mut batch_added = 0;
        
        for item in items.iter().take(remaining) {
            let id = item["id"].as_str().unwrap_or("").to_string();
            if id.is_empty() {
                continue;
            }
            
            // Verify this model actually has GGUF files by checking siblings
            // We'll do a quick check - if we can't verify, we'll still include it
            // The detailed view will filter later
            let siblings = item.get("siblings").and_then(|s| s.as_array());
            let has_gguf = siblings
                .map(|s| s.iter().any(|f| {
                    f["rfilename"].as_str()
                        .or_else(|| f["filename"].as_str())
                        .map(|name| name.ends_with(".gguf"))
                        .unwrap_or(false)
                }))
                .unwrap_or(false);
            
            // If the search API didn't include siblings, we'll include the model
            // and let the detail view verify later
            if siblings.is_none() || has_gguf {
                let parts: Vec<&str> = id.split('/').collect();
                let author = parts.get(0).unwrap_or(&"").to_string();
                let name = parts.get(1).unwrap_or(&"").to_string();
                
                all_models.push(HFModelSummary {
                    id: id.clone(),
                    model_id: id,
                    author,
                    name,
                    downloads: item["downloads"].as_u64(),
                    likes: item["likes"].as_u64(),
                });
                
                batch_added += 1;
            } else {
                println!("⏭️ [BACKEND] Skipping {} - no GGUF files found", id);
            }
        }
        
        println!("📊 [BACKEND] Added {} models from search page, total: {} / {}", 
            batch_added, all_models.len(), target_count);
        
        // Move to next page
        page += 1;
        
        // If page was smaller than requested size, we've reached the end of available models
        if items.len() < batch_size {
            println!("📭 [BACKEND] Got less than {} items (got {}), reached end of models",
                batch_size, items.len());
            break;
        }
        
        // Safety: If we're not finding any models with GGUF files for several pages, stop
        if batch_added == 0 && page > 5 {
            println!("⚠️ [BACKEND] No models with GGUF files found in last 5 pages, stopping");
            break;
        }
    }
    
    println!("✅ [BACKEND] Fetched {} GGUF models using search API", all_models.len());
    
    // Cache the models
    {
        let mut cache = GGUF_MODELS_CACHE.lock().unwrap();
        *cache = Some(all_models.clone());
    }
    
    Ok(all_models)
}

// Fetch a page from the cached GGUF models
pub async fn fetch_hugging_face_models_page(
    page: usize,
    limit: usize,
) -> Result<Vec<HFModelSummary>, String> {
    println!("📤 [BACKEND] fetch_hugging_face_models_page called with page: {}, limit: {}", page, limit);
    
    // Fetch models (this will use cache if available)
    let all_models = fetch_gguf_models().await?;
    
    let start = (page - 1) * limit;
    let end = std::cmp::min(start + limit, all_models.len());
    
    println!("📊 [BACKEND] Total cached models: {}, Requested page: {} (returning models {}-{})", 
        all_models.len(), page, start, end);
    
    if start >= all_models.len() {
        println!("📭 [BACKEND] Start index {} >= total {}, returning empty", start, all_models.len());
        return Ok(Vec::new());
    }
    
    let page_models = all_models[start..end].to_vec();
    
    // Debug: Print first 3 model IDs from this page
    if !page_models.is_empty() {
        println!("🔍 [BACKEND] First 3 model IDs on page {}:", page);
        for (i, model) in page_models.iter().take(3).enumerate() {
            println!("  [{}] {}", i + 1, model.model_id);
        }
    }
    
    println!("✅ [BACKEND] Returning {} models for page {}", page_models.len(), page);
    Ok(page_models)
}

// Get total count
pub async fn get_total_model_count() -> Result<usize, String> {
    println!("📤 [BACKEND] get_total_model_count called");
    
    // Fetch models (this will use cache if available)
    let all_models = fetch_gguf_models().await?;
    let count = all_models.len();
    println!("📊 [BACKEND] Total GGUF models available: {}", count);
    Ok(count)
}

pub async fn fetch_model_details(model_id: &str) -> Result<HFModelDetails, String> {
    // Check cache first
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