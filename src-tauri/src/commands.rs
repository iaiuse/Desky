
use std::sync::{Arc};


use serde::Serialize;
use crate::socket_communication::SocketCommunication;
use crate::device_manager::DeviceManager;

#[derive(Serialize)]
pub struct CameraInfoDto {
    pub index: u32,
    pub name: String,
    pub description: Option<String>,
}

// 定义允许跨线程访问的状态结构
pub struct AppState {
    pub socket_communication: Arc<SocketCommunication>,
    pub device_manager: Arc<DeviceManager>,
}

// 实现 Send 和 Sync
unsafe impl Send for AppState {}
unsafe impl Sync for AppState {}

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

#[tauri::command]
pub async fn send_to_mobile_phone(
    state: tauri::State<'_, AppState>,
    ip_address: String,
    port: u16,
    kaomoji: String,
    audio_buffer: Vec<u8>,
) -> Result<(), String> {
    state.socket_communication.send_to_mobile_phone(ip_address, port, kaomoji, audio_buffer)
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