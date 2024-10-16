use std::net::{TcpStream, SocketAddr};
use std::io::{Read, Write};
use std::time::Duration;
use crate::commands::log_message;

pub struct SocketCommunication {}

impl SocketCommunication {
    pub fn new() -> Self {
        log_message("SocketCommunication instance created".to_string(), "INFO".to_string(), "SocketCommunication".to_string());
        SocketCommunication {}
    }

    pub fn send_to_mobile_phone(&self, ip_address: String, port: u16, kaomoji: String, audio_buffer: Vec<u8>) -> Result<(), String> {
        log_message(format!("Attempting to send data to mobile phone at {}:{}", ip_address, port), "INFO".to_string(), "send_to_mobile_phone".to_string());

        let addr = format!("{}:{}", ip_address, port).parse::<SocketAddr>().map_err(|e| {
            let error_msg = format!("Failed to parse address: {}", e);
            log_message(error_msg.clone(), "ERROR".to_string(), "send_to_mobile_phone".to_string());
            error_msg
        })?;

        let mut stream = TcpStream::connect_timeout(&addr, Duration::from_secs(5)).map_err(|e| {
            let error_msg = format!("Failed to connect to mobile phone: {}", e);
            log_message(error_msg.clone(), "ERROR".to_string(), "send_to_mobile_phone".to_string());
            error_msg
        })?;

        let kaomoji_bytes = kaomoji.into_bytes();
        let kaomoji_len = kaomoji_bytes.len() as u32;
        let audio_len = audio_buffer.len() as u32;

        log_message(format!("Sending kaomoji (length: {}) and audio (length: {})", kaomoji_len, audio_len), "INFO".to_string(), "send_to_mobile_phone".to_string());

        stream.write_all(&kaomoji_len.to_be_bytes()).map_err(|e| {
            let error_msg = format!("Failed to send kaomoji length: {}", e);
            log_message(error_msg.clone(), "ERROR".to_string(), "send_to_mobile_phone".to_string());
            error_msg
        })?;
        stream.write_all(&kaomoji_bytes).map_err(|e| {
            let error_msg = format!("Failed to send kaomoji: {}", e);
            log_message(error_msg.clone(), "ERROR".to_string(), "send_to_mobile_phone".to_string());
            error_msg
        })?;
        stream.write_all(&audio_len.to_be_bytes()).map_err(|e| {
            let error_msg = format!("Failed to send audio length: {}", e);
            log_message(error_msg.clone(), "ERROR".to_string(), "send_to_mobile_phone".to_string());
            error_msg
        })?;
        stream.write_all(&audio_buffer).map_err(|e| {
            let error_msg = format!("Failed to send audio data: {}", e);
            log_message(error_msg.clone(), "ERROR".to_string(), "send_to_mobile_phone".to_string());
            error_msg
        })?;

        log_message("Successfully sent data to mobile phone".to_string(), "INFO".to_string(), "send_to_mobile_phone".to_string());
        Ok(())
    }

    pub fn check_mobile_phone_status(&self, ip_address: String, port: u16) -> bool {
        log_message(format!("Checking mobile phone status at {}:{}", ip_address, port), "INFO".to_string(), "check_mobile_phone_status".to_string());

        let addr = format!("{}:{}", ip_address, port).parse::<SocketAddr>().ok();
        if let Some(addr) = addr {
            let result = TcpStream::connect_timeout(&addr, Duration::from_secs(5)).is_ok();
            log_message(format!("Mobile phone status check result: {}", result), "INFO".to_string(), "check_mobile_phone_status".to_string());
            result
        } else {
            log_message("Failed to parse address".to_string(), "ERROR".to_string(), "check_mobile_phone_status".to_string());
            false
        }
    }

    pub fn initialize_mobile_phone_connection(&self, ip_address: String, port: u16) -> Result<(), String> {
        log_message(format!("Initializing mobile phone connection at {}:{}", ip_address, port), "INFO".to_string(), "initialize_mobile_phone_connection".to_string());

        let addr = format!("{}:{}", ip_address, port).parse::<SocketAddr>().map_err(|e| {
            let error_msg = format!("Failed to parse address: {}", e);
            log_message(error_msg.clone(), "ERROR".to_string(), "initialize_mobile_phone_connection".to_string());
            error_msg
        })?;

        let mut stream = TcpStream::connect_timeout(&addr, Duration::from_secs(5)).map_err(|e| {
            let error_msg = format!("Failed to connect to mobile phone: {}", e);
            log_message(error_msg.clone(), "ERROR".to_string(), "initialize_mobile_phone_connection".to_string());
            error_msg
        })?;

        log_message("Sending INIT message".to_string(), "INFO".to_string(), "initialize_mobile_phone_connection".to_string());
        stream.write_all(b"INIT").map_err(|e| {
            let error_msg = format!("Failed to send INIT message: {}", e);
            log_message(error_msg.clone(), "ERROR".to_string(), "initialize_mobile_phone_connection".to_string());
            error_msg
        })?;

        let mut buffer = [0; 3];
        log_message("Waiting for ACK response".to_string(), "INFO".to_string(), "initialize_mobile_phone_connection".to_string());
        stream.read_exact(&mut buffer).map_err(|e| {
            let error_msg = format!("Failed to read ACK response: {}", e);
            log_message(error_msg.clone(), "ERROR".to_string(), "initialize_mobile_phone_connection".to_string());
            error_msg
        })?;

        if &buffer == b"ACK" {
            log_message("Successfully initialized mobile phone connection".to_string(), "INFO".to_string(), "initialize_mobile_phone_connection".to_string());
            Ok(())
        } else {
            let error_msg = format!("Failed to initialize connection, received: {:?}", buffer);
            log_message(error_msg.clone(), "ERROR".to_string(), "initialize_mobile_phone_connection".to_string());
            Err(error_msg)
        }
    }
}