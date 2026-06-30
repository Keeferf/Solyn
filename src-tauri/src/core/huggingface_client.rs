// src/core/huggingface_client.rs
use reqwest;
use serde_json;
use std::time::Duration;
use crate::data::huggingface_model_types::{HuggingFaceModelListing, GGUFFileInfo};

// Helper function to extract parameter count from filename
fn extract_parameter_count(filename: &str) -> Option<String> {
    let lower = filename.to_lowercase();
    
    // Check for common patterns
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
    
    // Try regex patterns for more complex cases
    let patterns = [
        r"(\d+)x(\d+)b",     // 8x7B, etc.
        r"(\d+\.?\d*)b",     // 7B, 13B, 1.5B
        r"(\d+)m",           // 125M, 350M
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

pub fn extract_gguf_files(siblings: Option<&Vec<serde_json::Value>>) -> Vec<GGUFFileInfo> {
    let mut gguf_files = Vec::new();
    
    if let Some(siblings) = siblings {
        for file in siblings {
            let filename = file["rfilename"].as_str()
                .or_else(|| file["filename"].as_str())
                .unwrap_or("");
            
            if filename.ends_with(".gguf") {
                // Try multiple possible field names for size
                let size = file["size"].as_u64()
                    .or_else(|| file["file_size"].as_u64())
                    .or_else(|| {
                        // Some APIs use a nested object for file info
                        file["file"]["size"].as_u64()
                    })
                    .unwrap_or(0);
                
                // Construct the download URL
                let model_id = file.get("model_id")
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                
                let url = if !model_id.is_empty() {
                    format!("https://huggingface.co/{}/resolve/main/{}", model_id, filename)
                } else {
                    format!("https://huggingface.co/resolve/main/{}", filename)
                };
                
                // Extract parameter count from filename
                let parameter_count = extract_parameter_count(filename);
                
                gguf_files.push(GGUFFileInfo {
                    filename: filename.to_string(),
                    size,
                    url,
                    parameter_count,
                });
            }
        }
    }
    
    gguf_files.sort_by(|a, b| b.size.cmp(&a.size));
    gguf_files
}

pub async fn fetch_hugging_face_models(
    page: Option<usize>,
    limit: Option<usize>,
) -> Result<Vec<HuggingFaceModelListing>, String> {
    let page = page.unwrap_or(1);
    let limit = limit.unwrap_or(20);
    let client = reqwest::Client::new();
    
    // Fix: Use 0-based offset for pagination
    // Page 1 = offset 0, Page 2 = offset 20, Page 3 = offset 40, etc.
    let offset = (page - 1) * limit;
    
    // Use "filter" parameter to specifically request models with GGUF files.
    // The "full" parameter ensures we get the complete sibling list.
    let url = format!(
        "https://huggingface.co/api/models?filter=gguf&full=true&sort=downloads&direction=-1&limit={}&offset={}",
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
        
        // Get siblings - with "full=true" we should have all siblings
        let siblings = item["siblings"].as_array();
        
        // Add model_id to each sibling for URL construction
        let siblings_with_model_id = siblings.map(|siblings_vec| {
            let mut enhanced_siblings = Vec::new();
            for sibling in siblings_vec {
                let mut enhanced = sibling.clone();
                enhanced["model_id"] = serde_json::Value::String(id.clone());
                enhanced_siblings.push(enhanced);
            }
            enhanced_siblings
        });
        
        let gguf_files = extract_gguf_files(siblings_with_model_id.as_ref());
        
        if gguf_files.is_empty() {
            continue;
        }
        
        // Split the ID into author and name components
        let parts: Vec<&str> = id.split('/').collect();
        let author = parts.get(0).unwrap_or(&"").to_string();
        let name = parts.get(1).unwrap_or(&"").to_string();
        
        let model = HuggingFaceModelListing {
            id: id.clone(),
            model_id: id.clone(),
            author,
            name: name.clone(),
            downloads: item["downloads"].as_u64(),
            likes: item["likes"].as_u64(),
            description: item["description"].as_str().map(|s| s.to_string()),
            gguf_files,
        };
        
        models.push(model);
    }
    
    Ok(models)
}

pub async fn get_total_model_count() -> Result<usize, String> {
    let client = reqwest::Client::new();
    
    // Use the same filter for consistency
    let url = "https://huggingface.co/api/models?filter=gguf&limit=1000";
    
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
    
    let data: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;
    
    // Handle both array and object responses
    let count = if let Some(items_array) = data.as_array() {
        items_array.len()
    } else if let Some(models_array) = data.get("models").and_then(|v| v.as_array()) {
        models_array.len()
    } else {
        0
    };
    
    Ok(count)
}