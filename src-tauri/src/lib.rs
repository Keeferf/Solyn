pub mod data;
pub mod api;
pub mod core;
pub mod helpers;
pub mod events;

// Re-export commonly used types for convenience
pub use data::download_state::*;
pub use data::huggingface_model_types::*;

use tauri;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            // Ollama commands (only installation related)
            api::ollama_commands::check_ollama_installed,
            api::ollama_commands::get_ollama_version,
            api::ollama_commands::download_ollama,
            api::ollama_commands::get_install_info,
            
            // Platform commands
            api::platform_commands::get_platform_info,
            
            // Hugging Face commands
            api::huggingface_commands::fetch_huggingface_models,
            api::huggingface_commands::get_huggingface_model_count,
            api::huggingface_commands::download_huggingface_model,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}