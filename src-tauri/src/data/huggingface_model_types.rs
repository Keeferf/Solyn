// src/data/huggingface_model_types.rs
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HFModelSummary {
    pub id: String,
    pub model_id: String,
    pub author: String,
    pub name: String,
    pub downloads: Option<u64>,
    pub likes: Option<u64>,
    pub created_at: Option<String>,
    pub last_modified: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HFModelDetails {
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
    #[serde(default)]
    pub parameter_count: Option<String>,
    #[serde(default)]
    pub quantization: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum ModelFilter {
    MostDownloads,
    MostLiked,
    Recent,
}

impl Default for ModelFilter {
    fn default() -> Self {
        Self::MostDownloads
    }
}

impl ModelFilter {
    pub fn as_str(&self) -> &'static str {
        match self {
            ModelFilter::MostDownloads => "downloads",
            ModelFilter::MostLiked => "likes",
            ModelFilter::Recent => "lastModified",
        }
    }
    
    pub fn display_name(&self) -> &'static str {
        match self {
            ModelFilter::MostDownloads => "Most Downloads",
            ModelFilter::MostLiked => "Most Liked",
            ModelFilter::Recent => "Recent",
        }
    }
}