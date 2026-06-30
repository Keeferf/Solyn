// src/core/huggingface_client.rs
use reqwest;
use serde_json;
use std::time::Duration;
use crate::data::huggingface_model_types::{HuggingFaceModelListing, GGUFFileInfo};

pub fn extract_gguf_files(siblings: Option<&Vec<serde_json::Value>>) -> Vec<GGUFFileInfo> {
    let mut gguf_files = Vec::new();
    
    if let Some(siblings) = siblings {
        for file in siblings {
            let filename = file["rfilename"].as_str().unwrap_or("");
            
            if filename.ends_with(".gguf") {
                let size = file["size"].as_u64().unwrap_or(0);
                let quantization = detect_quantization_level(filename);
                
                // Construct the download URL
                let model_id = file.get("model_id")
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                
                let url = if !model_id.is_empty() {
                    format!("https://huggingface.co/{}/resolve/main/{}", model_id, filename)
                } else {
                    format!("https://huggingface.co/resolve/main/{}", filename)
                };
                
                gguf_files.push(GGUFFileInfo {
                    filename: filename.to_string(),
                    size,
                    quantization,
                    url,
                });
            }
        }
    }
    
    gguf_files.sort_by(|a, b| b.size.cmp(&a.size));
    gguf_files
}

fn detect_quantization_level(filename: &str) -> String {
    let quant_patterns = [
        "Q8_0", "Q8_1", "Q6_K", "Q5_K", "Q5_0", "Q5_1",
        "Q4_K", "Q4_0", "Q4_1", "Q3_K", "Q3_0", "Q3_1",
        "Q2_K", "IQ4_NL", "IQ3_XS", "IQ2_XS", "FP16", "FP32",
    ];
    
    for pattern in quant_patterns {
        if filename.contains(pattern) {
            return pattern.to_string();
        }
    }
    
    "Unknown".to_string()
}

pub async fn fetch_hugging_face_models(
    page: Option<usize>,
    limit: Option<usize>,
) -> Result<Vec<HuggingFaceModelListing>, String> {
    let page = page.unwrap_or(1);
    let limit = limit.unwrap_or(20);
    let client = reqwest::Client::new();
    
    // Fetch models with GGUF files, sorted by downloads
    let url = format!(
        "https://huggingface.co/api/models?search=GGUF&sort=downloads&direction=-1&limit={}&offset={}",
        limit, (page - 1) * limit
    );
    
    println!("Fetching models from URL: {}", url);
    
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
    
    let items = data.as_array().ok_or("Invalid response format - expected array")?;
    println!("Found {} items in response", items.len());
    
    for item in items {
        let id = item["id"].as_str().unwrap_or("").to_string();
        if id.is_empty() {
            continue;
        }
        
        // Get siblings and extract GGUF files
        let siblings = item["siblings"].as_array();
        
        // We need to add the model_id to each sibling for URL construction
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
        
        // Extract tags
        let tags = item["tags"]
            .as_array()
            .map(|arr| {
                arr.iter()
                    .filter_map(|t| t.as_str().map(|s| s.to_string()))
                    .collect()
            })
            .unwrap_or_else(Vec::new);
        
        let model = HuggingFaceModelListing {
            id: id.clone(),
            model_id: id.clone(),
            author,
            name: name.clone(),
            downloads: item["downloads"].as_u64(),
            likes: item["likes"].as_u64(),
            description: item["description"].as_str().map(|s| s.to_string()),
            tags,
            gguf_files,
        };
        
        models.push(model);
    }
    
    println!("Returning {} models with GGUF files", models.len());
    Ok(models)
}

pub async fn get_total_model_count() -> Result<usize, String> {
    let client = reqwest::Client::new();
    
    let url = "https://huggingface.co/api/models?search=GGUF&limit=1000";
    
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
    
    let count = data.as_array().map(|arr| arr.len()).unwrap_or(0);
    println!("Total model count: {}", count);
    Ok(count)
}