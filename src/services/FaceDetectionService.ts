import '@mediapipe/face_detection';
import * as faceDetection from '@mediapipe/face_detection';
import { Camera } from '@mediapipe/camera_utils';
import { logger } from '../utils/logger';

const ModelName = 'FaceDetectionService';

export interface FaceDetectionResult {
  position: { x: number; y: number };
  size: { width: number; height: number };
  confidence: number;
  landmarks?: { x: number; y: number }[];
}

export interface FaceDetectionConfig {
  shakeFilterSize?: number;
  smoothingFactor?: number;
  minConfidence?: number;
  skipFrames?: number;
  scaleFactor?: number;
  minNeighbors?: number;  // 添加缺失的配置项
}

export interface DebugInfo {
  initialized: boolean;
  performance: {
    frameCount: number;
    fps: number;
    lastProcessingTime: number;
  };
  config: Required<FaceDetectionConfig>;
  videoInfo: {
    width: number;
    height: number;
    active: boolean;
  } | null;
}

export class FaceDetectionService {
  private detector: faceDetection.FaceDetection;
  private camera: Camera | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private initialized = false;
  private lastResults: FaceDetectionResult[] = [];
  private positionHistory: { x: number; y: number }[] = [];
  private frameCount = 0;
  private lastProcessingTime = 0;
  private processingStartTime = 0;
  private fpsUpdateTime = 0;
  private currentFps = 0;
  private fpsCounter = 0;
  
  private config: Required<FaceDetectionConfig> = {
    shakeFilterSize: 30,
    smoothingFactor: 0.3,
    minConfidence: 0.7,
    skipFrames: 2,
    scaleFactor: 1.1,
    minNeighbors: 5
  };

  constructor(config?: FaceDetectionConfig) {
    this.config = { ...this.config, ...config };
    
    this.detector = new faceDetection.FaceDetection({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection@0.4/${file}`;
      }
    });

    logger.log('FaceDetectionService instance created', 'INFO', ModelName);
  }

  async initialize(stream: MediaStream): Promise<void> {
    try {
      if (this.initialized) {
        logger.log('Already initialized', 'INFO', ModelName);
        return;
      }

      logger.log('Initializing face detection...', 'INFO', ModelName);

      // 设置检测器配置
      await this.detector.setOptions({
        minDetectionConfidence: this.config.minConfidence
      } as faceDetection.Options);

      // 创建视频元素
      this.videoElement = document.createElement('video');
      this.videoElement.srcObject = stream;
      this.videoElement.setAttribute('playsinline', 'true');

      // 等待视频加载
      await new Promise<void>((resolve) => {
        if (!this.videoElement) return;
        this.videoElement.onloadedmetadata = () => {
          this.videoElement?.play().then(resolve);
        };
      });

      // 设置检测器回调
      this.detector.onResults((results: faceDetection.Results) => {
        this.processingStartTime = performance.now();
        
        if (results.detections && results.detections.length > 0) {
          const detection = results.detections[0];
          // 使用类型断言来处理MediaPipe的类型
          const boundingBox = detection.boundingBox as { xCenter: number; yCenter: number; width: number; height: number };
          const detectionScore = (detection as any).score?.[0] ?? 0.0;
          
          const result: FaceDetectionResult = {
            position: {
              x: boundingBox.xCenter * this.videoElement!.videoWidth,
              y: boundingBox.yCenter * this.videoElement!.videoHeight
            },
            size: {
              width: boundingBox.width * this.videoElement!.videoWidth,
              height: boundingBox.height * this.videoElement!.videoHeight
            },
            confidence: detectionScore,
            landmarks: detection.landmarks?.map(landmark => ({
              x: landmark.x * this.videoElement!.videoWidth,
              y: landmark.y * this.videoElement!.videoHeight
            }))
          };

          const smoothedResult = this.applySmoothing(result);
          this.lastResults = [smoothedResult];
        } else {
          this.lastResults = [];
        }

        this.updatePerformanceMetrics();
      });

      // 设置相机
      this.camera = new Camera(this.videoElement, {
        onFrame: async () => {
          if (this.frameCount++ % this.config.skipFrames === 0) {
            if (this.videoElement) {
              await this.detector.send({ image: this.videoElement });
            }
          }
        },
        width: 1280,
        height: 720
      });

      await this.camera.start();
      
      this.initialized = true;
      logger.log('Face detection initialized successfully', 'INFO', ModelName);
    } catch (error) {
      logger.log(`Initialization failed: ${error}`, 'ERROR', ModelName);
      throw error;
    }
  }

  private updatePerformanceMetrics(): void {
    // 更新处理时间
    this.lastProcessingTime = performance.now() - this.processingStartTime;

    // 更新FPS
    this.fpsCounter++;
    const now = performance.now();
    if (now - this.fpsUpdateTime >= 1000) {
      this.currentFps = Math.round((this.fpsCounter * 1000) / (now - this.fpsUpdateTime));
      this.fpsCounter = 0;
      this.fpsUpdateTime = now;
    }
  }

  private applySmoothing(result: FaceDetectionResult): FaceDetectionResult {
    this.positionHistory.push(result.position);

    if (this.positionHistory.length > this.config.shakeFilterSize) {
      this.positionHistory.shift();
    }

    const smoothedPosition = this.positionHistory.reduce((acc, pos, index) => {
      const weight = Math.pow(this.config.smoothingFactor, this.positionHistory.length - index - 1);
      return {
        x: acc.x + pos.x * weight,
        y: acc.y + pos.y * weight
      };
    }, { x: 0, y: 0 });

    const weightSum = this.positionHistory.reduce((sum, _, index) => {
      return sum + Math.pow(this.config.smoothingFactor, this.positionHistory.length - index - 1);
    }, 0);

    smoothedPosition.x /= weightSum;
    smoothedPosition.y /= weightSum;

    return {
      ...result,
      position: smoothedPosition
    };
  }

  getDebugInfo(): DebugInfo {
    return {
      initialized: this.initialized,
      performance: {
        frameCount: this.frameCount,
        fps: this.currentFps,
        lastProcessingTime: this.lastProcessingTime,
      },
      config: this.config,
      videoInfo: this.videoElement ? {
        width: this.videoElement.videoWidth,
        height: this.videoElement.videoHeight,
        active: !this.videoElement.paused
      } : null
    };
  }

  async detectFace(): Promise<FaceDetectionResult | null> {
    if (!this.initialized) {
      return null;
    }

    return this.lastResults[0] || null;
  }

  dispose(): void {
    if (this.camera) {
      this.camera.stop();
    }
    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }
    this.detector.close();
    this.initialized = false;
    this.lastResults = [];
    this.positionHistory = [];
    this.frameCount = 0;
    logger.log('Face detection service disposed', 'INFO', ModelName);
  }
}