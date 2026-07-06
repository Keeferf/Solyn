use std::path::PathBuf;
use serde::{Deserialize, Serialize};
use tokio::fs;
use tauri::{AppHandle, Manager};

use super::utils::{extract_parameter_count, extract_quantization};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstalledModelFile {
    pub filename: String,
    pub size: u64,
    pub path: String,
    pub parameter_count: Option<String>,
    pub quantization: Option<String>,
    pub has_modelfile: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstalledModel {
    pub model_id: String,
    pub author: String,
    pub name: String,
    pub files: Vec<InstalledModelFile>,
    pub total_size: u64,
    pub downloaded_at: String,
    pub has_modelfile: bool,
}

/// Get all installed models from the app data directory
pub async fn get_installed_models(app_handle: &AppHandle) -> Result<Vec<InstalledModel>, String> {
    let app_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;
    
    let models_dir = app_dir.join("models");
    
    if !models_dir.exists() {
        return Ok(Vec::new());
    }
    
    let mut installed_models = Vec::new();
    let mut entries = fs::read_dir(&models_dir)
        .await
        .map_err(|e| format!("Failed to read models directory: {}", e))?;
    
    while let Some(entry) = entries.next_entry().await
        .map_err(|e| format!("Failed to read directory entry: {}", e))? 
    {
        let path = entry.path();
        if path.is_dir() {
            if let Some(model) = scan_model_directory(&path).await {
                installed_models.push(model);
            }
        }
    }
    
    // Sort by downloaded_at (newest first)
    installed_models.sort_by(|a, b| b.downloaded_at.cmp(&a.downloaded_at));
    
    Ok(installed_models)
}

/// Scan a single model directory for GGUF files
async fn scan_model_directory(dir_path: &PathBuf) -> Option<InstalledModel> {
    let dir_name = dir_path.file_name()?.to_str()?;
    
    // Parse model_id from directory name (author_modelname format)
    let parts: Vec<&str> = dir_name.split('_').collect();
    let author = parts.first().unwrap_or(&"").to_string();
    let name = parts.get(1).unwrap_or(&"").to_string();
    let model_id = format!("{}/{}", author, name);
    
    let mut files = Vec::new();
    let mut total_size = 0;
    let mut has_modelfile = false;
    
    let metadata = fs::metadata(dir_path).await.ok()?;
    let downloaded_at = metadata
        .modified()
        .ok()
        .and_then(|t| t.elapsed().ok())
        .map(|d| {
            let secs = d.as_secs();
            let days = secs / 86400;
            if days > 0 {
                format!("{} day{} ago", days, if days > 1 { "s" } else { "" })
            } else {
                let hours = secs / 3600;
                if hours > 0 {
                    format!("{} hour{} ago", hours, if hours > 1 { "s" } else { "" })
                } else {
                    let mins = secs / 60;
                    if mins > 0 {
                        format!("{} minute{} ago", mins, if mins > 1 { "s" } else { "" })
                    } else {
                        "Just now".to_string()
                    }
                }
            }
        })
        .unwrap_or_else(|| "Unknown".to_string());
    
    // Read directory contents
    let mut entries = fs::read_dir(dir_path).await.ok()?;
    while let Some(entry) = entries.next_entry().await.ok()? {
        let path = entry.path();
        if path.is_file() {
            let filename = path.file_name()?.to_str()?.to_string();
            
            // Check for Modelfile
            if filename == "Modelfile" {
                has_modelfile = true;
                continue;
            }
            
            if filename.ends_with(".gguf") {
                let size = fs::metadata(&path).await.ok().map(|m| m.len()).unwrap_or(0);
                total_size += size;
                
                let parameter_count = extract_parameter_count(&filename);
                let quantization = extract_quantization(&filename);
                
                let file_info = InstalledModelFile {
                    filename,
                    size,
                    path: path.to_str()?.to_string(),
                    parameter_count,
                    quantization,
                    has_modelfile,
                };
                files.push(file_info);
            }
        }
    }
    
    if files.is_empty() {
        return None;
    }
    
    Some(InstalledModel {
        model_id,
        author,
        name,
        files,
        total_size,
        downloaded_at,
        has_modelfile,
    })
}

/// Delete an installed model and its files
pub async fn delete_installed_model(app_handle: &AppHandle, model_id: &str) -> Result<(), String> {
    let app_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;
    
    let model_folder_name = model_id.replace("/", "_");
    let model_dir = app_dir.join("models").join(&model_folder_name);
    
    if !model_dir.exists() {
        return Err(format!("Model directory not found: {}", model_id));
    }
    
    // Remove the entire directory
    fs::remove_dir_all(&model_dir)
        .await
        .map_err(|e| format!("Failed to delete model: {}", e))?;
    
    Ok(())
}