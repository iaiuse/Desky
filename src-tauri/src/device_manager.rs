use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use crate::servo_controller::ServoController;
use crate::commands::log_message;

pub struct DeviceManager {
    servo_controllers: Arc<Mutex<HashMap<String, ServoController>>>,
}

impl DeviceManager {
    pub fn new() -> Self {
        log_message("Creating new DeviceManager instance".to_string(), "INFO".to_string(), "DeviceManager".to_string());
        DeviceManager {
            servo_controllers: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn set_servo_position(&self, device_name: String, x: Option<f64>, y: Option<f64>) -> Result<(), String> {
        log_message(format!("Setting servo position for device: {}, X: {:?}, Y: {:?}", device_name, x, y), "INFO".to_string(), "set_servo_position".to_string());
        let mut servo_controllers = self.servo_controllers.lock().map_err(|e| {
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
        
        if let Some(x) = x {
            let x_angle = x as u8;
            log_message(format!("Setting X servo to angle: {}", x_angle), "INFO".to_string(), "set_servo_position".to_string());
            servo_controller.set_position(9, x_angle).map_err(|e| {
                let error_msg = format!("Failed to set X servo position: {}", e);
                log_message(error_msg.clone(), "ERROR".to_string(), "set_servo_position".to_string());
                error_msg
            })?;
        }

        if let Some(y) = y {
            let y_angle = y as u8;
            log_message(format!("Setting Y servo to angle: {}", y_angle), "INFO".to_string(), "set_servo_position".to_string());
            servo_controller.set_position(10, y_angle).map_err(|e| {
                let error_msg = format!("Failed to set Y servo position: {}", e);
                log_message(error_msg.clone(), "ERROR".to_string(), "set_servo_position".to_string());
                error_msg
            })?;
        }

        log_message(format!("Successfully set servo position for device: {}", device_name), "INFO".to_string(), "set_servo_position".to_string());
        Ok(())
    }

    pub fn check_device_status(&self, device_name: String) -> Result<bool, String> {
        log_message(format!("Checking device status for: {}", device_name), "INFO".to_string(), "check_device_status".to_string());
        let mut servo_controllers = self.servo_controllers.lock().map_err(|e| {
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
        
        log_message("Attempting to set test position to check device status".to_string(), "INFO".to_string(), "check_device_status".to_string());
        match servo_controller.set_position(9, 90) {
            Ok(_) => {
                log_message(format!("Device {} is online and responsive", device_name), "INFO".to_string(), "check_device_status".to_string());
                Ok(true)
            },
            Err(e) => {
                let error_msg = format!("Device {} is not responsive: {}", device_name, e);
                log_message(error_msg.clone(), "WARN".to_string(), "check_device_status".to_string());
                Ok(false)
            },
        }
    }
}