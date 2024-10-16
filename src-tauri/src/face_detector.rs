use rustface::{Detector, ImageData, Rectangle};
use std::fs::File;
use std::io::BufReader;
use image::GenericImageView;

pub struct FaceDetector {
    detector: Detector,
}

impl FaceDetector {
    pub fn new(model_path: &str) -> Result<Self, Box<dyn std::error::Error>> {
        let file = File::open(model_path)?;
        let mut reader = BufReader::new(file);
        let detector = rustface::create_detector(&mut reader)?;
        Ok(FaceDetector { detector })
    }

    pub fn detect_faces(&mut self, image_path: &str) -> Result<Vec<Rectangle>, Box<dyn std::error::Error>> {
        // 加载图像
        let img = image::open(image_path)?;
        let gray = img.to_luma8();
        let (width, height) = gray.dimensions();

        // 准备图像数据
        let mut image_data = ImageData::new(&gray, width, height);

        // 进行人脸检测
        let faces = self.detector.detect(&mut image_data);

        Ok(faces)
    }
}