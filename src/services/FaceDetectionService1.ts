import { logger } from '../utils/logger';
import {
  FaceDetectionOptions,
  FaceDetectionResult,
  FacePosition
} from '../types/faceDetection';

const ModelName = 'FaceDetection';

export class FaceDetectionService {
  private cv: any = null;
  private video: HTMLVideoElement | null = null;
  private stream: MediaStream | null = null;
  private faceDetector: any = null;
  private processCanvas: HTMLCanvasElement;
  private processCtx: CanvasRenderingContext2D;
  private frameCount = 0;
  private positionHistory: FacePosition[] = [];
  private initialized = false;
  private initializing = false;
  private lastProcessingTime = 0;
  private fpsCounter = 0;
  private lastFpsUpdate = 0;
  private currentFps = 0;

  private readonly options: Required<FaceDetectionOptions>;

  constructor(options: Partial<FaceDetectionOptions> = {}) {
    // Initialize default options
    this.options = {
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
      maxHistorySize: 0,
      beautyLevel: 0,
      brightnessAdjust: 0,
      ...options
    };

    // Create processing canvas
    this.processCanvas = document.createElement('canvas');
    const ctx = this.processCanvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get canvas context');
    this.processCtx = ctx;

    logger.log('FaceDetectionService instance created', 'INFO', ModelName);
  }

  private async initializeFaceDetector(): Promise<void> {
    try {
      logger.log('Starting face detector initialization', 'INFO', ModelName);
      
      // 创建分类器实例
      this.faceDetector = new this.cv.CascadeClassifier();
      logger.log('CascadeClassifier instance created', 'INFO', ModelName);

      // 加载分类器文件
      const response = await fetch('/haarcascade_frontalface_default.xml');
      if (!response.ok) {
        throw new Error(`Failed to fetch classifier: ${response.status}`);
      }
      
      // 读取文件内容
      const buffer = await response.arrayBuffer();
      logger.log(`Classifier file loaded, size: ${buffer.byteLength} bytes`, 'INFO', ModelName);

      // 将文件内容转换为Uint8Array
      const data = new Uint8Array(buffer);
      
      // 创建内存矩阵
      const dataMatrix = this.cv.matFromArray(data.length, 1, this.cv.CV_8UC1, data);
      logger.log('Created data matrix for classifier', 'INFO', ModelName);

      try {
        // 尝试直接加载数据矩阵
        logger.log('Attempting to load classifier directly', 'INFO', ModelName);
        const success = this.faceDetector.load(dataMatrix);
        
        if (!success) {
          throw new Error('Direct loading of classifier failed');
        }
        
        logger.log('Classifier loaded successfully', 'INFO', ModelName);
      } finally {
        // 清理矩阵
        if (dataMatrix && !dataMatrix.isDeleted()) {
          dataMatrix.delete();
        }
      }

    } catch (error) {
      logger.log(`Failed to initialize face detector: ${error}`, 'ERROR', ModelName);
      if (error instanceof Error) {
        logger.log(`Error details: ${error.stack}`, 'ERROR', ModelName);
      }
      throw error;
    }
  }

  async detectFace(): Promise<FaceDetectionResult | null> {
    if (!this.initialized || !this.video || !this.cv || !this.faceDetector) {
      const reason = !this.initialized ? 'not initialized' :
                    !this.video ? 'no video' :
                    !this.cv ? 'no OpenCV' :
                    'no face detector';
      logger.log(`Face detection skipped - ${reason}`, 'INFO', ModelName);
      return null;
    }

    try {
      const startTime = performance.now();

      if (this.frameCount++ % this.options.skipFrames !== 0) {
        return null;
      }

      if (this.video.readyState !== this.video.HAVE_ENOUGH_DATA) {
        return null;
      }

      // 更新FPS
      this.updateFps();

      // 将视频帧绘制到canvas
      this.processCtx.drawImage(this.video, 0, 0);
      const imageData = this.processCtx.getImageData(
        0, 0,
        this.processCanvas.width,
        this.processCanvas.height
      );

      // 创建OpenCV矩阵
      const mat = this.cv.matFromImageData(imageData);
      const gray = new this.cv.Mat();
      
      // 转换为灰度图
      this.cv.cvtColor(mat, gray, this.cv.COLOR_RGBA2GRAY);

      // 执行人脸检测
      const faces = new this.cv.RectVector();
      
      try {
        logger.log('Running face detection', 'INFO', ModelName);
        this.faceDetector.detectMultiScale(
          gray,
          faces,
          this.options.scaleFactor,
          this.options.minNeighbors,
          0,
          new this.cv.Size(this.options.minSize, this.options.minSize),
          new this.cv.Size(this.options.maxSize, this.options.maxSize)
        );
        
        logger.log(`Detected ${faces.size()} faces`, 'INFO', ModelName);
      } catch (error) {
        logger.log(`Error in face detection: ${error}`, 'ERROR', ModelName);
        mat.delete();
        gray.delete();
        faces.delete();
        return null;
      }

      // 清理资源
      mat.delete();
      gray.delete();

      if (faces.size() > 0) {
        const face = faces.get(0);
        const position = this.smoothPosition({
          x: face.x + face.width / 2,
          y: face.y + face.height / 2
        });

        const result = {
          position,
          size: {
            width: face.width,
            height: face.height
          },
          confidence: this.calculateConfidence(face),
          processingTime: performance.now() - startTime
        };

        faces.delete();
        return result;
      }

      faces.delete();
      return null;
    } catch (error) {
      logger.log(`Error in face detection: ${error}`, 'ERROR', ModelName);
      return null;
    }
  }

