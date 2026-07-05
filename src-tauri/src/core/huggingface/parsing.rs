use serde_json;
use crate::data::huggingface_model_types::GGUFFileInfo;
use super::utils::{extract_parameter_count, extract_quantization};

pub fn extract_gguf_files(siblings: Option<&Vec<serde_json::Value>>) -> Vec<GGUFFileInfo> {
    let mut gguf_files = Vec::new();
    
    if let Some(siblings) = siblings {
        for file in siblings {
            let filename = file["rfilename"].as_str()
                .or_else(|| file["filename"].as_str())
                .unwrap_or("");
            
            if filename.ends_with(".gguf") {
                let size = file["size"].as_u64()
                    .or_else(|| file["file_size"].as_u64())
                    .or_else(|| {
                        file["file"]["size"].as_u64()
                    })
                    .unwrap_or(0);

                let model_id = file.get("model_id")
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                
                let url = if !model_id.is_empty() {
                    format!("https://huggingface.co/{}/resolve/main/{}", model_id, filename)
                } else {
                    format!("https://huggingface.co/resolve/main/{}", filename)
                };

                let parameter_count = extract_parameter_count(filename);
                let quantization = extract_quantization(filename);
                
                gguf_files.push(GGUFFileInfo {
                    filename: filename.to_string(),
                    size,
                    url,
                    parameter_count,
                    quantization,
                });
            }
        }
    }
    
    gguf_files.sort_by(|a, b| b.size.cmp(&a.size));
    gguf_files
}