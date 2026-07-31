pub mod client;
pub mod chat;
pub mod models;

pub use client::{
    OllamaClient,
    is_ollama_installed,
    is_ollama_running,
    fetch_ollama_version,
    start_ollama,
    get_installation_instructions,
};
pub use chat::{
    OllamaChatClient,
    ChatMessage,
    ChatEvent,
    ChatOptions,
    ChatRequest,
    ChatResponse,
};
pub use models::{
    OllamaModelClient,
    OllamaModel,
    OllamaModelList,
};