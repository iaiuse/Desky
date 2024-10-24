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

  private readonly options: Required<FaceDetectionOptions> = {
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
    brightnessAdjust: 0
  };

  constructor(options: Partial<FaceDetectionOptions> = {}) {
    this.options = { ...this.options, ...options };
    this.processCanvas = document.createElement('canvas');
    const ctx = this.processCanvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get canvas context');
    this.processCtx = ctx;
    
    logger.log('FaceDetectionService instance created', 'INFO', ModelName);
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

      // 1. 加载OpenCV
      logger.log('Loading OpenCV...', 'INFO', ModelName);
      await this.loadOpenCV();
      logger.log('OpenCV loaded successfully', 'INFO', ModelName);
      logger.log(`OpenCV Version: ${(window as any).cv.getBuildInformation()}`, 'INFO', ModelName);

      // 2. 初始化人脸检测器
      logger.log('Initializing face detector...', 'INFO', ModelName);
      this.faceDetector = new this.cv.CascadeClassifier();
      await this.loadFaceDetector();
      logger.log('Face detector initialized successfully', 'INFO', ModelName);

      // 3. 设置视频流
      logger.log('Setting up video stream...', 'INFO', ModelName);
      await this.initializeVideoStream(stream);
      logger.log('Video stream initialized successfully', 'INFO', ModelName);

      this.initialized = true;
      this.logSystemInfo();
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
        logger.log('OpenCV script loaded, waiting for initialization...', 'INFO', ModelName);
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

      script.onerror = () => {
        const error = 'Failed to load OpenCV script';
        logger.log(error, 'ERROR', ModelName);
        reject(new Error(error));
      };

      document.body.appendChild(script);
    });
  }

  private async loadFaceDetector(): Promise<void> {
    try {
      logger.log('Fetching face detector classifier...', 'INFO', ModelName);
      const response = await fetch('/haarcascade_frontalface_default.xml');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const xmlContent = await response.text();
      logger.log('Classifier file loaded, size: ' + xmlContent.length + ' bytes', 'INFO', ModelName);

      const blob = new Blob([xmlContent], { type: 'text/xml' });
      const url = URL.createObjectURL(blob);

      const result = this.faceDetector.load(url);
      URL.revokeObjectURL(url);

      if (!result) {
        throw new Error('Failed to initialize classifier');
      }

      logger.log('Face detector classifier loaded successfully', 'INFO', ModelName);
    } catch (error) {
      logger.log(`Failed to load face detector: ${error}`, 'ERROR', ModelName);
      throw error;
    }
  }

  async detectFace(): Promise<FaceDetectionResult | null> {
    if (!this.initialized || !this.video || !this.cv) return null;

    try {
      const startTime = performance.now();
      
      if (this.frameCount++ % this.options.skipFrames !== 0) return null;
      if (this.video.readyState !== this.video.HAVE_ENOUGH_DATA) return null;

      // 更新FPS计数
      this.updateFps();

      // 将视频帧绘制到canvas
      this.processCtx.drawImage(this.video, 0, 0);

      // 转换为OpenCV格式
      const imageData = this.processCtx.getImageData(
        0, 0,
        this.processCanvas.width,
        this.processCanvas.height
      );
      const mat = this.cv.matFromImageData(imageData);
      const gray = new this.cv.Mat();
      this.cv.cvtColor(mat, gray, this.cv.COLOR_RGBA2GRAY);

      // 人脸检测
      const faces = new this.cv.RectVector();
      this.faceDetector.detectMultiScale(
        gray,
        faces,
        this.options.scaleFactor,
        this.options.minNeighbors,
        0,
        new this.cv.Size(this.options.minSize, this.options.minSize),
        new this.cv.Size()
      );

      // 清理资源
      mat.delete();
      gray.delete();

      if (faces.size() > 0) {
        const face = faces.get(0);
        const position = {
          x: face.x + face.width / 2,
          y: face.y + face.height / 2
        };

        // 绘制检测结果
        this.drawDetectionResult(face, startTime);

        const result = {
          position: this.smoothPosition(position),
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

  private drawDetectionResult(face: any, startTime: number): void {
    // 绘制人脸框
    this.processCtx.strokeStyle = '#00ff00';
    this.processCtx.lineWidth = 2;
    this.processCtx.strokeRect(face.x, face.y, face.width, face.height);

    // 绘制中心点
    this.processCtx.fillStyle = '#ff0000';
    const centerX = face.x + face.width / 2;
    const centerY = face.y + face.height / 2;
    this.processCtx.beginPath();
    this.processCtx.arc(centerX, centerY, 3, 0, 2 * Math.PI);
    this.processCtx.fill();

    // 绘制调试信息
    this.processCtx.fillStyle = '#00ff00';
    this.processCtx.font = '12px Arial';
    const processingTime = performance.now() - startTime;
    this.processCtx.fillText(`Detection Time: ${processingTime.toFixed(1)}ms`, 10, 20);
    this.processCtx.fillText(`FPS: ${this.currentFps}`, 10, 40);
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

  private logSystemInfo(): void {
    const info = {
      initialized: this.initialized,
      videoResolution: this.video ? {
        width: this.video.videoWidth,
        height: this.video.videoHeight
      } : null,
      canvasResolution: {
        width: this.processCanvas.width,
        height: this.processCanvas.height},
        options: this.options,
        performance: {
          lastProcessingTime: this.lastProcessingTime,
          currentFps: this.currentFps,
        }
      };
      
      logger.log('System Info:', 'INFO', ModelName);
      logger.log(JSON.stringify(info, null, 2), 'INFO', ModelName);
    }
  
    private calculateConfidence(face: any): number {
      // 计算人脸检测的置信度
      const aspectRatio = face.width / face.height;
      const idealAspectRatio = 1.0; // 理想的人脸宽高比
      const aspectRatioScore = 1 - Math.min(Math.abs(aspectRatio - idealAspectRatio), 1);
  
      // 检查人脸是否在合理的位置范围内
      const centerX = face.x + face.width / 2;
      const centerY = face.y + face.height / 2;
      const positionScore = Math.min(
        1,
        Math.min(centerX, this.processCanvas.width - centerX) / (this.processCanvas.width / 4) *
        Math.min(centerY, this.processCanvas.height - centerY) / (this.processCanvas.height / 4)
      );
  
      // 根据人脸大小计算分数
      const minFaceSize = Math.min(this.processCanvas.width, this.processCanvas.height) * 0.1;
      const maxFaceSize = Math.min(this.processCanvas.width, this.processCanvas.height) * 0.8;
      const sizeScore = Math.min(
        1,
        (face.width - minFaceSize) / (maxFaceSize - minFaceSize)
      );
  
      // 综合评分
      const confidence = (
        aspectRatioScore * 0.3 +
        positionScore * 0.4 +
        sizeScore * 0.3
      );
  
      return Math.max(0, Math.min(1, confidence));
    }
  
    private smoothPosition(position: FacePosition): FacePosition {
      this.positionHistory.push(position);
  
      if (this.positionHistory.length > this.options.shakeFilterSize) {
        this.positionHistory.shift();
      }
  
      // 使用指数加权移动平均进行平滑处理
      const weights = this.positionHistory.map((_, index, arr) => 
        Math.pow(this.options.smoothingFactor, arr.length - index - 1)
      );
      const weightSum = weights.reduce((a, b) => a + b, 0);
  
      const smoothedPosition = {
        x: this.positionHistory.reduce((acc, pos, i) => acc + pos.x * weights[i], 0) / weightSum,
        y: this.positionHistory.reduce((acc, pos, i) => acc + pos.y * weights[i], 0) / weightSum
      };
  
      // 记录调试信息
      if (this.positionHistory.length > 1) {
        const lastPos = this.positionHistory[this.positionHistory.length - 2];
        const movement = Math.sqrt(
          Math.pow(position.x - lastPos.x, 2) + 
          Math.pow(position.y - lastPos.y, 2)
        );
        if (movement > 50) { // 如果移动距离较大，记录日志
          logger.log(`Large movement detected: ${movement.toFixed(2)}px`, 'INFO', ModelName);
        }
      }
  
      return smoothedPosition;
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
          historySize: this.positionHistory.length,
        },
        options: this.options,
      };
    }
  
    async checkOpenCVAvailability(): Promise<boolean> {
      try {
        if (!this.cv) {
          await this.loadOpenCV();
        }
        return true;
      } catch (error) {
        logger.log(`OpenCV availability check failed: ${error}`, 'ERROR', ModelName);
        return false;
      }
    }
  
    private async initializeVideoStream(stream: MediaStream): Promise<void> {
      if (this.stream) {
        this.stream.getTracks().forEach(track => track.stop());
      }
  
      this.stream = stream;
      this.video = document.createElement('video');
      this.video.srcObject = stream;
      this.video.setAttribute('playsinline', 'true');
  
      await new Promise<void>((resolve, reject) => {
        if (!this.video) return reject(new Error('Video element not created'));
  
        const timeoutId = setTimeout(() => {
          reject(new Error('Video loading timeout'));
        }, 10000);
  
        this.video.onloadedmetadata = () => {
          clearTimeout(timeoutId);
          this.video?.play()
            .then(() => {
              if (this.video) {
                this.processCanvas.width = this.video.videoWidth;
                this.processCanvas.height = this.video.videoHeight;
                logger.log(`Video dimensions set to ${this.video.videoWidth}x${this.video.videoHeight}`, 'INFO', ModelName);
              }
              resolve();
            })
            .catch(reject);
        };
  
        this.video.onerror = (event) => {
          clearTimeout(timeoutId);
          reject(new Error(`Video error: ${event}`));
        };
      });
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
      this.initialized = false;
      this.initializing = false;
      this.lastProcessingTime = 0;
      this.currentFps = 0;
      logger.log('Camera stopped', 'INFO', ModelName);
    }
  
    isInitialized(): boolean {
      return this.initialized;
    }
  
    dispose(): void {
      this.stopCamera();
      if (this.faceDetector) {
        this.faceDetector.delete();
        this.faceDetector = null;
      }
      if (this.cv) {
        this.cv = null;
      }
      logger.log('Service disposed', 'INFO', ModelName);
    }
  }