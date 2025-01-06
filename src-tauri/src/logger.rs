// 引入所需的外部依赖
use chrono::Local;
use log::{LevelFilter, Metadata, Record};
use std::fs::OpenOptions;
use std::io::Write;
use std::sync::Mutex;

// 定义文件日志记录器结构体
struct FileLogger {
    // 使用互斥锁包装文件句柄以支持多线程访问
    file: Mutex<std::fs::File>,
}

impl log::Log for FileLogger {
    // 判断是否需要记录该级别的日志
    fn enabled(&self, metadata: &Metadata) -> bool {
        metadata.level() <= log::Level::Info
    }

    // 实现日志记录功能
    fn log(&self, record: &Record) {
        if self.enabled(record.metadata()) {
            // 获取文件锁
            let mut file = self.file.lock().unwrap();
            // 生成当前时间戳
            let timestamp = Local::now().format("%Y-%m-%d %H:%M:%S%.3f").to_string();

            // 写入格式化的日志内容
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

    // 刷新日志缓冲区(此处未实现)
    fn flush(&self) {}
}

// 设置日志系统的公共函数
pub fn setup_logging() -> Result<(), Box<dyn std::error::Error>> {
    // 创建或打开日志文件，设置为追加模式
    let log_file = OpenOptions::new()
        .create(true)
        .write(true)
        .append(true)
        .open("./logs.txt")?;

    // 创建日志记录器实例
    let logger = FileLogger {
        file: Mutex::new(log_file),
    };

    // 设置全局日志记录器
    log::set_logger(Box::leak(Box::new(logger)))?;
    // 设置最大日志级别为Info
    log::set_max_level(LevelFilter::Info);

    Ok(())
}