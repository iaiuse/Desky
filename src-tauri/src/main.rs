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
use tauri::Manager;
use std::sync::Arc;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 创建 SocketCommunication 和 DeviceManager 实例
    let socket_communication = Arc::new(SocketCommunication::new());
    let device_manager = Arc::new(DeviceManager::new());

    tauri::Builder::default()
        .manage(commands::AppState {
            socket_communication: Arc::clone(&socket_communication),
            device_manager: Arc::clone(&device_manager),
        })
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
            commands::check_mobile_phone_status,
            commands::initialize_mobile_phone_connection,
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