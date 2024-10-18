use nokhwa::{Camera, utils::{CameraInfo, CameraIndex, CameraFormat, FrameFormat, RequestedFormat, RequestedFormatType, ApiBackend}, pixel_format::RgbFormat};
use rustface::ImageData;
use std::sync::{Arc, Mutex};
use tokio::time::{interval, Duration};
use crate::commands::log_message;

pub struct CameraController {
    camera_active: Arc<Mutex<bool>>,
    face_position: Arc<Mutex<Option<(f64, f64)>>>,
    selected_camera_index: Arc<Mutex<Option<usize>>>,
}

impl CameraController {
    pub fn new() -> Self {
        log_message("Creating new CameraController instance".to_string(), "INFO".to_string(), "CameraController".to_string());
        CameraController {
            camera_active: Arc::new(Mutex::new(false)),
            face_position: Arc::new(Mutex::new(None)),
            selected_camera_index: Arc::new(Mutex::new(None)),
        }
    }

    pub fn get_available_cameras() -> Vec<CameraInfo> {
        log_message("Querying available cameras...".to_string(), "INFO".to_string(), "CameraController.get_available_cameras".to_string());

        let backends = vec![ApiBackend::AVFoundation, ApiBackend::Auto, ApiBackend::Auto]; // 使用有效的后端

        for backend in backends {
            log_message(format!("Trying backend: {:?}", backend), "INFO".to_string(), "CameraController.get_available_cameras".to_string());
            match nokhwa::query(backend) {
                Ok(cameras) => {
                    log_message(format!("Found {} cameras using {:?} backend", cameras.len(), backend), "INFO".to_string(), "CameraController.get_available_cameras".to_string());
                    for (i, camera) in cameras.iter().enumerate() {
                        log_message(format!("Camera {}: {:?}", i, camera), "INFO".to_string(), "CameraController.get_available_cameras".to_string());
                    }
                    return cameras;
                },
                Err(e) => {
                    log_message(format!("Failed to query cameras with {:?} backend: {}", backend, e), "WARN".to_string(), "CameraController.get_available_cameras".to_string());
                }
            }
        }

        log_message("No cameras found with any backend".to_string(), "ERROR".to_string(), "CameraController".to_string());
        Vec::new()
    }

    pub fn select_camera(&mut self, index: usize) {
        let mut selected_camera = self.selected_camera_index.lock().unwrap();
        *selected_camera = Some(index);
        log_message(format!("Selected camera with index: {}", index), "INFO".to_string(), "CameraController".to_string());
    }

    pub fn toggle_camera(&self, active: bool) {
        let mut camera_active = self.camera_active.lock().unwrap();
        *camera_active = active;
        log_message(format!("Camera toggled to {}", active), "INFO".to_string(), "CameraController".to_string());
    }

    pub fn get_face_position(&self) -> Option<(f64, f64)> {
        let face_position = self.face_position.lock().unwrap();
        *face_position
    }

    pub async fn run(&self) {
        log_message("Starting camera controller".to_string(), "INFO".to_string(), "CameraController".to_string());

        let camera_index = match *self.selected_camera_index.lock().unwrap() {
            Some(index) => index,
            None => {
                log_message("No camera selected".to_string(), "ERROR".to_string(), "CameraController".to_string());
                return;
            }
        };

        let mut camera = match Camera::new(
            CameraIndex::Index(camera_index as u32),
            RequestedFormat::new::<RgbFormat>(RequestedFormatType::Exact(CameraFormat::new_from(640, 480, FrameFormat::MJPEG, 30))),
        ) {
            Ok(cam) => cam,
            Err(e) => {
                log_message(format!("Failed to initialize camera: {}", e), "ERROR".to_string(), "CameraController".to_string());
                return;
            }
        };

        if let Err(e) = camera.open_stream() {
            log_message(format!("Failed to open camera stream: {}", e), "ERROR".to_string(), "CameraController".to_string());
            return;
        }

        let mut detector = match rustface::create_detector("model/seeta_fd_frontal_v1.0.bin") {
            Ok(det) => det,
            Err(e) => {
                log_message(format!("Failed to create face detector: {}", e), "ERROR".to_string(), "CameraController".to_string());
                return;
            }
        };

        detector.set_min_face_size(20);
        detector.set_score_thresh(2.0);
        detector.set_pyramid_scale_factor(0.8);
        detector.set_slide_window_step(4, 4);

        log_message("Face detector initialized".to_string(), "INFO".to_string(), "CameraController".to_string());

        let mut interval = interval(Duration::from_millis(33)); // ~30 fps

        loop {
            interval.tick().await;
            if !*self.camera_active.lock().unwrap() {
                continue;
            }

            let frame = match camera.frame() {
                Ok(f) => f,
                Err(e) => {
                    log_message(format!("Failed to capture frame: {}", e), "ERROR".to_string(), "CameraController".to_string());
                    continue;
                }
            };

            let image = frame.buffer();
            let width = frame.resolution().width() as i32;
            let height = frame.resolution().height() as i32;
            let image_data = ImageData::new(image, width as u32, height as u32);

            if let Some(face) = detector.detect(&image_data).into_iter().next() {
                let center_x = (face.bbox().x() + face.bbox().width() as i32 / 2) as f64 / width as f64;
                let center_y = (face.bbox().y() + face.bbox().height() as i32 / 2) as f64 / height as f64;

                let mut face_position = self.face_position.lock().unwrap();
                *face_position = Some((center_x, center_y));
                log_message(format!("Face detected at position: ({:.2}, {:.2})", center_x, center_y), "INFO".to_string(), "CameraController".to_string());
            } else {
                let mut face_position = self.face_position.lock().unwrap();
                if face_position.is_some() {
                    *face_position = None;
                    log_message("Face lost".to_string(), "INFO".to_string(), "CameraController".to_string());
                }
            }
        }
    }
}
