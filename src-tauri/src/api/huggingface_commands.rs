// src/api/huggingface_commands.rs
use tauri;
use crate::core::huggingface_client::{
    fetch_hugging_face_models_page, 
    get_total_model_count_for_filter, 
    clear_model_cache,
    search_hugging_face_models,
    get_search_model_count,
};
use crate::core::huggingface_client::fetch_model_details as client_fetch_model_details;
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

// NEW: Search commands
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