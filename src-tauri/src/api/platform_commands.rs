#[tauri::command]
pub fn get_platform_info() -> String {
    crate::helpers::platform_detector::detect_operating_system()
}