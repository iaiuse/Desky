use chrono::Local;
use log::{LevelFilter, Metadata, Record};
use std::fs::OpenOptions;
use std::io::Write;
use std::sync::Mutex;

struct FileLogger {
    file: Mutex<std::fs::File>,
}

impl log::Log for FileLogger {
    fn enabled(&self, metadata: &Metadata) -> bool {
        metadata.level() <= log::Level::Info
    }

    fn log(&self, record: &Record) {
        if self.enabled(record.metadata()) {
            let mut file = self.file.lock().unwrap();
            let timestamp = Local::now().format("%Y-%m-%d %H:%M:%S%.3f").to_string();

            writeln!(
                file,
                "[{}] [{}] [{}] {}",
                timestamp,
                record.level(),
                record.target(),
                record.args()
            )
            .unwrap();
        }
    }

    fn flush(&self) {}
}

pub fn setup_logging() -> Result<(), Box<dyn std::error::Error>> {
    let log_file = OpenOptions::new()
        .create(true)
        .write(true)
        .append(true)
        .open("./logs.txt")?;

    let logger = FileLogger {
        file: Mutex::new(log_file),
    };

    log::set_logger(Box::leak(Box::new(logger)))?;
    log::set_max_level(LevelFilter::Info);

    Ok(())
}