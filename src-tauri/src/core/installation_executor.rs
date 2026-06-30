use tauri;
use tauri_plugin_shell::ShellExt;
use std::time::Duration;
use crate::helpers::terminal_output_cleaner::{broadcast_terminal_line, parse_and_emit_terminal_output};
use crate::core::ollama_client::is_ollama_installed;

pub async fn execute_ollama_installation(
    app_handle: &tauri::AppHandle,
    window: &tauri::WebviewWindow,
    platform: &str,
) -> Result<(), String> {
    let window_clone = window.clone();
    let shell = app_handle.shell();
    
    let (shell_cmd, script_cmd) = match platform {
        "windows" => ("powershell", "irm https://ollama.com/install.ps1 | iex"),
        "macos" => ("sh", "curl -fsSL https://ollama.com/install.sh | sh"),
        "linux" => ("sh", "curl -fsSL https://ollama.com/install.sh | sh"),
        _ => return Err("Unsupported platform".to_string()),
    };

    broadcast_terminal_line(&window_clone, &format!("Running installer for {}", platform), "info", false);

    let (mut rx, _child) = shell
        .command(shell_cmd)
        .args(&["-c", script_cmd])
        .spawn()
        .map_err(|e| format!("Failed to spawn process: {}", e))?;

    while let Some(event) = rx.recv().await {
        match event {
            tauri_plugin_shell::process::CommandEvent::Stdout(data) => {
                if let Ok(text) = String::from_utf8(data) {
                    parse_and_emit_terminal_output(&window_clone, &text, "stdout");
                }
            }
            tauri_plugin_shell::process::CommandEvent::Stderr(data) => {
                if let Ok(text) = String::from_utf8(data) {
                    parse_and_emit_terminal_output(&window_clone, &text, "stderr");
                }
            }
            tauri_plugin_shell::process::CommandEvent::Terminated(status) => {
                let msg = if status.code == Some(0) {
                    "Installation script completed"
                } else {
                    "Process terminated with error"
                };
                broadcast_terminal_line(&window_clone, msg, "info", false);
            }
            _ => {}
        }
    }

    broadcast_terminal_line(window, "Verifying Ollama installation...", "info", false);
    
    // Wait for Ollama to start
    let max_attempts = 15;
    let mut attempts = 0;
    
    while attempts < max_attempts {
        tokio::time::sleep(Duration::from_secs(2)).await;
        attempts += 1;
        
        match is_ollama_installed().await {
            Ok(true) => {
                broadcast_terminal_line(window, "Ollama verified and running", "success", false);
                return Ok(());
            }
            Ok(false) => {
                if attempts < max_attempts && attempts % 3 == 0 {
                    broadcast_terminal_line(window, &format!("Waiting for Ollama to start... (attempt {}/{})", attempts, max_attempts), "info", false);
                }
            }
            Err(_e) => {
                if attempts < max_attempts && attempts % 3 == 0 {
                    broadcast_terminal_line(window, &format!("Checking Ollama status... (attempt {}/{})", attempts, max_attempts), "info", false);
                }
            }
        }
    }
    
    broadcast_terminal_line(window, "Performing final verification check...", "info", false);
    tokio::time::sleep(Duration::from_secs(2)).await;
    
    match is_ollama_installed().await {
        Ok(true) => {
            broadcast_terminal_line(window, "✓ Ollama verified and running!", "success", false);
            Ok(())
        }
        _ => {
            broadcast_terminal_line(window, "⚠️ Ollama installation completed but verification timed out.", "info", false);
            broadcast_terminal_line(window, "The installation should be complete. You can try refreshing the page.", "info", false);
            broadcast_terminal_line(window, "💡 If you see this message repeatedly, Ollama may need to be started manually.", "info", false);
            Ok(())
        }
    }
}