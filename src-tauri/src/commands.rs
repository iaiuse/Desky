// src/commands.rs
use serde::{Serialize, Deserialize};
use log::{info, error, warn};
use serialport::available_ports;
use crate::servo_controller::ServoController;
use std::sync::{Arc, Mutex};
use std::collections::HashMap;

pub struct AppState {
    pub servo_controllers: Arc<Mutex<HashMap<String, ServoController>>>,
}

#[derive(Serialize, Deserialize)]
pub struct ServoPosition {
    pub x: Option<f64>,
    pub y: Option<f64>,
}

#[tauri::command]
pub fn set_servo_position(
    device_name: String,
    x: Option<f64>,
    y: Option<f64>,
    state: tauri::State<AppState>,
) -> Result<(), String> {
    log_message(format!("Attempting to set servo position for device: {}", device_name), "INFO".to_string(), "set_servo_position".to_string());

    let mut servo_controllers = state.servo_controllers.lock().map_err(|e| {
        let error_msg = format!("Failed to lock servo controllers: {}", e);
        log_message(error_msg.clone(), "ERROR".to_string(), "set_servo_position".to_string());
        error_msg
    })?;
    
    if !servo_controllers.contains_key(&device_name) {
        log_message(format!("Creating new ServoController for device: {}", device_name), "INFO".to_string(), "set_servo_position".to_string());
        let new_controller = ServoController::new(&device_name).map_err(|e| {
            let error_msg = format!("Failed to create ServoController: {}", e);
            log_message(error_msg.clone(), "ERROR".to_string(), "set_servo_position".to_string());
            error_msg
        })?;
        servo_controllers.insert(device_name.clone(), new_controller);
    }

    let servo_controller = servo_controllers.get_mut(&device_name).ok_or_else(|| {
        let error_msg = format!("Device not found: {}", device_name);
        log_message(error_msg.clone(), "ERROR".to_string(), "set_servo_position".to_string());
        error_msg
    })?;
    
    // Convert f64 to u8, assuming the servo range is 0-180 degrees
    let x = x.map(|v| v as u8);
    let y = y.map(|v| v as u8);

    log_message(format!("Setting servo position: x={:?}, y={:?}", x, y), "INFO".to_string(), "set_servo_position".to_string());

    servo_controller.set_position(x, y).map_err(|e| {
        let error_msg = format!("Failed to set servo position: {}", e);
        log_message(error_msg.clone(), "ERROR".to_string(), "set_servo_position".to_string());
        error_msg
    })?;

    log_message(format!("Servo position set successfully for device {}: x={:?}, y={:?}", device_name, x, y), "INFO".to_string(), "set_servo_position".to_string());
    Ok(())
}

#[tauri::command]
pub fn check_device_status(device_name: String, state: tauri::State<AppState>) -> Result<bool, String> {
    log_message(format!("Checking device status for: {}", device_name), "INFO".to_string(), "check_device_status".to_string());

    let mut servo_controllers = state.servo_controllers.lock().map_err(|e| {
        let error_msg = format!("Failed to lock servo controllers: {}", e);
        log_message(error_msg.clone(), "ERROR".to_string(), "check_device_status".to_string());
        error_msg
    })?;
    
    if !servo_controllers.contains_key(&device_name) {
        log_message(format!("Creating new ServoController for device: {}", device_name), "INFO".to_string(), "check_device_status".to_string());
        let new_controller = ServoController::new(&device_name).map_err(|e| {
            let error_msg = format!("Failed to create ServoController: {}", e);
            log_message(error_msg.clone(), "ERROR".to_string(), "check_device_status".to_string());
            error_msg
        })?;
        servo_controllers.insert(device_name.clone(), new_controller);
    }

    let servo_controller = servo_controllers.get_mut(&device_name).ok_or_else(|| {
        let error_msg = format!("Device not found: {}", device_name);
        log_message(error_msg.clone(), "ERROR".to_string(), "check_device_status".to_string());
        error_msg
    })?;
    
    // Try to move the servo slightly to check if it's responsive
    match servo_controller.set_position(Some(80), None) {
        Ok(_) => {
            log_message(format!("Device {} is online and responsive", device_name), "INFO".to_string(), "check_device_status".to_string());
            Ok(true)
        },
        Err(e) => {
            let error_msg = format!("Failed to set servo position: {}", e);
            log_message(error_msg, "ERROR".to_string(), "check_device_status".to_string());
            Ok(false)
        }
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