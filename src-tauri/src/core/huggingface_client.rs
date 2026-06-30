// src/core/huggingface_client.rs
use reqwest;
use serde_json;
use std::time::Duration;
use crate::data::huggingface_model_types::{HuggingFaceModelListing, GGUFFileInfo};

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
                
                // Debug log to see what's being extracted
                println!("GGUF file: {}, size: {} bytes ({:.2} MB)", 
                    filename, size, size as f64 / 1024.0 / 1024.0);
                
                gguf_files.push(GGUFFileInfo {
                    filename: filename.to_string(),
                    size,
                    url,
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
    
    println!("Fetching models from URL: {}", url);
    println!("Page: {}, Limit: {}, Offset: {}", page, limit, offset);
    
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
    
    println!("Found {} items in response for page {}", items.len(), page);
    
    // Debug: Log first few model IDs to verify pagination
    if !items.is_empty() {
        let first_ids: Vec<String> = items
            .iter()
            .take(3)
            .filter_map(|item| item["id"].as_str().map(|s| s.to_string()))
            .collect();
        println!("First {} model IDs on page {}: {:?}", first_ids.len(), page, first_ids);
    }
    
    // Debug the first item to see structure
    if let Some(first_item) = items.first() {
        println!("First item structure: {:?}", first_item);
        if let Some(siblings) = first_item.get("siblings") {
            println!("First item siblings: {:?}", siblings);
        }
    }
    
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
    
    println!("Returning {} models with GGUF files for page {}", models.len(), page);
    Ok(models)
}

pub async fn get_total_model_count() -> Result<usize, String> {
    let client = reqwest::Client::new();
    
    // Use the same filter for consistency
    let url = "https://huggingface.co/api/models?filter=gguf&limit=1000";
    
    println!("Fetching total model count from: {}", url);
    
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
    
    println!("Total model count: {}", count);
    Ok(count)
}