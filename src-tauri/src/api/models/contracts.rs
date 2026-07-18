// src/api/models/contracts.rs
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelImportRequest {
    pub model_name: String,
    pub modelfile_path: String, 
}

pub use crate::data::huggingface_model_types::{
    HFModelSummary, 
    HFModelDetails, 
    ModelFilter, 
    SearchModelsResponse
};
pub use crate::core::huggingface::InstalledModel;