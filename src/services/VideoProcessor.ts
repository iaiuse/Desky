import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-webgl';
import * as faceLandmarksDetection from '@tensorflow-models/face-landmarks-detection';
import { logger } from '../utils/logger';

const ModelName = 'VideoProcessor';

export interface FaceDetectionResult {
  position: { x: number; y: number };
  size: { width: number; height: number };
  confidence: number;
  landmarks?: { x: number; y: number }[];
}

interface FaceDetectionConfig {
  shakeFilterSize?: number;
  smoothingFactor?: number;
  minConfidence?: number;
  skipFrames?: number;
}

export class VideoProcessor {
  private model: faceLandmarksDetection.FaceLandmarksDetector | null = null;
  private initialized = false;
  private positionHistory: { x: number; y: number }[] = [];
  private frameCount = 0;
  private lastProcessingTime = 0;
  private fpsUpdateTime = 0;
  private currentFps = 0;
  private fpsCounter = 0;

  private config = {
    shakeFilterSize: 30,
    smoothingFactor: 0.3,
    minConfidence: 0.7,
    skipFrames: 2
  };

  constructor(config?: FaceDetectionConfig) {
    this.config = { ...this.config, ...config };
    logger.log('VideoProcessor instance created', 'INFO', ModelName);
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      logger.log('Initializing TensorFlow.js and face detection model...', 'INFO', ModelName);
      
      // 确保 WebGL 后端可用
      await tf.setBackend('webgl');
      await tf.ready();
      logger.log('TensorFlow.js backend initialized', 'INFO', ModelName);

      // 加载面部检测模型
      this.model = await faceLandmarksDetection.createDetector(
        faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh,
        {
          runtime: 'tfjs',
          refineLandmarks: true,
          maxFaces: 1
        }
      );

      this.initialized = true;
      logger.log('Face detection model loaded successfully', 'INFO', ModelName);
    } catch (error) {
      logger.log(`Initialization failed: ${error}`, 'ERROR', ModelName);
      throw new Error(`Failed to initialize video processor: ${error}`);
    }
  }

  async detectFace(video: HTMLVideoElement): Promise<FaceDetectionResult | null> {
    if (!this.initialized || !this.model || !video) return null;

    try {
      // 跳帧处理
      if (this.frameCount++ % this.config.skipFrames !== 0) return null;

      const startTime = performance.now();
      
      // 执行检测
      const faces = await this.model.estimateFaces(video);
      
      if (faces && faces.length > 0) {
        const face = faces[0];
        const box = face.box;
        
        // 计算面部中心点
        const centerX = box.xMin + (box.width / 2);
        const centerY = box.yMin + (box.height / 2);
        
        // 创建检测结果
        const result: FaceDetectionResult = {
          position: {
            x: centerX,
            y: centerY
          },
          size: {
            width: box.width,
            height: box.height
          },
          confidence: 1.0, //face.confidence || 1.0,
          landmarks: face.keypoints?.map(point => ({
            x: point.x,
            y: point.y
          }))
        };

        // 应用平滑处理
        const smoothedResult = this.applySmoothing(result);
        
        // 更新性能指标
        this.updatePerformanceMetrics(performance.now() - startTime);
        
        return smoothedResult;
      }

      return null;
    } catch (error) {
      logger.log(`Error detecting face: ${error}`, 'ERROR', ModelName);
      return null;
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

  private updatePerformanceMetrics(processingTime: number): void {
    this.lastProcessingTime = processingTime;
    this.fpsCounter++;

    const now = performance.now();
    if (now - this.fpsUpdateTime >= 1000) {
      this.currentFps = Math.round((this.fpsCounter * 1000) / (now - this.fpsUpdateTime));
      this.fpsCounter = 0;
      this.fpsUpdateTime = now;
    }
  }

  getPerformanceInfo() {
    return {
      fps: this.currentFps,
      lastProcessingTime: this.lastProcessingTime,
      frameCount: this.frameCount
    };
  }

  dispose(): void {
    if (this.model) {
      this.model.dispose();
      this.model = null;
    }
    this.initialized = false;
    this.positionHistory = [];
    this.frameCount = 0;
    logger.log('Video processor disposed', 'INFO', ModelName);
  }
}