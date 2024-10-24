// src/services/FaceDetectionService.ts

import { logger } from '../utils/logger';
import {
  FaceDetectionOptions,
  FaceDetectionResult,
  FacePosition,
  FaceDetectionError,
  VideoSize,
  FaceSize
} from '../types/faceDetection';

const ModelName = 'FaceDetection';

// OpenCV 全局实例追踪
let isOpenCVInitialized = false;
let pendingInitialization: Promise<void> | null = null;

export class FaceDetectionService {
  private cv: any;
  private video: HTMLVideoElement | null = null;
  private stream: MediaStream | null = null;
  private faceDetector: any;
  private initialized = false;
  private processCanvas: HTMLCanvasElement;
  private processCtx: CanvasRenderingContext2D;
  private frameCount = 0;
  private positionHistory: FacePosition[] = [];
  private processingTimeHistory: number[] = [];

  private readonly defaultOptions: Required<FaceDetectionOptions> = {
    // 检测参数
    scaleFactor: 1.1,
    minNeighbors: 5,
    minSize: 30,
    maxSize: 0,
    minConfidence: 0.7,

    // 性能参数
    pyramidScale: 0.5,
    useImagePyramid: true,
    skipFrames: 2,

    // 防抖参数
    shakeFilterSize: 30,
    smoothingFactor: 0.3,
    maxHistorySize: 30,

    // 美颜参数
    beautyLevel: 0.5,
    brightnessAdjust: 1.1
  };

  private options: Required<FaceDetectionOptions>;

  constructor(options: Partial<FaceDetectionOptions> = {}) {
    this.options = { ...this.defaultOptions, ...options };

    // 创建处理用canvas
    this.processCanvas = document.createElement('canvas');
    const ctx = this.processCanvas.getContext('2d');
    if (!ctx) {
      throw new FaceDetectionError('Failed to get canvas context', 'CANVAS_ERROR');
    }
    this.processCtx = ctx;

    logger.log('FaceDetectionService instance created', 'INFO', ModelName);
  }

  // 修改 initialize 方法以接受 MediaStream
  async initialize(stream?: MediaStream): Promise<void> {
    if (this.initialized) return;

    try {
      // 加载 OpenCV
      if (!isOpenCVInitialized) {
        if (!pendingInitialization) {
          pendingInitialization = this.loadOpenCV();
        }
        await pendingInitialization;
        isOpenCVInitialized = true;
      }

      // 初始化人脸检测器
      if (!this.faceDetector) {
        this.faceDetector = new this.cv.CascadeClassifier();
        await this.loadFaceDetector();
      }

      // 如果提供了流，直接使用它初始化视频
      if (stream) {
        await this.initializeVideoStream(stream);
      }

      this.initialized = true;
      logger.log('FaceDetectionService initialized successfully', 'INFO', ModelName);
    } catch (error) {
      const message = `Initialization failed: ${error instanceof Error ? error.message : String(error)}`;
      logger.log(message, 'ERROR', ModelName);
      throw new FaceDetectionError(message, 'INIT_ERROR');
    }
  }

  // 新增方法：处理视频流初始化
  private async initializeVideoStream(stream: MediaStream): Promise<void> {
    try {
      // 停止现有的流（如果有）
      if (this.stream) {
        this.stream.getTracks().forEach(track => track.stop());
      }

      this.stream = stream;
      this.video = document.createElement('video');
      this.video.srcObject = stream;
      this.video.setAttribute('playsinline', 'true');

      await new Promise<void>((resolve, reject) => {
        if (!this.video) return reject(new Error('Video element not created'));

        this.video.onloadedmetadata = () => {
          this.video?.play()
            .then(() => {
              if (this.video) {
                this.processCanvas.width = this.video.videoWidth;
                this.processCanvas.height = this.video.videoHeight;
              }
              resolve();
            })
            .catch(reject);
        };

        this.video.onerror = (event) => {
          reject(new Error(`Video error: ${event}`));
        };
      });

      logger.log('Video stream initialized successfully', 'INFO', ModelName);
    } catch (error) {
      throw new FaceDetectionError(`Failed to initialize video stream: ${error}`, 'STREAM_ERROR');
    }
  }

