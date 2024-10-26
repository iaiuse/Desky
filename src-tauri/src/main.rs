#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod commands;
mod socket_communication;
mod device_manager;
mod servo_controller;
mod logger;

use crate::logger::setup_logging;
use crate::socket_communication::SocketCommunication;
use crate::device_manager::DeviceManager;
use std::sync::{Arc, Mutex};
use tauri::Manager;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 创建线程安全的组件实例
    let socket_communication = Arc::new(SocketCommunication::new());
    let device_manager = Arc::new(DeviceManager::new());
    // 创建应用状态
    let app_state = commands::AppState {
        socket_communication: socket_communication.clone(),
        device_manager: device_manager.clone(),
    };

    tauri::Builder::default()
        .manage(app_state)
        .setup(|app| {
            setup_logging().expect("Failed to setup logging");
            #[cfg(debug_assertions)]
            {
                let window = app.get_window("main").unwrap();
                window.open_devtools();
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::set_servo_position,
            commands::check_device_status,
            commands::send_to_mobile_phone,
            commands::greet,
            commands::log_message,
            commands::get_logs,
            commands::clear_logs,
            commands::get_serial_ports,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");

    Ok(())
}