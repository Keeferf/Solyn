// src/lib.rs
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
        .setup(|app| {
            // Initialize chat state
            api::chat_commands::init_chat_state(app);
            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            // Ollama commands
            api::ollama_commands::check_ollama_installed,
            api::ollama_commands::check_ollama_running,  
            api::ollama_commands::get_ollama_status,    
            api::ollama_commands::start_ollama_service,  
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
            api::huggingface_commands::delete_model_file_command,
            api::huggingface_commands::delete_model_quantization_command,
            
            // Modelfile generation command
            api::huggingface_commands::generate_modelfile,
            
            // Chat models command
            api::huggingface_commands::get_chat_models,
            
            // Chat commands
            api::chat_commands::create_ollama_model,
            api::chat_commands::list_ollama_models,
            api::chat_commands::delete_ollama_model,
            api::chat_commands::send_chat_message,
            api::chat_commands::send_chat_stream,
            api::chat_commands::check_ollama_health,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}