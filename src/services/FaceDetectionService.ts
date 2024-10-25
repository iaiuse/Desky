import { logger } from '../utils/logger';
import { FaceDetectionUtils } from './FaceDetectionUtils';
import { FaceDetectionResult } from '../types/faceDetection';

const ModelName = 'FaceDetectionService';

export interface FaceDetectionConfig {
  scaleFactor?: number;
  minNeighbors?: number;
  minSize?: number;
  maxSize?: number;
  minConfidence?: number;
  skipFrames?: number;
  shakeFilterSize?: number;
  smoothingFactor?: number;
  pyramidScale?: number;
  useImagePyramid?: boolean;
  beautyLevel?: number;
  brightnessAdjust?: number;
}

export class FaceDetectionService {
  private cv: any = null;
  private video: HTMLVideoElement | null = null;
  private stream: MediaStream | null = null;
  private faceDetector: any = null;
  private initialized = false;
  private initializing = false;
  private frameCount = 0;
  private lastProcessingTime = 0;
  private currentFps = 0;
  private fpsCounter = 0;
  private lastFpsUpdate = 0;

  private readonly config: Required<FaceDetectionConfig> = {
    scaleFactor: 1.1,
    minNeighbors: 5,
    minSize: 30,
    maxSize: 0,
    minConfidence: 0.7,
    skipFrames: 2,
    shakeFilterSize: 30,
    smoothingFactor: 0.3,
    pyramidScale: 0,
    useImagePyramid: false,
    beautyLevel: 0,
    brightnessAdjust: 0
  };

  constructor(config: Partial<FaceDetectionConfig> = {}) {
    this.config = { ...this.config, ...config };
    logger.log('FaceDetectionService instance created with config:', 'INFO', ModelName);
    logger.log(JSON.stringify(this.config), 'INFO', ModelName);
  }

  async initialize(stream: MediaStream): Promise<void> {
    if (this.initialized) return;
    if (this.initializing) {
      logger.log('Already initializing, waiting...', 'INFO', ModelName);
      return;
    }

    try {
      this.initializing = true;
      await this.loadOpenCV();
      await this.initializeVideoStream(stream);
      await this.loadFaceDetector();
      this.initialized = true;
      logger.log('Face detection service fully initialized', 'INFO', ModelName);
    } catch (error) {
      logger.log(`Initialization failed: ${error}`, 'ERROR', ModelName);
      throw error;
    } finally {
      this.initializing = false;
    }
  }

