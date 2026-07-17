use tauri;
use tauri::Manager;

use crate::core::ollama_client::*;
use crate::core::installation_executor::execute_ollama_installation;
use crate::helpers::platform_detector::detect_operating_system;
use crate::events::progress_broadcaster::broadcast_download_progress;
use crate::data::download_state::DownloadStatus;

#[tauri::command]
pub async fn start_ollama_service(app_handle: tauri::AppHandle) -> Result<String, String> {
    start_ollama(&app_handle).await
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
        DownloadStatus::Complete,
        100,
        "Ollama installed successfully!".to_string(),
        None,
    );

    Ok("Ollama installed successfully".to_string())
}