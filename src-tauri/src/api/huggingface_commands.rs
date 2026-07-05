use tauri;
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
};
use crate::core::huggingface::fetch_model_details as client_fetch_model_details;
use crate::data::huggingface_model_types::{HFModelSummary, HFModelDetails, ModelFilter, SearchModelsResponse};

// Remove the direct import of installed::InstalledModel since we're re-exporting it from the huggingface module

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

// --- New Commands for Installed Models ---

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