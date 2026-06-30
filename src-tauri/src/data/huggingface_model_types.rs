use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HuggingFaceModelListing {
    pub id: String,
    pub model_id: String,
    pub author: String,
    pub name: String,
    pub downloads: Option<u64>,
    pub likes: Option<u64>,
    pub description: Option<String>,
    pub gguf_files: Vec<GGUFFileInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GGUFFileInfo {
    pub filename: String,
    pub size: u64,
    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadRequest {
    pub model_id: String,
    pub filename: String,
}