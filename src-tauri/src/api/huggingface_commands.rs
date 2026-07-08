use tauri;
use tauri::Manager;
use crate::core::huggingface::{
    fetch_hugging_face_models_page, 
    get_total_model_count_for_filter, 
    clear_model_cache,
    search_hugging_face_models,
    get_search_model_count,
    download_model_file,
    cancel_download,
    get_installed_models,
    delete_installed_model,
    delete_model_file,
    delete_model_quantization,
    write_modelfile,
    ModelFileConfig,
    extract_parameter_count,
    extract_quantization,
};
use crate::core::huggingface::fetch_model_details as client_fetch_model_details;
use crate::data::huggingface_model_types::{HFModelSummary, HFModelDetails, ModelFilter, SearchModelsResponse};

#[tauri::command]
pub async fn fetch_huggingface_models_page(
    page: usize,
    limit: Option<usize>,
    filter: Option<String>,
) -> Result<Vec<HFModelSummary>, String> {
    let limit = limit.unwrap_or(20);
    let filter = match filter.as_deref() {
        Some("most_downloads") => ModelFilter::MostDownloads,
        Some("most_liked") => ModelFilter::MostLiked,
        Some("recent") => ModelFilter::Recent,
        _ => ModelFilter::default(),
    };
    fetch_hugging_face_models_page(page, limit, &filter).await
}

#[tauri::command]
pub async fn get_huggingface_model_count(
    filter: Option<String>,
) -> Result<usize, String> {
    let filter = match filter.as_deref() {
        Some("most_downloads") => ModelFilter::MostDownloads,
        Some("most_liked") => ModelFilter::MostLiked,
        Some("recent") => ModelFilter::Recent,
        _ => ModelFilter::default(),
    };
    get_total_model_count_for_filter(&filter).await
}

#[tauri::command]
pub async fn fetch_model_details(
    model_id: String,
) -> Result<HFModelDetails, String> {
    client_fetch_model_details(&model_id).await
}

#[tauri::command]
pub async fn clear_models_cache(
    filter: Option<String>,
) -> Result<(), String> {
    let filter = match filter.as_deref() {
        Some("most_downloads") => Some(ModelFilter::MostDownloads),
        Some("most_liked") => Some(ModelFilter::MostLiked),
        Some("recent") => Some(ModelFilter::Recent),
        _ => None,
    };
    clear_model_cache(filter);
    Ok(())
}

#[tauri::command]
pub async fn search_huggingface_models(
    query: String,
    page: usize,
    limit: Option<usize>,
    filter: Option<String>,
) -> Result<SearchModelsResponse, String> {
    let limit = limit.unwrap_or(20);
    let filter = match filter.as_deref() {
        Some("most_downloads") => ModelFilter::MostDownloads,
        Some("most_liked") => ModelFilter::MostLiked,
        Some("recent") => ModelFilter::Recent,
        _ => ModelFilter::default(),
    };
    search_hugging_face_models(&query, page, limit, &filter).await
}

#[tauri::command]
pub async fn get_huggingface_search_count(
    query: String,
    filter: Option<String>,
) -> Result<usize, String> {
    let filter = match filter.as_deref() {
        Some("most_downloads") => ModelFilter::MostDownloads,
        Some("most_liked") => ModelFilter::MostLiked,
        Some("recent") => ModelFilter::Recent,
        _ => ModelFilter::default(),
    };
    get_search_model_count(&query, &filter).await
}

#[tauri::command]
pub async fn download_huggingface_model(
    model_id: String,
    filename: String,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    download_model_file(&model_id, &filename, &app_handle).await
}

#[tauri::command]
pub fn cancel_huggingface_download(
    model_id: String,
    filename: String,
) -> Result<bool, String> {
    Ok(cancel_download(&model_id, &filename))
}

// --- Commands for Installed Models ---

#[tauri::command]
pub async fn get_installed_models_command(
    app_handle: tauri::AppHandle,
) -> Result<Vec<crate::core::huggingface::InstalledModel>, String> {
    get_installed_models(&app_handle).await
}

#[tauri::command]
pub async fn delete_installed_model_command(
    app_handle: tauri::AppHandle,
    model_id: String,
) -> Result<(), String> {
    delete_installed_model(&app_handle, &model_id).await
}

#[tauri::command]
pub async fn delete_model_file_command(
    app_handle: tauri::AppHandle,
    model_id: String,
    filename: String,
) -> Result<(), String> {
    delete_model_file(&app_handle, &model_id, &filename).await
}

#[tauri::command]
pub async fn delete_model_quantization_command(
    app_handle: tauri::AppHandle,
    model_id: String,
    quantization: String,
) -> Result<(), String> {
    delete_model_quantization(&app_handle, &model_id, &quantization).await
}

// --- Command for Generating Modelfile ---

#[tauri::command]
pub async fn generate_modelfile(
    model_id: String,
    filename: String,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    let app_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;
    
    let model_folder_name = model_id.replace("/", "_");
    let model_dir = app_dir.join("models").join(&model_folder_name);
    
    if !model_dir.exists() {
        return Err("Model directory not found".to_string());
    }
    
    let parts: Vec<&str> = model_id.split('/').collect();
    let author = parts.get(0).unwrap_or(&"").to_string();
    let model_name = parts.get(1).unwrap_or(&"").to_string();
    
    let filename_clone = filename.clone();
    let quantization = extract_quantization(&filename);
    let parameter_count = extract_parameter_count(&filename_clone);
    
    let config = ModelFileConfig {
        model_name: format!("{}/{}", author, model_name),
        model_id: model_id.clone(),
        gguf_filename: filename,
        quantization,
        parameter_count,
        model_dir: model_dir.clone(), // Pass the model directory
    };
    
    let modelfile_path = write_modelfile(&model_dir, &config).await?;
    Ok(modelfile_path.to_str().unwrap_or("").to_string())
}

// --- Command for getting chat models ---

#[tauri::command]
pub async fn get_chat_models(
    app_handle: tauri::AppHandle,
) -> Result<Vec<serde_json::Value>, String> {
    let installed = get_installed_models(&app_handle).await?;
    
    let mut chat_models = Vec::new();
    
    for model in installed {
        // Create a separate entry for each GGUF file (quantization variant)
        for file in &model.files {
            let model_value = serde_json::json!({
                "value": format!("{}:{}", model.model_id, file.filename),
                "label": format!("{} ({})", model.name, file.quantization.as_deref().unwrap_or("default")),
                "model_id": model.model_id,
                "author": model.author,
                "name": model.name,
                "quantization": file.quantization,
                "parameter_count": file.parameter_count,
                "filename": file.filename,
                "path": file.path,
                "has_modelfile": file.has_modelfile,
                "size": file.size,
            });
            chat_models.push(model_value);
        }
    }
    
    Ok(chat_models)
}