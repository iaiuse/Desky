// 引入必要的外部依赖
use std::sync::Arc;
use once_cell::sync::Lazy;

// 引入本地模块
use crate::device_manager::DeviceManager;
use crate::http_client::HttpClient;

// 定义模块名称常量
const MODEL_NAME: &str = "Commands";

// 定义允许跨线程访问的状态结构体
pub struct AppState {
    pub device_manager: Arc<DeviceManager>,
}

// 为 AppState 实现 Send 和 Sync trait
unsafe impl Send for AppState {}
unsafe impl Sync for AppState {}

// 使用 Lazy 静态变量来存储 HTTP 客户端实例,确保只初始化一次
static HTTP_CLIENT: Lazy<HttpClient> = Lazy::new(|| {
    log_message("Creating HTTP client instance".to_string(), "INFO".to_string(), MODEL_NAME.to_string());
    HttpClient::new()
});

// 设置舵机位置的命令处理函数
#[tauri::command]
pub async fn set_servo_position(
    state: tauri::State<'_, AppState>,
    device_name: String,
    x: Option<f64>,
    y: Option<f64>,
) -> Result<(), String> {
    state.device_manager.set_servo_position(device_name, x, y)
}

// 检查设备状态的命令处理函数
#[tauri::command]
pub async fn check_device_status(
    state: tauri::State<'_, AppState>,
    device_name: String,
) -> Result<bool, String> {
    state.device_manager.check_device_status(device_name)
}

// 简单的问候命令示例
#[tauri::command]
pub fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

// 日志记录命令处理函数
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

// 获取日志内容的命令处理函数
#[tauri::command]
pub fn get_logs() -> Result<String, String> {
    std::fs::read_to_string("./logs.txt")
        .map_err(|e| format!("Failed to read log file: {}", e))
}

// 清除日志内容的命令处理函数
#[tauri::command]
pub fn clear_logs() -> Result<(), String> {
    std::fs::write("./logs.txt", "")
        .map_err(|e| format!("Failed to clear log file: {}", e))
}

// 获取可用串口列表的命令处理函数
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

// 代理HTTP请求的命令处理函数
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
    
    // 使用HTTP客户端发送请求
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

// 检查服务器状态的命令处理函数
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
    
    // 委托HTTP客户端检查服务器状态
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

// 添加新的命令处理函数
#[tauri::command]
pub async fn proxy_request_with_headers(
    _window: tauri::Window,
    target_url: String, 
    method: String,
    headers: std::collections::HashMap<String, String>,
    body: Vec<u8>
) -> Result<String, String> {
    let function_name = "proxy_request_with_headers";
    log_message(
        format!("[{}] Received request for URL: {}", function_name, target_url),
        "INFO".to_string(),
        MODEL_NAME.to_string(),
    );
    
    HTTP_CLIENT.send_request_with_headers(&target_url, &method, headers, body).await
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
