use tauri;
use tauri::Manager;
use crate::core::ollama_client::*;
use crate::core::installation_executor::execute_ollama_installation;
use crate::helpers::platform_detector::detect_operating_system;
use crate::events::progress_broadcaster::broadcast_download_progress;
use crate::data::download_state::{DownloadStatus, InstallationInformation};
use crate::data::ollama_model_types::OllamaModelInfo;

#[tauri::command]
pub async fn check_ollama_installed() -> Result<bool, String> {
    is_ollama_installed().await
}

#[tauri::command]
pub async fn get_ollama_version() -> Result<String, String> {
    fetch_ollama_version().await
}

#[tauri::command]
pub async fn get_install_info() -> Result<InstallationInformation, String> {
    get_installation_instructions().await
}

#[tauri::command]
pub async fn list_ollama_models() -> Result<Vec<OllamaModelInfo>, String> {
    list_installed_ollama_models().await
}

#[tauri::command]
pub async fn pull_ollama_model(
    app_handle: tauri::AppHandle,
    model_name: String,
) -> Result<String, String> {
    initiate_model_pull(app_handle, model_name).await
}

#[tauri::command]
pub async fn delete_ollama_model(model_name: String) -> Result<String, String> {
    remove_ollama_model(model_name).await
}

#[tauri::command]
pub async fn download_ollama(app_handle: tauri::AppHandle) -> Result<String, String> {
    let window = app_handle
        .get_webview_window("main")
        .ok_or("Main window not found")?;
    let platform = detect_operating_system();

    broadcast_download_progress(
        &window,
        DownloadStatus::Downloading,
        0,
        "Starting download...".to_string(),
        None,
    );

    let download_result = execute_ollama_installation(&app_handle, &window, &platform).await;

    if let Err(e) = download_result {
        broadcast_download_progress(
            &window,
            DownloadStatus::Error,
            0,
            format!("Download failed: {}", e),
            None,
        );
        return Err(e);
    }

    broadcast_download_progress(
        &window,
        DownloadStatus::Completed,
        100,
        "Ollama installed successfully!".to_string(),
        None,
    );

    Ok("Ollama installed successfully".to_string())
}