  // 现有的方法保持不变，但startCamera方法需要修改
  async startCamera(deviceId?: string): Promise<void> {
    if (!this.initialized) {
      throw new FaceDetectionError('Service not initialized', 'NOT_INITIALIZED');
    }

    try {
      const constraints = {
        video: deviceId ? { deviceId: { exact: deviceId } } : true
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      await this.initializeVideoStream(stream);
      
      logger.log('Camera started successfully', 'INFO', ModelName);
    } catch (error) {
      throw new FaceDetectionError(`Failed to start camera: ${error}`, 'CAMERA_ERROR');
    }
  }

  
  

  private async loadOpenCV(): Promise<void> {
    return new Promise((resolve, reject) => {
      // 检查是否已经加载
      if ((window as any).cv?.getBuildInformation) {
        this.cv = (window as any).cv;
        resolve();
        return;
      }

      // 防止重复加载脚本
      const existingScript = document.querySelector('script[src="/opencv.js"]');
      if (existingScript) {
        logger.log('OpenCV script already exists, waiting for load', 'INFO', ModelName);
        const checkInterval = setInterval(() => {
          if ((window as any).cv?.getBuildInformation) {
            clearInterval(checkInterval);
            this.cv = (window as any).cv;
            resolve();
          }
        }, 100);
        return;
      }

      const script = document.createElement('script');
      script.setAttribute('async', '');
      script.setAttribute('type', 'text/javascript');
      script.setAttribute('src', '/opencv.js');

      const handleLoad = async () => {
        try {
          if ((window as any).cv?.getBuildInformation) {
            this.cv = (window as any).cv;
            resolve();
          } else if ((window as any).cv instanceof Promise) {
            this.cv = await (window as any).cv;
            resolve();
          } else {
            (window as any).cv.onRuntimeInitialized = () => {
              this.cv = (window as any).cv;
              resolve();
            };
          }
        } catch (error) {
          reject(new FaceDetectionError(
            `Failed to load OpenCV WASM: ${error}`,
            'OPENCV_LOAD_ERROR'
          ));
        }
      };

      script.addEventListener('load', handleLoad);
      script.addEventListener('error', () => {
        reject(new FaceDetectionError(
          'Failed to load OpenCV script',
          'OPENCV_LOAD_ERROR'
        ));
      });

      document.body.appendChild(script);
    });
  }

  private async loadFaceDetector(): Promise<void> {
    try {
      const response = await fetch('/haarcascade_frontalface_default.xml');
      const xmlText = await response.text();

      const blob = new Blob([xmlText], { type: 'text/xml' });
      const url = URL.createObjectURL(blob);

      const result = this.faceDetector.load(url);
      URL.revokeObjectURL(url);

      if (!result) {
        throw new FaceDetectionError(
          'Failed to load face detector classifier',
          'CLASSIFIER_LOAD_ERROR'
        );
      }

      logger.log('Face detector loaded successfully', 'INFO', ModelName);
    } catch (error) {
      throw new FaceDetectionError(
        `Failed to load face detector: ${error}`,
        'CLASSIFIER_LOAD_ERROR'
      );
    }
  }

  

  stopCamera(): void {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    if (this.video) {
      this.video.srcObject = null;
      this.video = null;
    }
    this.positionHistory = [];
    this.frameCount = 0;
    logger.log('Camera stopped', 'INFO', ModelName);
  }

  async detectFace(): Promise<FaceDetectionResult | null> {
    if (!this.initialized || !this.video) return null;

    try {
      if (this.frameCount++ % this.options.skipFrames !== 0) return null;

      const startTime = performance.now();
      this.processCtx.drawImage(this.video, 0, 0);

      const imageData = this.processCtx.getImageData(
        0, 0,
        this.processCanvas.width,
        this.processCanvas.height
      );

      const result = await this.processImage(imageData, startTime);

      if (result) {
        this.updateProcessingStats(startTime);
      }

      return result;
    } catch (error) {
      logger.log(`Error in face detection: ${error}`, 'ERROR', ModelName);
      return null;
    }
  }

  private async processImage(imageData: ImageData, startTime: number): Promise<FaceDetectionResult | null> {
    const src = this.cv.matFromImageData(imageData);
    let processingSrc = src;

    try {
      // 图像预处理
      processingSrc = await this.preprocessImage(processingSrc);

      // 人脸检测
      const faces = new this.cv.RectVector();
      const gray = new this.cv.Mat();
      this.cv.cvtColor(processingSrc, gray, this.cv.COLOR_RGBA2GRAY);

      this.faceDetector.detectMultiScale(
        gray,
        faces,
        this.options.scaleFactor,
        this.options.minNeighbors,
        0,
        new this.cv.Size(this.options.minSize, this.options.minSize),
        this.options.maxSize ? new this.cv.Size(this.options.maxSize, this.options.maxSize) : new this.cv.Size()
      );

      if (faces.size() > 0) {
        const face = faces.get(0);
        const result = this.processFaceDetection(face, performance.now() - startTime);
        return result;
      }

      return null;
    } finally {
      // 清理资源
      src.delete();
      if (processingSrc !== src) {
        processingSrc.delete();
      }
    }
  }

  private async preprocessImage(src: any): Promise<any> {
    let result = src;

    // 图像金字塔处理
    if (this.options.useImagePyramid) {
      const scaled = new this.cv.Mat();
      const size = new this.cv.Size(
        src.cols * this.options.pyramidScale,
        src.rows * this.options.pyramidScale
      );
      this.cv.pyrDown(src, scaled, size);
      result = scaled;
    }

    // 美颜处理
    if (this.options.beautyLevel > 0) {
      const beauty = new this.cv.Mat();
      this.cv.bilateralFilter(result, beauty, 9, 75, 75);
      if (result !== src) {
        result.delete();
      }
      result = beauty;
    }

    return result;
  }

  private processFaceDetection(face: any, processingTime: number): FaceDetectionResult {
    const scale = this.options.useImagePyramid ? 1 / this.options.pyramidScale : 1;

    const position = {
      x: (face.x + face.width / 2) * scale,
      y: (face.y + face.height / 2) * scale
    };

    const size: FaceSize = {
      width: face.width * scale,
      height: face.height * scale
    };

    return {
      position: this.smoothPosition(position),
      size,
      confidence: this.calculateConfidence(face),
      processingTime,
      angle: this.calculateAngle(position)
    };
  }

  private smoothPosition(position: FacePosition): FacePosition {
    this.positionHistory.push(position);

    if (this.positionHistory.length > this.options.maxHistorySize) {
      this.positionHistory.shift();
    }

    const weights = this.positionHistory.map((_, index, arr) =>
      Math.pow(this.options.smoothingFactor, arr.length - index - 1)
    );
    const weightSum = weights.reduce((a, b) => a + b, 0);

    return {
      x: this.positionHistory.reduce((acc, pos, i) => acc + pos.x * weights[i], 0) / weightSum,
      y: this.positionHistory.reduce((acc, pos, i) => acc + pos.y * weights[i], 0) / weightSum
    };
  }

  private calculateConfidence(face: any): number {
    const aspectRatio = face.width / face.height;
    const aspectRatioScore = 1 - Math.min(Math.abs(aspectRatio - 1.0), 1);

    const centerX = face.x + face.width / 2;
    const centerY = face.y + face.height / 2;
    const positionScore = Math.min(
      1,
      Math.min(centerX, this.processCanvas.width - centerX) / (this.processCanvas.width / 4) *
      Math.min(centerY, this.processCanvas.height - centerY) / (this.processCanvas.height / 4)
    );

    return Math.max(0, Math.min(1, aspectRatioScore * 0.3 + positionScore * 0.7));
  }

  private calculateAngle(position: FacePosition): number | undefined {
    if (this.positionHistory.length < 2) return undefined;

    const prevPosition = this.positionHistory[this.positionHistory.length - 2];
    const deltaX = position.x - prevPosition.x;
    const deltaY = position.y - prevPosition.y;

    return Math.atan2(deltaY, deltaX) * (180 / Math.PI);
  }

  private updateProcessingStats(startTime: number): void {
    const processingTime = performance.now() - startTime;
    this.processingTimeHistory.push(processingTime);

    if (this.processingTimeHistory.length > 30) {
      this.processingTimeHistory.shift();
    }
  }

  getVideoSize(): VideoSize | null {
    if (!this.video) return null;
    return {
      width: this.video.videoWidth,
      height: this.video.videoHeight
    };
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  // 添加获取当前视频元素的方法
  getVideoElement(): HTMLVideoElement | null {
    return this.video;
  }

  // 添加视频流就绪状态检查
  isStreamReady(): boolean {
    return !!(this.initialized && this.video && this.video.readyState === 4);
  }

  dispose(): void {
    this.stopCamera();
    if (this.faceDetector) {
      this.faceDetector.delete();
    }
    this.initialized = false;
    this.positionHistory = [];
    this.processingTimeHistory = [];
    logger.log('FaceDetectionService disposed', 'INFO', ModelName);
  }
}