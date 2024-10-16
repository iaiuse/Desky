// src/main.rs

#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod commands;
mod head;
mod face_detector;
mod servo_controller;
mod socket_communication;

use std::sync::{Arc, Mutex};
use tauri::Manager;
use image::{ImageBuffer, GrayImage};
use gstreamer as gst;
use gstreamer_app::{AppSinkExt, AppSink};
use gstreamer_video::VideoInfo;
use anyhow::Error;

// Import the new FaceDetector
use crate::face_detector::FaceDetector;

struct AppState {
    head: Arc<head::Head>,
    face_detector: Arc<Mutex<FaceDetector>>,
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 初始化GStreamer
    gst::init()?;

    // 初始化Head
    let head = Arc::new(head::Head::new().expect("Failed to initialize Head"));
    let head_clone = Arc::clone(&head);

    // 初始化新的FaceDetector
    let face_detector = Arc::new(Mutex::new(FaceDetector::new("seeta_fd_frontal_v1.0.bin")?));
    let face_detector_clone = Arc::clone(&face_detector);

    // 启动Head运行线程
    std::thread::spawn(move || {
        head_clone.run();
    });

    // 创建GStreamer管道来捕获摄像头帧
    let pipeline = gst::parse_launch(
        "autovideosrc ! videoconvert ! video/x-raw,format=GRAY8 ! appsink name=sink",
    )?;
    let bus = pipeline.bus().unwrap();

    // 获取appsink元素
    let appsink = pipeline
        .clone()
        .dynamic_cast::<gst::Bin>()
        .unwrap()
        .by_name("sink")
        .unwrap()
        .dynamic_cast::<AppSink>()
        .unwrap();

    appsink.set_emit_signals(true);
    appsink.set_max_buffers(1);
    appsink.set_drop(true);

    // 克隆引用以在回调中使用
    let face_detector_clone = Arc::clone(&face_detector);
    let head_clone_for_detection = Arc::clone(&head);

    // 连接到新样本信号
    appsink.connect_new_sample(move |sink| {
        let sample = match sink.pull_sample() {
            Ok(sample) => sample,
            Err(_) => return gst::FlowReturn::Eos,
        };

        let buffer = sample.buffer().unwrap();
        let caps = sample.caps().unwrap();
        let info = VideoInfo::from_caps(&caps).unwrap();

        let map = buffer.map_readable().unwrap();
        let data = map.as_slice();

        let width = info.width() as u32;
        let height = info.height() as u32;

        // 创建GrayImage
        let image = GrayImage::from_raw(width, height, data.to_vec()).unwrap();

        // 执行人脸检测
        let mut detector = face_detector_clone.lock().unwrap();
        let faces = detector.detect_faces(&image);

        if let Some(face) = faces.first() {
            let center_x = face.x() + face.width() / 2;
            let center_y = face.y() + face.height() / 2;

            // 计算舵机位置
            let servo_x = (center_x as f32 / width as f32 * 180.0) as u8;
            let servo_y = (center_y as f32 / height as f32 * 180.0) as u8;

            // 控制头部
            if let Err(e) = head_clone_for_detection.set_servo_position(
                Some(servo_x as f64),
                Some(servo_y as f64),
            ) {
                eprintln!("Failed to set servo position: {}", e);
            }
        }

        gst::FlowReturn::Ok
    });

    // 启动管道
    pipeline.set_state(gst::State::Playing)?;

    // 处理GStreamer的消息
    let bus = pipeline.bus().unwrap();
    for msg in bus.iter_timed(gst::CLOCK_TIME_NONE) {
        use gst::MessageView;

        match msg.view() {
            MessageView::Eos(..) => break,
            MessageView::Error(err) => {
                eprintln!(
                    "Error from {:?}: {} ({:?})",
                    err.src().map(|s| s.path_string()),
                    err.error(),
                    err.debug()
                );
                break;
            }
            _ => (),
        }
    }

    // 停止管道
    pipeline.set_state(gst::State::Null)?;

    // 运行Tauri应用程序
    tauri::Builder::default()
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                let window = app.get_window("main").unwrap();
                window.open_devtools();
            }
            Ok(())
        })
        .manage(AppState {
            head: Arc::clone(&head),
            face_detector: Arc::clone(&face_detector),
        })
        .invoke_handler(tauri::generate_handler![
            commands::set_servo_position,
            commands::get_serial_ports,
            commands::log_message,
            commands::get_logs,
            commands::clear_logs
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");

    Ok(())
}
