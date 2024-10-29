use std::sync::Arc;
use once_cell::sync::Lazy;

use crate::device_manager::DeviceManager;
use crate::http_client::HttpClient;

const MODEL_NAME: &str = "Commands";

// Define a state structure that allows cross-thread access
pub struct AppState {
    pub device_manager: Arc<DeviceManager>,
}

// 实现 Send 和 Sync
unsafe impl Send for AppState {}
unsafe impl Sync for AppState {}

// 使用 Lazy 静态变量来存储 HTTP 客户端实例
static HTTP_CLIENT: Lazy<HttpClient> = Lazy::new(|| {
    log_message("Creating HTTP client instance".to_string(), "INFO".to_string(), MODEL_NAME.to_string());
    HttpClient::new()
});

#[tauri::command]
pub async fn set_servo_position(
    state: tauri::State<'_, AppState>,
    device_name: String,
    x: Option<f64>,
    y: Option<f64>,
) -> Result<(), String> {
    state.device_manager.set_servo_position(device_name, x, y)
}

#[tauri::command]
pub async fn check_device_status(
    state: tauri::State<'_, AppState>,
    device_name: String,
) -> Result<bool, String> {
    state.device_manager.check_device_status(device_name)
}

// 原有的其他命令保持不变
#[tauri::command]
pub fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
pub fn log_message(message: String, level: String, module: String) {
    let level = match level.as_str() {
        "INFO" => log::Level::Info,
        "WARN" => log::Level::Warn,
        "ERROR" => log::Level::Error,
        _ => log::Level::Info,
    };
    log::log!(target: &module, level, "{}", message);
}

#[tauri::command]
pub fn get_logs() -> Result<String, String> {
    std::fs::read_to_string("./logs.txt")
        .map_err(|e| format!("Failed to read log file: {}", e))
}

#[tauri::command]
pub fn clear_logs() -> Result<(), String> {
    std::fs::write("./logs.txt", "")
        .map_err(|e| format!("Failed to clear log file: {}", e))
}

#[tauri::command]
pub fn get_serial_ports() -> Result<Vec<String>, String> {
    match serialport::available_ports() {
        Ok(ports) => {
            let port_names: Vec<String> = ports.into_iter().map(|p| p.port_name).collect();
            log_message(format!("Available serial ports: {:?}", port_names), "INFO".to_string(), "get_serial_ports".to_string());
            Ok(port_names)
        },
        Err(e) => {
            log_message(format!("Error listing serial ports: {}", e), "ERROR".to_string(), "get_serial_ports".to_string());
            Err(format!("Error listing serial ports: {}", e))
        }
    }
}

#[tauri::command]
pub async fn proxy_request(
    _window: tauri::Window,
    target_url: String, 
    method: String, 
    body: Vec<u8>
) -> Result<String, String> {
    let function_name = "proxy_request";
    log_message(
        format!("[{}] Received request for URL: {}", function_name, target_url),
        "INFO".to_string(),
        MODEL_NAME.to_string(),
    );
    
    // 直接使用传入的字节数组
    HTTP_CLIENT.send_request(&target_url, &method, body).await
        .map_err(|e| {
            let error_msg = format!("[{}] Request failed: {}", function_name, e);
            log_message(
                error_msg.clone(),
                "ERROR".to_string(),
                MODEL_NAME.to_string(),
            );
            error_msg
        })
}

#[tauri::command]
pub async fn check_server_status(
    url: String
) -> Result<bool, String> {
    let function_name = "check_server_status";
    log_message(
        format!("[{}] Checking server status: {}", function_name, url),
        "INFO".to_string(),
        MODEL_NAME.to_string(),
    );
    
    // 将实现委托给 HTTP_CLIENT
    HTTP_CLIENT.check_status(&url).await
        .map_err(|e| {
            let error_msg = format!("[{}] Status check failed: {}", function_name, e);
            log_message(
                error_msg.clone(),
                "ERROR".to_string(),
                MODEL_NAME.to_string(),
            );
            error_msg
        })
}
