use reqwest;
use serde_json;
use std::time::Duration;
use std::collections::HashMap;
use std::sync::Mutex;
use once_cell::sync::Lazy;
use crate::data::huggingface_model_types::{HFModelSummary, HFModelDetails, GGUFFileInfo};

static MODEL_DETAILS_CACHE: Lazy<Mutex<HashMap<String, HFModelDetails>>> = 
    Lazy::new(|| Mutex::new(HashMap::new()));

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

// NEW: Function to fetch file sizes using HEAD requests
async fn fetch_file_sizes(model_id: &str, filenames: &[String]) -> HashMap<String, u64> {
    let mut size_map = HashMap::new();
    let client = reqwest::Client::new();
    
    // Process files in parallel with a semaphore to avoid rate limiting
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
    
    // Collect results
    for task in tasks {
        if let Ok(Some((filename, size))) = task.await {
            size_map.insert(filename, size);
        }
    }
    
    size_map
}

pub async fn fetch_hugging_face_models(
    page: Option<usize>,
    limit: Option<usize>,
) -> Result<Vec<HFModelSummary>, String> {
    let page = page.unwrap_or(1);
    let limit = limit.unwrap_or(20);
    let client = reqwest::Client::new();
    let offset = (page - 1) * limit;
    let url = format!(
        "https://huggingface.co/api/models?filter=gguf&sort=downloads&direction=-1&limit={}&offset={}",
        limit, offset
    );
    
    let response = client
        .get(&url)
        .header("User-Agent", "SolynApp/1.0")
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
    
    let mut models = Vec::new();
    
    // The response could be an array or an object with a "models" field
    let items = if let Some(items_array) = data.as_array() {
        items_array
    } else if let Some(models_array) = data.get("models").and_then(|v| v.as_array()) {
        models_array
    } else {
        return Err("Invalid response format - expected array or object with 'models' field".to_string());
    };
    
    for item in items {
        let id = item["id"].as_str().unwrap_or("").to_string();
        if id.is_empty() {
            continue;
        }
        
        // Split the ID into author and name components
        let parts: Vec<&str> = id.split('/').collect();
        let author = parts.get(0).unwrap_or(&"").to_string();
        let name = parts.get(1).unwrap_or(&"").to_string();
        
        let model = HFModelSummary {
            id: id.clone(),
            model_id: id.clone(),
            author,
            name: name.clone(),
            downloads: item["downloads"].as_u64(),
            likes: item["likes"].as_u64(),
        };
        
        models.push(model);
    }
    
    Ok(models)
}

// UPDATED: Fetch full model details with GGUF files - WITH CACHING and HEAD requests for sizes
pub async fn fetch_model_details(model_id: &str) -> Result<HFModelDetails, String> {
    // Check cache first
    {
        let cache = MODEL_DETAILS_CACHE.lock().unwrap();
        if let Some(cached) = cache.get(model_id) {
            return Ok(cached.clone());
        }
    }
    
    let client = reqwest::Client::new();
    
    // Use full=true to get all siblings with GGUF files
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
    
    // Get siblings
    let siblings = data["siblings"].as_array();
    
    // Collect GGUF filenames and build enhanced siblings
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
    
    // If we have GGUF files, fetch their actual sizes using HEAD requests
    if !gguf_filenames.is_empty() {
        let size_map = fetch_file_sizes(&id, &gguf_filenames).await;
        
        // Update siblings with sizes
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
    
    // Split the ID into author and name components
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
    
    // Store in cache
    {
        let mut cache = MODEL_DETAILS_CACHE.lock().unwrap();
        cache.insert(model_id.to_string(), model.clone());
    }
    
    Ok(model)
}

pub async fn get_total_model_count() -> Result<usize, String> {
    let client = reqwest::Client::new();
    let url = "https://huggingface.co/api/models?filter=gguf&limit=1";
    
    let response = client
        .get(url)
        .header("User-Agent", "SolynApp/1.0")
        .timeout(Duration::from_secs(30))
        .send()
        .await
        .map_err(|e| format!("Failed to fetch model count: {}", e))?;
    
    if !response.status().is_success() {
        return Err(format!("Hugging Face API error: {}", response.status()));
    }
    
    // Get the total count from the Link header
    let link_header = response.headers()
        .get("link")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    
    // Parse the last page number from the Link header
    // Example: <https://huggingface.co/api/models?filter=gguf&limit=1&offset=100>; rel="last"
    if let Some(last_url) = link_header.split(',')
        .find(|part| part.contains("rel=\"last\""))
        .and_then(|part| part.split('>').next())
    {
        // The type is now &str, not Option
        let last_url = last_url.trim_start_matches('<');
        if let Some(offset_param) = last_url.split('&').find(|p| p.starts_with("offset=")) {
            if let Ok(offset) = offset_param.split('=').nth(1).unwrap_or("0").parse::<usize>() {
                return Ok(offset + 1); // offset + 1 gives total count
            }
        }
    }
    
    // Fallback: get the data and count manually
    let data: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;
    
    let count = if let Some(items_array) = data.as_array() {
        items_array.len()
    } else if let Some(models_array) = data.get("models").and_then(|v| v.as_array()) {
        models_array.len()
    } else {
        0
    };
    
    Ok(count)
}