  private async loadOpenCV(): Promise<void> {
    return new Promise((resolve, reject) => {
      if ((window as any).cv?.getBuildInformation) {
        this.cv = (window as any).cv;
        logger.log('OpenCV already loaded', 'INFO', ModelName);
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.setAttribute('async', '');
      script.setAttribute('type', 'text/javascript');
      script.setAttribute('src', '/opencv.js');

      script.onload = () => {
        if ((window as any).cv?.getBuildInformation) {
          this.cv = (window as any).cv;
          resolve();
        } else {
          (window as any).cv.onRuntimeInitialized = () => {
            this.cv = (window as any).cv;
            resolve();
          };
        }
      };

      script.onerror = () => reject(new Error('Failed to load OpenCV'));
      document.body.appendChild(script);
    });
  }

  private async loadFaceDetector(): Promise<void> {
    try {
      const response = await fetch('/haarcascade_frontalface_default.xml');
      if (!response.ok) throw new Error('Failed to fetch classifier file');

      const xmlContent = await response.text();
      const blob = new Blob([xmlContent], { type: 'text/xml' });
      const url = URL.createObjectURL(blob);

      this.faceDetector = new this.cv.CascadeClassifier();
      const result = this.faceDetector.load(url);
      URL.revokeObjectURL(url);

      if (!result) throw new Error('Failed to load classifier');
      logger.log('Face detector loaded successfully', 'INFO', ModelName);
    } catch (error) {
      throw new Error(`Failed to load face detector: ${error}`);
    }
  }

  private async initializeVideoStream(stream: MediaStream): Promise<void> {
    this.stream = stream;
    this.video = document.createElement('video');
    this.video.srcObject = stream;
    this.video.setAttribute('playsinline', 'true');

    await new Promise<void>((resolve, reject) => {
      if (!this.video) return reject(new Error('Video element not created'));

      this.video.onloadedmetadata = () => {
        this.video?.play()
          .then(resolve)
          .catch(reject);
      };

      this.video.onerror = () => reject(new Error('Video error'));
    });
  }

  dispose(): void {
    FaceDetectionUtils.clearShakeFilter();
    
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    if (this.video) {
      this.video.srcObject = null;
      this.video = null;
    }

    if (this.faceDetector) {
      this.faceDetector.delete();
      this.faceDetector = null;
    }

    this.initialized = false;
    this.initializing = false;
    this.cv = null;

    logger.log('Face detection service disposed', 'INFO', ModelName);
  }
  getDebugInfo(): any {
    return {
      initialized: this.initialized,
      hasOpenCV: !!this.cv,
      hasFaceDetector: !!this.faceDetector,
      videoState: this.video ? {
        readyState: this.video.readyState,
        videoWidth: this.video.videoWidth,
        videoHeight: this.video.videoHeight,
      } : null,
      performance: {
        fps: this.currentFps,
        processingTime: this.lastProcessingTime,
        frameCount: this.frameCount,
      },
      config: this.config,
    };
  }

  async detectFace(): Promise<FaceDetectionResult | null> {
    if (!this.initialized || !this.video || !this.cv || !this.faceDetector) {
      return null;
    }

    try {
      const startTime = performance.now();
      
      // 跳帧处理
      if (this.frameCount++ % this.config.skipFrames !== 0) {
        return null;
      }

      // 更新FPS计数
      this.updateFps();

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      canvas.width = this.video.videoWidth;
      canvas.height = this.video.videoHeight;

      // 绘制视频帧
      ctx.drawImage(this.video, 0, 0);
      let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      // 转换为OpenCV格式
      const src = this.cv.matFromImageData(imageData);
      const gray = new this.cv.Mat();
      this.cv.cvtColor(src, gray, this.cv.COLOR_RGBA2GRAY);

      // 人脸检测
      const faces = new this.cv.RectVector();
      this.faceDetector.detectMultiScale(
        gray,
        faces,
        this.config.scaleFactor,
        this.config.minNeighbors,
        0,
        new this.cv.Size(this.config.minSize, this.config.minSize),
        this.config.maxSize ? new this.cv.Size(this.config.maxSize, this.config.maxSize) : new this.cv.Size()
      );

      src.delete();
      gray.delete();

      if (faces.size() > 0) {
        const face = faces.get(0);
        const rawPosition = {
          x: face.x + face.width / 2,
          y: face.y + face.height / 2
        };
        const rawSize = {
          width: face.width,
          height: face.height
        };

        // 应用防抖
        const filtered = FaceDetectionUtils.applyShakeFilter(
          rawPosition, 
          rawSize,
          this.config.shakeFilterSize
        );
        
        // 添加填充
        const padded = FaceDetectionUtils.addPadding(
          filtered.position,
          filtered.size,
          canvas.width,
          canvas.height
        );

        faces.delete();

        this.lastProcessingTime = performance.now() - startTime;

        return {
          position: padded.position,
          size: padded.size,
          confidence: this.calculateConfidence(face),
          processingTime: this.lastProcessingTime
        };
      }

      faces.delete();
      return null;
    } catch (error) {
      logger.log(`Error in face detection: ${error}`, 'ERROR', ModelName);
      return null;
    }
  }

  private calculateConfidence(face: any): number {
    const aspectRatio = face.width / face.height;
    const idealAspectRatio = 1.0;
    const aspectRatioScore = 1 - Math.min(Math.abs(aspectRatio - idealAspectRatio), 1);

    return Math.max(0, Math.min(1, aspectRatioScore));
  }

  private updateFps(): void {
    this.fpsCounter++;
    const now = performance.now();
    if (now - this.lastFpsUpdate >= 1000) {
      this.currentFps = Math.round((this.fpsCounter * 1000) / (now - this.lastFpsUpdate));
      this.fpsCounter = 0;
      this.lastFpsUpdate = now;
    }
  }
}