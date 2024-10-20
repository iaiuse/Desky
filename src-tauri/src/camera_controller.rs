use nokhwa::{Camera, utils::{CameraInfo, CameraIndex, CameraFormat, FrameFormat, RequestedFormat, RequestedFormatType, ApiBackend}, pixel_format::RgbFormat};
use rustface::{ImageData, Detector, FaceInfo};
use std::sync::{Arc, Mutex};
use tokio::time::{interval, Duration};
use crate::commands::log_message;

pub struct ThreadSafeCamera(Arc<Mutex<Camera>>);

impl ThreadSafeCamera {
    pub fn new(index: CameraIndex, format: RequestedFormat) -> Result<Self, nokhwa::NokhwaError> {
        let camera = Camera::new(index, format)?;
        Ok(ThreadSafeCamera(Arc::new(Mutex::new(camera))))
    }

    pub fn frame(&self) -> Result<nokhwa::Buffer, nokhwa::NokhwaError> {
        let mut camera = self.0.lock().unwrap();
        camera.frame()
    }

    pub fn open_stream(&self) -> Result<(), nokhwa::NokhwaError> {
        let mut camera = self.0.lock().unwrap();
        camera.open_stream()
    }
}

unsafe impl Send for ThreadSafeCamera {}
unsafe impl Sync for ThreadSafeCamera {}

pub struct ThreadSafeDetector(Arc<Mutex<Box<dyn Detector + Send>>>);

impl ThreadSafeDetector {
    pub fn new(detector: Box<dyn Detector + Send>) -> Self {
        ThreadSafeDetector(Arc::new(Mutex::new(detector)))
    }

    pub fn detect(&self, image: &ImageData) -> Vec<FaceInfo> {
        let mut detector = self.0.lock().unwrap();
        detector.detect(image)
    }
}

unsafe impl Send for ThreadSafeDetector {}
unsafe impl Sync for ThreadSafeDetector {}

pub struct CameraController {
    camera: ThreadSafeCamera,
    camera_active: Arc<Mutex<bool>>,
    face_position: Arc<Mutex<Option<(f64, f64)>>>,
    selected_camera_index: Arc<Mutex<Option<usize>>>,
    detector: ThreadSafeDetector,
}

impl CameraController {
        pub fn new() -> Result<Self, Box<dyn std::error::Error>> {
            log_message("Creating new CameraController instance".to_string(), "INFO".to_string(), "CameraController".to_string());
            
            let detector = rustface::create_detector("model/seeta_fd_frontal_v1.0.bin")
                .map_err(|e| Box::new(e) as Box<dyn std::error::Error>)?;
            
            let detector = ThreadSafeDetector::new(Box::new(SendableDetector(detector)));
    
            let camera = ThreadSafeCamera::new(
                CameraIndex::Index(0),
                RequestedFormat::new::<RgbFormat>(RequestedFormatType::Exact(
                    CameraFormat::new_from(640, 480, FrameFormat::MJPEG, 30)
                ))
            )?;
    
            Ok(CameraController {
                camera,
                camera_active: Arc::new(Mutex::new(false)),
                face_position: Arc::new(Mutex::new(None)),
                selected_camera_index: Arc::new(Mutex::new(Some(0))),
                detector,
            })
        }
    

