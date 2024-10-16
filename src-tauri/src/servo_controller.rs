use serialport::SerialPort;
use std::time::Duration;

pub struct ServoController {
    port: Box<dyn SerialPort>,
}

impl ServoController {
    pub fn new(port_name: &str) -> Result<Self, Box<dyn std::error::Error>> {
        let port = serialport::new(port_name, 9600)
            .timeout(Duration::from_millis(10))
            .open()?;

        Ok(ServoController { port })
    }

    pub fn set_position(&mut self, x: Option<u8>, y: Option<u8>) -> Result<(), Box<dyn std::error::Error>> {
        let command = format!("{},{}\n", x.unwrap_or(90), y.unwrap_or(90));
        self.port.write_all(command.as_bytes())?;
        Ok(())
    }
}