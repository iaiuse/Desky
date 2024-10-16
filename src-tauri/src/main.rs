// src/main.rs

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod logger;
mod commands;
mod servo_controller;

use crate::logger::setup_logging;
use crate::servo_controller::ServoController;
use tauri::Manager;
use std::sync::{Arc, Mutex};
use std::collections::HashMap;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 初始化一个空的 HashMap 来存储 ServoController 实例
    let servo_controllers: Arc<Mutex<HashMap<String, ServoController>>> = Arc::new(Mutex::new(HashMap::new()));

    tauri::Builder::default()
        .manage(commands::AppState {
            servo_controllers: Arc::clone(&servo_controllers),
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
            commands::greet,
            commands::get_logs,
            commands::clear_logs,
            commands::log_message,
            commands::set_servo_position,
            commands::get_serial_ports,
            commands::check_device_status
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");

    Ok(())
}