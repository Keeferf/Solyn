use reqwest;
use serde_json;
use std::time::Duration;
use crate::data::download_state::InstallationInformation;
use crate::helpers::platform_detector::detect_operating_system;

pub async fn is_ollama_installed() -> Result<bool, String> {
    match fetch_ollama_version().await {
        Ok(_) => Ok(true),
        Err(_) => Ok(false),
    }
}

pub async fn fetch_ollama_version() -> Result<String, String> {
    let client = reqwest::Client::new();
    let response = client
        .get("http://localhost:11434/api/version")
        .timeout(Duration::from_secs(2))
        .send()
        .await
        .map_err(|e| format!("Failed to connect to Ollama: {}", e))?;

    if response.status().is_success() {
        let version_info: serde_json::Value = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse version: {}", e))?;
        Ok(version_info["version"]
            .as_str()
            .unwrap_or("unknown")
            .to_string())
    } else {
        Err("Ollama is not running".to_string())
    }
}

pub async fn get_installation_instructions() -> Result<InstallationInformation, String> {
    let platform = detect_operating_system();
    
    let (command, estimated_time) = match platform.as_str() {
        "windows" => (
            "irm https://ollama.com/install.ps1 | iex".to_string(),
            "~5 minutes".to_string(),
        ),
        "macos" | "linux" => (
            "curl -fsSL https://ollama.com/install.sh | sh".to_string(),
            "~5 minutes".to_string(),
        ),
        _ => return Err("Unsupported platform".to_string()),
    };

    Ok(InstallationInformation {
        platform,
        command,
        estimated_time,
    })
}