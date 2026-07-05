pub mod data;
pub mod api;
pub mod core;
pub mod helpers;
pub mod events;

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
            api::huggingface_commands::fetch_huggingface_models_page,
            api::huggingface_commands::get_huggingface_model_count,
            api::huggingface_commands::fetch_model_details,
            api::huggingface_commands::search_huggingface_models,
            api::huggingface_commands::get_huggingface_search_count,
            api::huggingface_commands::clear_models_cache,
            
            // Download commands
            api::huggingface_commands::download_huggingface_model,
            api::huggingface_commands::cancel_huggingface_download,
            
            // Installed models commands
            api::huggingface_commands::get_installed_models_command,
            api::huggingface_commands::delete_installed_model_command,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}