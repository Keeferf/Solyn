use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DownloadProgress {
    pub progress: u8,
    pub message: String,
    pub log: Option<String>,
    pub status: DownloadStatus,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum DownloadStatus {
    Idle,
    Downloading,
    Completed,
    Error,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct InstallationInformation {
    pub platform: String,
    pub command: String,
    pub estimated_time: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TerminalLine {
    pub line: String,
    pub stream: String,
    pub is_progress: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ModelAcquisitionProgress {
    pub model_id: String,
    pub status: String, // "downloading", "converting", "complete", "error"
    pub progress: u8,
    pub message: String,
}

#[derive(Debug, Clone)]
pub struct GgufFileMetadata {
    pub filename: String,
    pub size: u64,
    pub quantization: String,
}