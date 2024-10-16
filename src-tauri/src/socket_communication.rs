use std::net::{TcpListener, TcpStream};
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use serde_json::{json, Value};
use crate::servo_controller::ServoController;

pub struct SocketCommunication {
    listener: TcpListener,
}

impl SocketCommunication {
    pub fn new(address: &str) -> Result<Self, std::io::Error> {
        let listener = TcpListener::bind(address)?;
        Ok(SocketCommunication { listener })
    }

    pub fn handle_connections(&self, servo_controller: Arc<Mutex<ServoController>>) {
        for stream in self.listener.incoming() {
            match stream {
                Ok(stream) => {
                    let servo_controller = Arc::clone(&servo_controller);
                    std::thread::spawn(move || {
                        Self::handle_client(stream, servo_controller);
                    });
                }
                Err(e) => {
                    eprintln!("Error: {}", e);
                }
            }
        }
    }

    fn handle_client(mut stream: TcpStream, servo_controller: Arc<Mutex<ServoController>>) {
        let mut buffer = [0; 1024];
        match stream.read(&mut buffer) {
            Ok(size) => {
                let received = String::from_utf8_lossy(&buffer[..size]);
                if let Ok(json) = serde_json::from_str::<Value>(&received) {
                    if let (Some(x), Some(y)) = (json["servoX"].as_u64(), json["servoY"].as_u64()) {
                        let mut controller = servo_controller.lock().unwrap();
                        if let Err(e) = controller.set_position(Some(x as u8), Some(y as u8)) {
                            eprintln!("Failed to set servo position: {}", e);
                        }
                    }
                }
            }
            Err(e) => {
                eprintln!("Failed to read from connection: {}", e);
            }
        }
    }
}