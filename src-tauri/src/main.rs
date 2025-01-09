#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod commands;
mod device_manager;
mod servo_controller;
mod logger;
mod http_client;

use crate::logger::setup_logging;
use crate::device_manager::DeviceManager;
use std::sync::Arc;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 创建线程安全的组件实例
    let device_manager = Arc::new(DeviceManager::new());
    // 创建应用状态
    let app_state = commands::AppState {
        device_manager: device_manager.clone(),
    };

    tauri::Builder::default()
        .manage(app_state)
        .setup(|_app| {
            setup_logging().expect("Failed to setup logging");
            #[cfg(debug_assertions)]
            {
                let window = _app.get_window("main").unwrap();
                window.open_devtools();
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::set_servo_position,
            commands::check_device_status,
            commands::greet,
            commands::log_message,
            commands::get_logs,
            commands::clear_logs,
            commands::get_serial_ports,
            commands::proxy_request,
            commands::check_server_status,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");

    Ok(())
}