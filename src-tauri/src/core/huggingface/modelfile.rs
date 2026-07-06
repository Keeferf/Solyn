// src/core/huggingface/modelfile.rs
use std::path::PathBuf;
use tokio::fs;

#[derive(Debug, Clone)]
pub struct ModelFileConfig {
    pub model_name: String,
    pub model_id: String,
    pub gguf_filename: String,
    pub quantization: Option<String>,
    pub parameter_count: Option<String>,
}

/// Generate a Modelfile for Ollama
pub fn generate_modelfile_content(config: &ModelFileConfig) -> String {
    let mut content = String::new();
    
    // Basic template
    content.push_str(&format!("# Modelfile for {}\n", config.model_name));
    content.push_str(&format!("# Model ID: {}\n", config.model_id));
    if let Some(quant) = &config.quantization {
        content.push_str(&format!("# Quantization: {}\n", quant));
    }
    if let Some(params) = &config.parameter_count {
        content.push_str(&format!("# Parameters: {}\n", params));
    }
    content.push_str("\n");
    
    // The actual Modelfile content
    content.push_str(&format!("FROM ./{}\n", config.gguf_filename));
    content.push_str("\n");
    
    // Add parameter recommendations based on quantization
    if let Some(quant) = &config.quantization {
        let (num_ctx, num_keep, num_threads) = get_recommended_params(quant);
        content.push_str(&format!("PARAMETER num_ctx {}\n", num_ctx));
        content.push_str(&format!("PARAMETER num_keep {}\n", num_keep));
        content.push_str(&format!("PARAMETER num_threads {}\n", num_threads));
    }
    
    // Template for system message
    content.push_str("\n");
    content.push_str("# Optional: Add a system message\n");
    content.push_str("# SYSTEM \"\"\"\n");
    content.push_str("# You are an AI assistant.\n");
    content.push_str("# \"\"\"\n");
    
    content
}

/// Get recommended parameters based on quantization
fn get_recommended_params(quantization: &str) -> (String, String, String) {
    let quant_lower = quantization.to_lowercase();
    
    // Default parameters
    let mut num_ctx = "4096".to_string();
    let mut num_keep = "32".to_string();
    let num_threads = "8".to_string();
    
    // Adjust based on quantization (these are just examples)
    if quant_lower.contains("q2") || quant_lower.contains("q3") {
        num_ctx = "2048".to_string();
        num_keep = "16".to_string();
    } else if quant_lower.contains("q4") || quant_lower.contains("q5") {
        num_ctx = "4096".to_string();
        num_keep = "32".to_string();
    } else if quant_lower.contains("q6") || quant_lower.contains("q8") || quant_lower.contains("f16") {
        num_ctx = "8192".to_string();
        num_keep = "64".to_string();
    }
    
    (num_ctx, num_keep, num_threads)
}

/// Get the Modelfile name for a specific quantization
pub fn get_modelfile_name(quantization: Option<&String>) -> String {
    match quantization {
        Some(quant) => format!("Modelfile_{}", quant.to_uppercase()),
        None => "Modelfile".to_string(),
    }
}

pub async fn write_modelfile(
    model_dir: &PathBuf,
    config: &ModelFileConfig,
) -> Result<PathBuf, String> {
    let modelfile_content = generate_modelfile_content(config);
    let modelfile_name = get_modelfile_name(config.quantization.as_ref());
    let modelfile_path = model_dir.join(&modelfile_name);
    
    fs::write(&modelfile_path, modelfile_content)
        .await
        .map_err(|e| format!("Failed to write Modelfile: {}", e))?;
    
    Ok(modelfile_path)
}