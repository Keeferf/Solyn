use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Mutex;
use tokio::time::interval;
use tauri::Manager;
use tauri::Emitter;
use crate::core::ollama::client::{is_ollama_installed, fetch_ollama_version};
use crate::api::ollama::contracts::OllamaStatus;

pub struct OllamaStatusMonitor {
    interval_handle: Arc<Mutex<Option<tokio::task::JoinHandle<()>>>>,
}

impl OllamaStatusMonitor {
    pub fn new() -> Self {
        Self {
            interval_handle: Arc::new(Mutex::new(None)),
        }
    }

    pub async fn start(&self, app_handle: tauri::AppHandle) {
        // Check if already running
        {
            let guard = self.interval_handle.lock().await;
            if guard.is_some() {
                return;
            }
        }

        let app_handle_clone = app_handle.clone();
        
        let handle = tokio::spawn(async move {
            // Initial check immediately
            Self::check_and_emit_status(&app_handle_clone).await;
            
            // Then check every 30 seconds
            let mut interval = interval(Duration::from_secs(30));
            loop {
                interval.tick().await;
                Self::check_and_emit_status(&app_handle_clone).await;
            }
        });

        let mut guard = self.interval_handle.lock().await;
        *guard = Some(handle);
    }

    pub async fn stop(&self) {
        let mut guard = self.interval_handle.lock().await;
        if let Some(handle) = guard.take() {
            handle.abort();
        }
    }

    pub async fn trigger_status_check(&self, app_handle: &tauri::AppHandle) {
        Self::check_and_emit_status(app_handle).await;
    }

    async fn check_and_emit_status(app_handle: &tauri::AppHandle) {
        if let Some(window) = app_handle.get_webview_window("main") {
            let installed = is_ollama_installed().await.unwrap_or(false);
            let (running, version) = if installed {
                match fetch_ollama_version().await {
                    Ok(v) => (true, Some(v)),
                    Err(_) => (false, None),
                }
            } else {
                (false, None)
            };

            let status = OllamaStatus {
                installed,
                running,
                version,
            };

            let _ = window.emit("ollama-status-update", status);
        }
    }
}

impl Clone for OllamaStatusMonitor {
    fn clone(&self) -> Self {
        Self {
            interval_handle: Arc::clone(&self.interval_handle),
        }
    }
}