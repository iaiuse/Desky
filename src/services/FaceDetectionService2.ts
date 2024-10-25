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

  private async initializeVideoStream(stream: MediaStream): Promise<void> {
    try {
      logger.log('Initializing video stream...', 'INFO', ModelName);
      this.stream = stream;
      this.video = document.createElement('video');
      this.video.srcObject = stream;
      this.video.setAttribute('playsinline', 'true');

      await new Promise<void>((resolve, reject) => {
        if (!this.video) return reject(new Error('Video element not created'));

        this.video.onloadedmetadata = () => {
          this.video?.play()
            .then(() => {
              logger.log('Video playback started', 'INFO', ModelName);
              resolve();
            })
            .catch(reject);
        };

        this.video.onerror = (event) => {
          logger.log(`Video error: ${event}`, 'ERROR', ModelName);
          reject(new Error('Video initialization error'));
        };
      });

      logger.log('Video stream initialized successfully', 'INFO', ModelName);
    } catch (error) {
      logger.log(`Failed to initialize video stream: ${error}`, 'ERROR', ModelName);
      throw error;
    }
  }

  private async loadFaceDetector(): Promise<void> {
    try {
      logger.log('Loading face detector...', 'INFO', ModelName);
      
      if (!this.cv) {
        throw new Error('OpenCV not loaded');
      }
  
      // 创建级联分类器
      this.faceDetector = new this.cv.CascadeClassifier();
      logger.log('CascadeClassifier created successfully', 'INFO', ModelName);
  
      // 加载分类器文件
      const response = await fetch('/haarcascade_frontalface_default.xml');
      if (!response.ok) {
        throw new Error(`Failed to fetch classifier file: ${response.status}`);
      }
  
      const xmlText = await response.text();
      logger.log(`Classifier XML loaded, length: ${xmlText.length}`, 'INFO', ModelName);
      
      // 直接构建 Mat 数据
      try {
        // 创建 uint8 数组
        const buffer = new TextEncoder().encode(xmlText);
        logger.log(`Created buffer with length: ${buffer.length}`, 'INFO', ModelName);
  
        // 创建 Mat 对象
        const mat = this.cv.matFromArray(buffer.length, 1, this.cv.CV_8U, buffer);
        logger.log('Created Mat from buffer', 'INFO', ModelName);
  
        // 加载分类器
        const success = this.faceDetector.load(mat);
        logger.log(`Classifier load result: ${success}`, 'INFO', ModelName);
  
        // 清理 Mat
        mat.delete();
  
        if (!success) {
          throw new Error('Failed to load classifier data');
        }
  
        logger.log('Face detector loaded successfully', 'INFO', ModelName);
      } catch (error) {
        logger.log(`Error loading classifier data: ${error}`, 'ERROR', ModelName);
        throw new Error(`Failed to load classifier data: ${error}`);
      }
    } catch (error) {
      logger.log(`Failed to load face detector: ${error}`, 'ERROR', ModelName);
      throw error;
    }
  }
  
  // 也修改一下 loadOpenCV 方法，增加更多检查
  private async loadOpenCV(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (typeof (window as any).cv !== 'undefined') {
        logger.log('OpenCV global object found', 'INFO', ModelName);
        
        if ((window as any).cv.getBuildInformation) {
          this.cv = (window as any).cv;
          logger.log('OpenCV already loaded and initialized', 'INFO', ModelName);
          resolve();
          return;
        }
      }
  
      logger.log('Loading OpenCV script...', 'INFO', ModelName);
      const script = document.createElement('script');
      script.setAttribute('async', '');
      script.setAttribute('type', 'text/javascript');
      script.setAttribute('src', '/opencv.js');
  
      script.onload = () => {
        logger.log('OpenCV script loaded, waiting for initialization...', 'INFO', ModelName);
        
        if ((window as any).cv?.getBuildInformation) {
          this.cv = (window as any).cv;
          logger.log('OpenCV initialized immediately', 'INFO', ModelName);
          resolve();
        } else {
          const waitForCV = () => {
            if ((window as any).cv?.getBuildInformation) {
              this.cv = (window as any).cv;
              logger.log('OpenCV initialized after wait', 'INFO', ModelName);
              resolve();
            } else {
              setTimeout(waitForCV, 10);
            }
          };
          
          (window as any).cv.onRuntimeInitialized = () => {
            this.cv = (window as any).cv;
            logger.log('OpenCV runtime initialized', 'INFO', ModelName);
            resolve();
          };
  
          waitForCV();
        }
      };
  
      script.onerror = (error) => {
        const errorMsg = 'Failed to load OpenCV script';
        logger.log(`${errorMsg}: ${error}`, 'ERROR', ModelName);
        reject(new Error(errorMsg));
      };
  
      document.body.appendChild(script);
    });
  }
  
  // 优化内存使用的辅助方法
  private async ensureMemoryAvailable(): Promise<void> {
    try {
      if (this.cv.CV_VERSION) {  // OpenCV 3.x 和 4.x 的版本检查方式不同
        await this.cv.ready;  // 等待 WASM 完全准备好
        
        // 可选: 清理任何现有的内存分配
        if (this.faceDetector) {
          this.faceDetector.delete();
          this.faceDetector = null;
        }
        
        // 可以在这里添加内存使用检查
        logger.log('Memory prepared for face detection', 'INFO', ModelName);
      }
    } catch (error) {
      logger.log(`Error ensuring memory availability: ${error}`, 'ERROR', ModelName);
      throw error;
    }
  }
  
  async initialize(stream: MediaStream): Promise<void> {
    if (this.initialized) {
      logger.log('Already initialized', 'INFO', ModelName);
      return;
    }
    
    if (this.initializing) {
      logger.log('Already initializing, waiting...', 'INFO', ModelName);
      return;
    }
  
    try {
      this.initializing = true;
      logger.log('Starting initialization...', 'INFO', ModelName);
      
      // 1. 加载 OpenCV
      await this.loadOpenCV();
      logger.log('OpenCV loaded successfully', 'INFO', ModelName);
      
      // 2. 确保内存可用
      await this.ensureMemoryAvailable();
      logger.log('Memory check completed', 'INFO', ModelName);
      
      // 3. 初始化视频流
      await this.initializeVideoStream(stream);
      logger.log('Video stream initialized', 'INFO', ModelName);
      
      // 4. 加载人脸检测器
      await this.loadFaceDetector();
      logger.log('Face detector loaded successfully', 'INFO', ModelName);
      
      this.initialized = true;
      logger.log('Initialization completed successfully', 'INFO', ModelName);
    } catch (error) {
      logger.log(`Initialization failed: ${error}`, 'ERROR', ModelName);
      this.initialized = false;
      throw new Error(`Failed to initialize: ${error}`);
    } finally {
      this.initializing = false;
    }
  }

  async setupVideo(stream: MediaStream): Promise<void> {
    try {
      logger.log('Setting up video stream...', 'INFO', ModelName);
      
      if (!this.initialized) {
        throw new Error('Service not initialized');
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
              logger.log('Video playback started', 'INFO', ModelName);
              resolve();
            })
            .catch(reject);
        };

        this.video.onerror = () => reject(new Error('Video error'));
      });

      logger.log('Video setup completed', 'INFO', ModelName);
    } catch (error) {
      logger.log(`Failed to setup video: ${error}`, 'ERROR', ModelName);
      throw error;
    }
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
