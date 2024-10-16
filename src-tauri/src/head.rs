use crate::face_detector::FaceDetector;
use crate::servo_controller::ServoController;
use crate::socket_communication::SocketCommunication;
use gstreamer as gst;
use gstreamer_app::AppSinkExt;
use std::sync::{Arc, Mutex};
use std::time::Duration;

pub struct Head {
    face_detector: Arc<Mutex<FaceDetector>>,
    servo_controller: Arc<Mutex<ServoController>>,
    socket_communication: Arc<SocketCommunication>,
}

impl Head {
    pub fn new() -> Result<Self, Box<dyn std::error::Error>> {
        gst::init()?;

        let face_detector = Arc::new(Mutex::new(FaceDetector::new("seeta_fd_frontal_v1.0.bin")?));
        let servo_controller = Arc::new(Mutex::new(ServoController::new("/dev/ttyUSB0")?));
        let socket_communication = Arc::new(SocketCommunication::new("127.0.0.1:7892")?);

        Ok(Head {
            face_detector,
            servo_controller,
            socket_communication,
        })
    }

    pub fn run(&self) {
        let servo_controller = Arc::clone(&self.servo_controller);
        let socket_communication = Arc::clone(&self.socket_communication);
        std::thread::spawn(move || {
            socket_communication.handle_connections(servo_controller);
        });

        let face_detector = Arc::clone(&self.face_detector);
        let servo_controller = Arc::clone(&self.servo_controller);

        // 创建GStreamer管道
        let pipeline = gst::parse_launch(
            "autovideosrc ! videoconvert ! video/x-raw,format=GRAY8 ! appsink name=sink",
        )
        .expect("Failed to create pipeline");

        let appsink = pipeline
            .clone()
            .dynamic_cast::<gst::Bin>()
            .unwrap()
            .get_by_name("sink")
            .unwrap()
            .dynamic_cast::<gst_app::AppSink>()
            .unwrap();

        appsink.set_emit_signals(true);
        appsink.set_max_buffers(1);
        appsink.set_drop(true);

        let appsink = Arc::new(appsink);
        let face_detector = Arc::clone(&face_detector);
        let servo_controller = Arc::clone(&servo_controller);

        appsink.connect_new_sample(move |sink| {
            let sample = sink.pull_sample().unwrap();
            let buffer = sample.get_buffer().unwrap();
            let map = buffer.map_readable().unwrap();

            let caps = sample.get_caps().unwrap();
            let s = caps.get_structure(0).unwrap();
            let width = s.get_some::<i32>("width").unwrap() as u32;
            let height = s.get_some::<i32>("height").unwrap() as u32;

            // 将视频帧转换为图像
            let image = image::GrayImage::from_raw(width, height, map.as_slice().to_vec()).unwrap();

            // 人脸检测
            let mut detector = face_detector.lock().unwrap();
            let faces = detector.detect_faces(&image);

            if let Some(face) = faces.first() {
                let center_x = face.x() + face.width() / 2;
                let center_y = face.y() + face.height() / 2;

                let servo_x = (center_x as f32 / width as f32 * 180.0) as u8;
                let servo_y = (center_y as f32 / height as f32 * 180.0) as u8;

                let mut servo = servo_controller.lock().unwrap();
                if let Err(e) = servo.set_position(Some(servo_x), Some(servo_y)) {
                    eprintln!("Failed to set servo position: {}", e);
                }
            }

            gst::FlowReturn::Ok
        });

        pipeline.set_state(gst::State::Playing).unwrap();

        // 保持主线程运行
        loop {
            std::thread::sleep(Duration::from_secs(1));
        }
    }

    pub fn set_servo_position(
        &self,
        x: Option<f64>,
        y: Option<f64>,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let mut servo_controller = self.servo_controller.lock().unwrap();
        servo_controller.set_position(x.map(|v| v as u8), y.map(|v| v as u8))
    }
}
