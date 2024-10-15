// src/main.rs

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod logger;
mod commands;

use crate::logger::setup_logging;
use tauri::Manager;

use crate::commands::{AppState, set_servo_position, get_serial_ports};
use std::sync::Mutex;

fn main() {
    tauri::Builder::default()
        .manage(AppState {
            socket: Mutex::new(None),
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
            set_servo_position,
            get_serial_ports
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}