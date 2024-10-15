// src/main.rs

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod logger;

use crate::logger::setup_logging;
use log;
use std::fs;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn log_message(message: String, level: String, module: String) {
    let level = match level.as_str() {
        "INFO" => log::Level::Info,
        "WARN" => log::Level::Warn,
        "ERROR" => log::Level::Error,
        _ => log::Level::Info,
    };
    log::log!(target: &module, level, "{}", message);
}

#[tauri::command]
fn get_logs() -> Result<String, String> {
    std::fs::read_to_string("./logs.txt")
        .map_err(|e| format!("Failed to read log file: {}", e))
}

#[tauri::command]
fn clear_logs() -> Result<(), String> {
    std::fs::write("./logs.txt", "")
        .map_err(|e| format!("Failed to clear log file: {}", e))
}


fn main() {
    tauri::Builder::default()
        .setup(|_app| {
            setup_logging().expect("Failed to setup logging");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            get_logs,
            clear_logs,
            log_message
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