    pub fn get_available_cameras() -> Vec<CameraInfo> {
        log_message("Querying available cameras...".to_string(), "INFO".to_string(), "CameraController.get_available_cameras".to_string());

        let backends = vec![ApiBackend::AVFoundation, ApiBackend::Auto];

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

    pub fn select_camera(&mut self, index: usize) -> Result<(), nokhwa::NokhwaError> {
        let mut selected_camera = self.selected_camera_index.lock().unwrap();
        *selected_camera = Some(index);
        log_message(format!("Selected camera with index: {}", index), "INFO".to_string(), "CameraController".to_string());
        
        // Reinitialize the camera with the new index
        self.camera = ThreadSafeCamera::new(
            CameraIndex::Index(index as u32),
            RequestedFormat::new::<RgbFormat>(RequestedFormatType::Exact(
                CameraFormat::new_from(640, 480, FrameFormat::MJPEG, 30)
            ))
        )?;

        Ok(())
    }

    pub async fn toggle_camera(&mut self, active: bool) -> Result<()> {
        {
            let mut camera_active = self.camera_active.lock().unwrap();
            *camera_active = active;
        }
        log_message(format!("Camera toggled to {}", active), "INFO".to_string(), "CameraController.toggle_camera".to_string());

        if active {
            self.run().await;
        }
    }

    pub fn get_face_position(&self) -> Option<(f64, f64)> {
        let face_position = self.face_position.lock().unwrap();
        *face_position
    }

    pub async fn run(&self) {
        log_message("Starting camera controller".to_string(), "INFO".to_string(), "CameraController.run".to_string());

        if let Err(e) = self.camera.open_stream() {
            log_message(format!("Failed to open camera stream: {}", e), "ERROR".to_string(), "CameraController.run".to_string());
            return;
        }

        let mut interval = interval(Duration::from_millis(33)); // ~30 fps

        loop {
            interval.tick().await;

            if !*self.camera_active.lock().unwrap() {
                continue;
            }

            let frame = match self.camera.frame() {
                Ok(f) => f,
                Err(e) => {
                    log_message(format!("Failed to capture frame: {}", e), "ERROR".to_string(), "CameraController.run".to_string());
                    continue;
                }
            };

            let image = frame.buffer();
            let width = frame.resolution().width() as i32;
            let height = frame.resolution().height() as i32;
            let image_data = ImageData::new(image, width as u32, height as u32);

            if let Some(face) = self.detector.detect(&image_data).into_iter().next() {
                let center_x = (face.bbox().x() + face.bbox().width() as i32 / 2) as f64 / width as f64;
                let center_y = (face.bbox().y() + face.bbox().height() as i32 / 2) as f64 / height as f64;

                let mut face_position = self.face_position.lock().unwrap();
                *face_position = Some((center_x, center_y));
                log_message(format!("Face detected at position: ({:.2}, {:.2})", center_x, center_y), "INFO".to_string(), "CameraController.run".to_string());
            } else {
                let mut face_position = self.face_position.lock().unwrap();
                if face_position.is_some() {
                    *face_position = None;
                    log_message("Face lost".to_string(), "INFO".to_string(), "CameraController.run".to_string());
                }
            }
        }
    }
}

impl Clone for CameraController {
    fn clone(&self) -> Self {
        CameraController {
            camera: ThreadSafeCamera(Arc::clone(&self.camera.0)),
            camera_active: Arc::clone(&self.camera_active),
            face_position: Arc::clone(&self.face_position),
            selected_camera_index: Arc::clone(&self.selected_camera_index),
            detector: ThreadSafeDetector(Arc::clone(&self.detector.0)),
        }
    }
}


struct SendableDetector(Box<dyn Detector>);

impl Detector for SendableDetector {
    fn detect(&mut self, image: &ImageData) -> Vec<FaceInfo> {
        self.0.detect(image)
    }

    fn set_window_size(&mut self, size: u32) {
        self.0.set_window_size(size)
    }

    fn set_slide_window_step(&mut self, step_x: u32, step_y: u32) {
        self.0.set_slide_window_step(step_x, step_y)
    }

    fn set_min_face_size(&mut self, size: u32) {
        self.0.set_min_face_size(size)
    }

    fn set_max_face_size(&mut self, size: u32) {
        self.0.set_max_face_size(size)
    }

    fn set_pyramid_scale_factor(&mut self, factor: f32) {
        self.0.set_pyramid_scale_factor(factor)
    }

    fn set_score_thresh(&mut self, thresh: f64) {
        self.0.set_score_thresh(thresh)
    }
}

unsafe impl Send for SendableDetector {}