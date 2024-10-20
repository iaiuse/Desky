use serde::Serialize;
use crate::socket_communication::SocketCommunication;
use crate::device_manager::DeviceManager;
use serialport::available_ports;
use crate::camera_controller::CameraController;
use std::sync::{Arc, Mutex};
use nokhwa::utils::CameraIndex;

pub struct AppState {
    pub socket_communication: Arc<SocketCommunication>,
    pub device_manager: Arc<DeviceManager>,
    pub camera_controller: Arc<Mutex<CameraController>>, // 使用 Mutex 以实现可变性
}

#[derive(Serialize)]
pub struct CameraInfoDto {
    pub index: u32,
    pub name: String,
    pub description: Option<String>,
}

// In commands.rs
#[tauri::command]
pub async fn toggle_camera(active: bool, state: tauri::State<'_, AppState>) -> Result<(), String> {
    let camera_controller = state.camera_controller.clone();
    tokio::spawn(async move {
        if let Ok(mut controller) = camera_controller.lock() {
            match controller.toggle_camera(active).await {
                Ok(_) => {
                    // Camera toggled successfully
                }
                Err(e) => {
                    eprintln!("Error toggling camera: {:?}", e);
                }
            }
        }
    });
    Ok(())
}

#[tauri::command]
pub fn get_face_position(state: tauri::State<AppState>) -> Option<(f64, f64)> {
    let camera_controller = state.camera_controller.lock().unwrap();
    camera_controller.get_face_position()
}

#[tauri::command]
pub fn get_available_cameras() -> Vec<CameraInfoDto> {
    CameraController::get_available_cameras()
        .into_iter()
        .map(|info| CameraInfoDto {
            index: match info.index() {
                CameraIndex::Index(i) => *i,
                CameraIndex::String(_) => 0,
            },
            name: info.human_name().to_string(),
            description: Some(info.description().to_string()),
        })
        .collect()
}

#[tauri::command]
pub fn select_camera(index: u32, state: tauri::State<AppState>) {
    let mut camera_controller = state.camera_controller.lock().unwrap();
    camera_controller.select_camera(index as usize);
}

// 其他方法保持不变...


#[tauri::command]
pub fn set_servo_position(
    device_name: String,
    x: Option<f64>,
    y: Option<f64>,
    state: tauri::State<AppState>,
) -> Result<(), String> {
    log_message(format!("Attempting to set servo position for device: {}", device_name), "INFO".to_string(), "set_servo_position".to_string());
    state.device_manager.set_servo_position(device_name, x, y)
}

#[tauri::command]
pub fn check_device_status(device_name: String, state: tauri::State<AppState>) -> Result<bool, String> {
    log_message(format!("Checking device status for: {}", device_name), "INFO".to_string(), "check_device_status".to_string());
    state.device_manager.check_device_status(device_name)
}

#[tauri::command]
pub fn send_to_mobile_phone(ip_address: String, port: u16, kaomoji: String, audio_buffer: Vec<u8>, state: tauri::State<AppState>) -> Result<(), String> {
    state.socket_communication.send_to_mobile_phone(ip_address, port, kaomoji, audio_buffer)
}

#[tauri::command]
pub fn check_mobile_phone_status(ip_address: String, port: u16, state: tauri::State<AppState>) -> bool {
    state.socket_communication.check_mobile_phone_status(ip_address, port)
}

#[tauri::command]
pub fn initialize_mobile_phone_connection(ip_address: String, port: u16, state: tauri::State<AppState>) -> Result<(), String> {
    state.socket_communication.initialize_mobile_phone_connection(ip_address, port)
}

// 其他现有的命令保持不变
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
    match available_ports() {
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
