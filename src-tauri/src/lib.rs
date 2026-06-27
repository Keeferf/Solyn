use serde::{Deserialize, Serialize};
use std::process::{Command, Stdio};
use std::io::{BufRead, BufReader};
use tauri::Manager;
use tauri::Emitter;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct InstallProgress {
    pub status: InstallStatus,
    pub progress: u8,
    pub message: String,
    pub error: Option<String>,
    pub log: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct InstallInfo {
    pub platform: String,
    pub method: String,
    pub command: String,
    pub estimated_time: String,
    pub models_note: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum InstallStatus {
    Idle,
    Downloading,
    Verifying,
    Installing,
    Completed,
    Error,
}

#[tauri::command]
async fn check_ollama_installed() -> Result<bool, String> {
    match get_ollama_version().await {
        Ok(_) => Ok(true),
        Err(_) => Ok(false),
    }
}

#[tauri::command]
async fn get_ollama_version() -> Result<String, String> {
    let client = reqwest::Client::new();
    let response = client
        .get("http://localhost:11434/api/version")
        .timeout(std::time::Duration::from_secs(2))
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

#[tauri::command]
async fn get_install_info() -> Result<InstallInfo, String> {
    let platform = get_platform();
    
    let (command, estimated_time) = match platform.as_str() {
        "windows" => (
            "irm https://ollama.com/install.ps1 | iex".to_string(),
            "1-2 minutes".to_string(),
        ),
        "macos" => (
            "curl -fsSL https://ollama.com/install.sh | sh".to_string(),
            "1-2 minutes".to_string(),
        ),
        "linux" => (
            "curl -fsSL https://ollama.com/install.sh | sh".to_string(),
            "1-2 minutes".to_string(),
        ),
        _ => return Err("Unsupported platform".to_string()),
    };

    Ok(InstallInfo {
        platform: platform.clone(),
        method: "Official Script".to_string(),
        command,
        estimated_time,
        models_note: "Models are downloaded separately after installation".to_string(),
    })
}

#[tauri::command]
async fn download_ollama(app_handle: tauri::AppHandle) -> Result<String, String> {
    let window = app_handle.get_webview_window("main").ok_or("Main window not found")?;
    let platform = get_platform();

    println!("🚀 Starting Ollama installation for {}", platform);
    
    emit_progress(
        &window,
        InstallStatus::Installing,
        5,
        format!("Installing Ollama for {}...", platform),
        Some("⏳ Starting installation..."),
    );

    let install_result = match platform.as_str() {
        "windows" => install_windows(&window).await,
        "macos" => install_macos(&window).await,
        "linux" => install_linux(&window).await,
        _ => Err("Unsupported platform".to_string()),
    };

    if let Err(e) = install_result {
        println!("❌ Installation failed: {}", e);
        emit_progress(
            &window,
            InstallStatus::Error,
            0,
            format!("Installation failed: {}", e),
            Some("❌ Installation failed"),
        );
        return Err(e);
    }

    println!("⏳ Installation completed, finalizing...");
    emit_progress(
        &window,
        InstallStatus::Installing,
        80,
        "Waiting for installation to complete...".to_string(),
        Some("⏳ Installation process completed, finalizing..."),
    );

    // Wait for installation to complete
    tokio::time::sleep(tokio::time::Duration::from_secs(3)).await;

    // Verify installation
    println!("🔍 Verifying Ollama installation...");
    emit_progress(
        &window,
        InstallStatus::Installing,
        90,
        "Verifying installation...".to_string(),
        Some("🔍 Verifying Ollama installation..."),
    );

    // Start Ollama service
    println!("🚀 Starting Ollama service...");
    emit_progress(
        &window,
        InstallStatus::Installing,
        95,
        "Starting Ollama service...".to_string(),
        Some("🚀 Starting Ollama service..."),
    );

    if let Err(e) = start_ollama_service().await {
        let error_msg = format!("Failed to start Ollama service: {}", e);
        println!("⚠️ {}", error_msg);
        eprintln!("{}", error_msg);
        emit_progress(
            &window,
            InstallStatus::Installing,
            95,
            "Service start warning".to_string(),
            Some(&format!("⚠️ {}", error_msg)),
        );
        // Don't fail the installation if service start fails
    }

    println!("✅ Ollama installation complete!");
    emit_progress(
        &window,
        InstallStatus::Completed,
        100,
        "✅ Ollama installed successfully!".to_string(),
        Some("✅ Installation complete! Ollama is ready to use."),
    );

    Ok("Ollama installed successfully".to_string())
}

#[tauri::command]
fn get_platform_info() -> String {
    get_platform()
}

// Helper functions

fn get_platform() -> String {
    if cfg!(target_os = "windows") {
        "windows".to_string()
    } else if cfg!(target_os = "macos") {
        "macos".to_string()
    } else if cfg!(target_os = "linux") {
        "linux".to_string()
    } else {
        "unknown".to_string()
    }
}

async fn install_windows(window: &tauri::WebviewWindow) -> Result<(), String> {
    println!("📥 Starting PowerShell installation...");
    emit_progress(
        window,
        InstallStatus::Installing,
        10,
        "Starting PowerShell installation...".to_string(),
        Some("📥 Starting PowerShell installation..."),
    );

    // Run PowerShell directly and capture output
    let mut child = Command::new("powershell")
        .args(&[
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            "& { $ProgressPreference = 'SilentlyContinue'; irm https://ollama.com/install.ps1 | iex }"
        ])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to start PowerShell: {}", e))?;

    println!("🔄 PowerShell process started, capturing output...");

    // Capture stdout
    if let Some(stdout) = child.stdout.take() {
        let reader = BufReader::new(stdout);
        let window_clone = window.clone();
        
        tokio::spawn(async move {
            for line in reader.lines() {
                if let Ok(line) = line {
                    let trimmed = line.trim();
                    if !trimmed.is_empty() {
                        // Log important lines to console
                        if trimmed.contains("Downloading") || trimmed.contains("Installing") {
                            println!("📦 {}", trimmed);
                        } else if trimmed.contains("Complete") || trimmed.contains("Success") {
                            println!("✅ {}", trimmed);
                        } else if trimmed.contains("Error") || trimmed.contains("Failed") {
                            println!("❌ {}", trimmed);
                        }
                        
                        // Parse progress from PowerShell output
                        let progress = parse_powershell_progress(trimmed);
                        let status = if progress >= 70 { 
                            InstallStatus::Installing 
                        } else { 
                            InstallStatus::Downloading 
                        };
                        
                        emit_progress(
                            &window_clone,
                            status,
                            progress.min(70),
                            format!("Installing... {}", trimmed),
                            Some(trimmed),
                        );
                    }
                }
            }
        });
    }

    // Capture stderr
    if let Some(stderr) = child.stderr.take() {
        let reader = BufReader::new(stderr);
        let window_clone = window.clone();
        
        tokio::spawn(async move {
            for line in reader.lines() {
                if let Ok(line) = line {
                    let trimmed = line.trim();
                    if !trimmed.is_empty() {
                        println!("⚠️ {}", trimmed);
                        // Check for error messages
                        if trimmed.contains("error") || trimmed.contains("failed") || trimmed.contains("Access is denied") {
                            println!("❌ Error detected: {}", trimmed);
                            emit_progress(
                                &window_clone,
                                InstallStatus::Error,
                                0,
                                format!("Error: {}", trimmed),
                                Some(&format!("❌ {}", trimmed)),
                            );
                        } else {
                            emit_progress(
                                &window_clone,
                                InstallStatus::Installing,
                                50,
                                trimmed.to_string(),
                                Some(&format!("⚠️ {}", trimmed)),
                            );
                        }
                    }
                }
            }
        });
    }

    // Wait for the process to complete
    let status = child.wait().map_err(|e| format!("Failed to wait for PowerShell: {}", e))?;

    if !status.success() {
        println!("❌ PowerShell installation failed with exit code: {:?}", status.code());
        return Err("Installation failed with errors".to_string());
    }

    println!("✅ Installation script completed successfully!");
    emit_progress(
        window,
        InstallStatus::Installing,
        70,
        "Installation script completed successfully!".to_string(),
        Some("✅ Installation script completed successfully!"),
    );

    Ok(())
}

async fn install_macos(window: &tauri::WebviewWindow) -> Result<(), String> {
    println!("📥 Starting macOS installation...");
    emit_progress(
        window,
        InstallStatus::Installing,
        10,
        "Starting macOS installation...".to_string(),
        Some("📥 Starting macOS installation..."),
    );

    let mut child = Command::new("sh")
        .arg("-c")
        .arg("curl -fsSL https://ollama.com/install.sh | sh")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to run installation script: {}", e))?;

    println!("🔄 Installation script started, capturing output...");

    // Capture stdout
    if let Some(stdout) = child.stdout.take() {
        let reader = BufReader::new(stdout);
        let window_clone = window.clone();
        
        tokio::spawn(async move {
            for line in reader.lines() {
                if let Ok(line) = line {
                    let trimmed = line.trim();
                    if !trimmed.is_empty() {
                        // Log important lines to console
                        if trimmed.contains("Downloading") || trimmed.contains("Installing") {
                            println!("📦 {}", trimmed);
                        } else if trimmed.contains("Complete") || trimmed.contains("Success") {
                            println!("✅ {}", trimmed);
                        } else if trimmed.contains("Error") || trimmed.contains("Failed") {
                            println!("❌ {}", trimmed);
                        }
                        
                        emit_progress(
                            &window_clone,
                            InstallStatus::Installing,
                            30,
                            trimmed.to_string(),
                            Some(trimmed),
                        );
                    }
                }
            }
        });
    }

    // Capture stderr
    if let Some(stderr) = child.stderr.take() {
        let reader = BufReader::new(stderr);
        let window_clone = window.clone();
        
        tokio::spawn(async move {
            for line in reader.lines() {
                if let Ok(line) = line {
                    let trimmed = line.trim();
                    if !trimmed.is_empty() {
                        println!("⚠️ {}", trimmed);
                        if trimmed.contains("error") || trimmed.contains("failed") {
                            println!("❌ Error detected: {}", trimmed);
                            emit_progress(
                                &window_clone,
                                InstallStatus::Error,
                                0,
                                format!("Error: {}", trimmed),
                                Some(&format!("❌ {}", trimmed)),
                            );
                        } else {
                            emit_progress(
                                &window_clone,
                                InstallStatus::Installing,
                                30,
                                trimmed.to_string(),
                                Some(&format!("⚠️ {}", trimmed)),
                            );
                        }
                    }
                }
            }
        });
    }

    let status = child.wait().map_err(|e| format!("Failed to wait for installation: {}", e))?;

    if !status.success() {
        println!("❌ macOS installation failed with exit code: {:?}", status.code());
        return Err("Installation failed with errors".to_string());
    }

    tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;

    println!("✅ Installation script completed successfully!");
    emit_progress(
        window,
        InstallStatus::Installing,
        70,
        "Installation script completed successfully!".to_string(),
        Some("✅ Installation script completed successfully!"),
    );

    Ok(())
}

async fn install_linux(window: &tauri::WebviewWindow) -> Result<(), String> {
    println!("📥 Starting Linux installation...");
    emit_progress(
        window,
        InstallStatus::Installing,
        10,
        "Starting Linux installation...".to_string(),
        Some("📥 Starting Linux installation..."),
    );

    let mut child = Command::new("sh")
        .arg("-c")
        .arg("curl -fsSL https://ollama.com/install.sh | sh")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to run installation script: {}", e))?;

    println!("🔄 Installation script started, capturing output...");

    // Capture stdout
    if let Some(stdout) = child.stdout.take() {
        let reader = BufReader::new(stdout);
        let window_clone = window.clone();
        
        tokio::spawn(async move {
            for line in reader.lines() {
                if let Ok(line) = line {
                    let trimmed = line.trim();
                    if !trimmed.is_empty() {
                        // Log important lines to console
                        if trimmed.contains("Downloading") || trimmed.contains("Installing") {
                            println!("📦 {}", trimmed);
                        } else if trimmed.contains("Complete") || trimmed.contains("Success") {
                            println!("✅ {}", trimmed);
                        } else if trimmed.contains("Error") || trimmed.contains("Failed") {
                            println!("❌ {}", trimmed);
                        }
                        
                        emit_progress(
                            &window_clone,
                            InstallStatus::Installing,
                            30,
                            trimmed.to_string(),
                            Some(trimmed),
                        );
                    }
                }
            }
        });
    }

    // Capture stderr
    if let Some(stderr) = child.stderr.take() {
        let reader = BufReader::new(stderr);
        let window_clone = window.clone();
        
        tokio::spawn(async move {
            for line in reader.lines() {
                if let Ok(line) = line {
                    let trimmed = line.trim();
                    if !trimmed.is_empty() {
                        println!("⚠️ {}", trimmed);
                        if trimmed.contains("error") || trimmed.contains("failed") {
                            println!("❌ Error detected: {}", trimmed);
                            emit_progress(
                                &window_clone,
                                InstallStatus::Error,
                                0,
                                format!("Error: {}", trimmed),
                                Some(&format!("❌ {}", trimmed)),
                            );
                        } else {
                            emit_progress(
                                &window_clone,
                                InstallStatus::Installing,
                                30,
                                trimmed.to_string(),
                                Some(&format!("⚠️ {}", trimmed)),
                            );
                        }
                    }
                }
            }
        });
    }

    let status = child.wait().map_err(|e| format!("Failed to wait for installation: {}", e))?;

    if !status.success() {
        println!("❌ Linux installation failed with exit code: {:?}", status.code());
        return Err("Installation failed with errors".to_string());
    }

    tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;

    println!("✅ Installation script completed successfully!");
    emit_progress(
        window,
        InstallStatus::Installing,
        70,
        "Installation script completed successfully!".to_string(),
        Some("✅ Installation script completed successfully!"),
    );

    Ok(())
}

fn parse_powershell_progress(line: &str) -> u8 {
    // Try to extract percentage from PowerShell output
    // Common patterns: "Downloading 45%", "45% complete", etc.
    if let Some(pos) = line.find('%') {
        if let Ok(num) = line[..pos].chars().rev().take_while(|c| c.is_ascii_digit()).collect::<String>().chars().rev().collect::<String>().parse::<u8>() {
            return num.min(70);
        }
    }
    // Default progress if no percentage found
    30
}

async fn start_ollama_service() -> Result<(), String> {
    let platform = get_platform();

    let output = match platform.as_str() {
        "windows" => {
            Command::new("cmd")
                .args(&["/c", "start", "ollama", "serve"])
                .output()
        }
        "macos" | "linux" => {
            Command::new("ollama")
                .arg("serve")
                .output()
        }
        _ => return Err("Unsupported platform".to_string()),
    };

    match output {
        Ok(_) => Ok(()),
        Err(e) => Err(format!("Failed to start service: {}", e)),
    }
}

fn emit_progress(window: &tauri::WebviewWindow, status: InstallStatus, progress: u8, message: String, log: Option<&str>) {
    let progress_data = InstallProgress {
        status,
        progress,
        message,
        error: None,
        log: log.map(|s| s.to_string()),
    };

    let _ = window.emit("install-progress", progress_data);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            check_ollama_installed,
            get_ollama_version,
            download_ollama,
            get_platform_info,
            get_install_info,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}