  async initialize(stream: MediaStream): Promise<void> {
    if (this.initialized) return;
    if (this.initializing) {
      logger.log('Already initializing, waiting...', 'INFO', ModelName);
      return;
    }

    try {
      this.initializing = true;
      logger.log('Starting initialization...', 'INFO', ModelName);

      // 1. Load OpenCV
      await this.loadOpenCV();
      logger.log('OpenCV loaded successfully', 'INFO', ModelName);

      // 2. Initialize video stream first
      await this.initializeVideoStream(stream);
      logger.log('Video stream initialized successfully', 'INFO', ModelName);

      // 3. Initialize face detector
      await this.initializeFaceDetector();
      logger.log('Face detector initialized successfully', 'INFO', ModelName);

      this.initialized = true;
      logger.log('Initialization completed successfully', 'INFO', ModelName);
    } catch (error) {
      logger.log(`Initialization failed: ${error}`, 'ERROR', ModelName);
      // 清理资源
      this.dispose();
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
        const checkCV = () => {
          if ((window as any).cv?.getBuildInformation) {
            this.cv = (window as any).cv;
            logger.log('OpenCV loaded successfully', 'INFO', ModelName);
            resolve();
          } else {
            setTimeout(checkCV, 100);
          }
        };
        checkCV();
      };

      script.onerror = (error) => {
        logger.log(`Failed to load OpenCV script: ${error}`, 'ERROR', ModelName);
        reject(new Error('Failed to load OpenCV script'));
      };

      document.body.appendChild(script);
    });
  }

  private async initializeVideoStream(stream: MediaStream): Promise<void> {
    try {
      logger.log('Starting video stream initialization', 'INFO', ModelName);

      this.stream = stream;
      this.video = document.createElement('video');
      this.video.srcObject = stream;
      this.video.setAttribute('playsinline', 'true');
      this.video.setAttribute('autoplay', '');

      // 获取视频流信息
      const videoTrack = stream.getVideoTracks()[0];
      const settings = videoTrack.getSettings();
      logger.log(`Video settings: ${JSON.stringify(settings)}`, 'INFO', ModelName);

      return new Promise<void>((resolve, reject) => {
        if (!this.video) return reject(new Error('Video element not created'));

        const timeoutId = setTimeout(() => {
          reject(new Error('Video initialization timeout'));
        }, 10000);

        this.video.onloadedmetadata = () => {
          if (!this.video) return;

          this.video.play()
            .then(() => {
              if (this.video) {
                // Update canvas size
                this.processCanvas.width = this.video.videoWidth;
                this.processCanvas.height = this.video.videoHeight;
                logger.log(`Canvas size set to ${this.processCanvas.width}x${this.processCanvas.height}`, 'INFO', ModelName);

                clearTimeout(timeoutId);
                resolve();
              }
            })
            .catch(error => {
              clearTimeout(timeoutId);
              reject(error);
            });
        };

        this.video.onerror = (event) => {
          clearTimeout(timeoutId);
          reject(new Error(`Video error: ${event}`));
        };
      });
    } catch (error) {
      logger.log(`Video stream initialization failed: ${error}`, 'ERROR', ModelName);
      throw error;
    }
  }

  dispose(): void {
    try {
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

      logger.log('Resources disposed successfully', 'INFO', ModelName);
    } catch (error) {
      logger.log(`Error during dispose: ${error}`, 'ERROR', ModelName);
    }
  }

  getDebugInfo(): {
    initialized: boolean;
    hasOpenCV: boolean;
    hasFaceDetector: boolean;
    videoState: {
      readyState: number;
      videoWidth: number;
      videoHeight: number;
    } | null;
    performance: {
      fps: number;
      processingTime: number;
      frameCount: number;
      historySize: number;
    };
    options: Required<FaceDetectionOptions>;
  } {
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
        historySize: this.positionHistory.length,
      },
      options: this.options,
    };
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

  private smoothPosition(position: FacePosition): FacePosition {
    this.positionHistory.push(position);

    if (this.positionHistory.length > this.options.shakeFilterSize) {
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
    const idealAspectRatio = 1.0;
    const aspectRatioScore = 1 - Math.min(Math.abs(aspectRatio - idealAspectRatio), 1);

    const centerX = face.x + face.width / 2;
    const centerY = face.y + face.height / 2;
    const positionScore = Math.min(
      1,
      Math.min(centerX, this.processCanvas.width - centerX) / (this.processCanvas.width / 4) *
      Math.min(centerY, this.processCanvas.height - centerY) / (this.processCanvas.height / 4)
    );

    return Math.max(0, Math.min(1, (aspectRatioScore * 0.4 + positionScore * 0.6)));
  }


}