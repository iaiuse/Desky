#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod commands;
mod socket_communication;
mod device_manager;
mod servo_controller;
mod logger;
mod camera_controller;

use crate::logger::setup_logging;
use crate::socket_communication::SocketCommunication;
use crate::device_manager::DeviceManager;
use crate::camera_controller::CameraController;
use crate::commands::AppState;
use tauri::Manager;
use std::sync::{Arc, Mutex};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let socket_communication = Arc::new(SocketCommunication::new());
    let device_manager = Arc::new(DeviceManager::new());
    let camera_controller = Arc::new(Mutex::new(CameraController::new()?)); // Handle the Result here

    tauri::Builder::default()
        .manage(AppState {
            socket_communication: socket_communication.clone(),
            device_manager: device_manager.clone(),
            camera_controller: camera_controller.clone(),
        })
        // In main.rs
        .setup(move |app| {
            setup_logging().expect("Failed to setup logging");
            #[cfg(debug_assertions)]
            {
                let window = app.get_window("main").unwrap();
                window.open_devtools();
            }

            // Start the camera in a separate tokio task
            let camera_controller = camera_controller.clone();
            tokio::spawn(async move {
                loop {
                    if let Ok(mut controller) = camera_controller.lock() {
                        match controller.toggle_camera(true).await {
                            Ok(_) => {
                                // Camera toggled successfully
                                break;  // Exit the loop if successful
                            }
                            Err(e) => {
                                eprintln!("Error toggling camera: {:?}", e);
                                // Maybe add a delay before retrying
                                tokio::time::sleep(std::time::Duration::from_secs(1)).await;
                            }
                        }
                    }
                }
            });

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
            commands::toggle_camera,
            commands::get_face_position,
            commands::get_available_cameras,
            commands::select_camera,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");

    Ok(())
}