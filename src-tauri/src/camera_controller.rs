use nokhwa::{Camera, utils::{CameraInfo, ApiBackend}};
use std::sync::{Arc};
use crate::commands::log_message;
use parking_lot::Mutex as PLMutex;

pub struct CameraController {
    camera: Arc<PLMutex<Option<Camera>>>,
    selected_camera_index: Arc<PLMutex<Option<usize>>>,
}

// 实现 Send 和 Sync
unsafe impl Send for CameraController {}
unsafe impl Sync for CameraController {}

impl CameraController {
    pub fn new() -> Self {
        log_message("Creating new CameraController instance".to_string(), "INFO".to_string(), "CameraController".to_string());
        
        CameraController {
            camera: Arc::new(PLMutex::new(None)),
            selected_camera_index: Arc::new(PLMutex::new(None)),
        }
    }

    pub fn get_available_cameras() -> Vec<CameraInfo> {
        log_message("Querying available cameras...".to_string(), "INFO".to_string(), "get_available_cameras".to_string());
        
        let backends = vec![ApiBackend::AVFoundation, ApiBackend::Auto];
        for backend in backends {
            if let Ok(cameras) = nokhwa::query(backend) {
                return cameras;
            }
        }
        Vec::new()
    }
}