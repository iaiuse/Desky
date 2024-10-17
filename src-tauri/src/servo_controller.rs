use serialport::SerialPort;
use std::time::Duration;
use std::io::{Write, Read};
use crate::commands::log_message;

pub struct ServoController {
    port: Box<dyn SerialPort>,
}

impl ServoController {
    pub fn new(port_name: &str) -> Result<Self, Box<dyn std::error::Error>> {
        log_message(
            format!("Attempting to create new ServoController for port {}", port_name),
            "INFO".to_string(),
            "servo_controller".to_string(),
        );

        let port = serialport::new(port_name, 9600)
            .timeout(Duration::from_millis(1000))
            .open()?;

        log_message(
            format!("Successfully opened serial port {}", port_name),
            "INFO".to_string(),
            "servo_controller".to_string(),
        );

        Ok(ServoController { port })
    }

    pub fn set_position(&mut self, x: Option<u8>, y: Option<u8>) -> Result<(), Box<dyn std::error::Error>> {
        let x_value = x.unwrap_or(90);
        let y_value = y.unwrap_or(90);
        
        log_message(
            format!("Setting servo position: X={}, Y={}", x_value, y_value),
            "INFO".to_string(),
            "servo_controller".to_string(),
        );

        let command = format!("{},{}\n", x_value, y_value);
        self.port.write_all(command.as_bytes())?;
        self.port.flush()?;

        log_message(
            format!("Successfully sent command: {}", command.trim()),
            "INFO".to_string(),
            "servo_controller".to_string(),
        );

        // 等待一段时间，让 Arduino 有时间处理命令
        std::thread::sleep(Duration::from_millis(100));

        // 读取 Arduino 的响应
        let mut response = String::new();
        let mut serial_buf: Vec<u8> = vec![0; 1000];
        match self.port.read(serial_buf.as_mut_slice()) {
            Ok(t) => {
                response.push_str(&String::from_utf8_lossy(&serial_buf[..t]));
                log_message(
                    format!("Received response from Arduino: {}", response.trim()),
                    "INFO".to_string(),
                    "servo_controller".to_string(),
                );
            },
            Err(ref e) if e.kind() == std::io::ErrorKind::TimedOut => {
                log_message(
                    "No response from Arduino (timeout)".to_string(),
                    "WARN".to_string(),
                    "servo_controller".to_string(),
                );
            },
            Err(e) => {
                log_message(
                    format!("Error reading from serial port: {}", e),
                    "ERROR".to_string(),
                    "servo_controller".to_string(),
                );
                return Err(Box::new(e));
            }
        }

        Ok(())
    }
}