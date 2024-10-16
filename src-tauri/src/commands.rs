// src/commands.rs

use serde::{Serialize, Deserialize};
use log::{info, error, warn};
use std::sync::Mutex;
use std::net::TcpStream;
use std::io::Write;
use serialport::available_ports;

pub struct AppState {
    pub socket: Mutex<Option<TcpStream>>,
}

#[derive(Serialize, Deserialize)]
pub struct ServoPosition {
    pub x: Option<f64>,
    pub y: Option<f64>,
}

#[tauri::command]
pub fn set_servo_position(
    x: Option<f64>,
    y: Option<f64>,
    state: tauri::State<AppState>,
) -> Result<(), String> {
    let mut socket = state.socket.lock().map_err(|_| "Failed to lock socket")?;
    
    if socket.is_none() {
        *socket = Some(TcpStream::connect("127.0.0.1:7892").map_err(|e| {
            log_message(format!("Failed to connect to socket: {}", e), "ERROR".to_string(), "set_servo_position".to_string());
            e.to_string()
        })?);
    }
    
    if let Some(socket) = socket.as_mut() {
        let position = ServoPosition { x, y };
        let json = serde_json::to_string(&position).map_err(|e| e.to_string())?;
        socket.write_all(json.as_bytes()).map_err(|e| {
            log_message(format!("Failed to write to socket: {}", e), "ERROR".to_string(), "set_servo_position".to_string());
            e.to_string()
        })?;
        log_message(format!("Servo position set: x={:?}, y={:?}", x, y), "INFO".to_string(), "set_servo_position".to_string());
        Ok(())
    } else {
        log_message("Failed to connect to socket".to_string(), "ERROR".to_string(), "set_servo_position".to_string());
        Err("Failed to connect to socket".to_string())
    }
}

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