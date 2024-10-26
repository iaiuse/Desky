import * as faceapi from 'face-api.js';
import { logger } from '../utils/logger';
import { FaceDetectionResult } from '@/types/faceDetection';

export class FaceDetectionService {
    private initialized = false;
    private videoElement: HTMLVideoElement | null = null;
    private frameCount = 0;
    private lastProcessingTime = 0;
    private currentFps = 0;
    
    constructor(private config: {
        skipFrames: number;
        minConfidence?: number;
        smoothingFactor?: number;
    }) {}

    async initialize(): Promise<void> {
        if (this.initialized) return;

        try {
            logger.log('Loading face-api models...', 'INFO', 'VideoProcessor');
            
            // 添加更详细的日志
            const modelPath = '/models';
            logger.log(`Loading models from: ${modelPath}`, 'INFO', 'VideoProcessor');
            
            try {
                await faceapi.nets.tinyFaceDetector.load(modelPath);
                logger.log('TinyFaceDetector model loaded', 'INFO', 'VideoProcessor');
            } catch (e) {
                logger.log(`Failed to load TinyFaceDetector: ${e}`, 'ERROR', 'VideoProcessor');
                throw e;
            }

            this.initialized = true;
            logger.log('Face-api models loaded successfully', 'INFO', 'VideoProcessor');
        } catch (error) {
            logger.log(`Failed to initialize face-api: ${error}`, 'ERROR', 'VideoProcessor');
            throw error;
        }
    }

    async detectFace(video: HTMLVideoElement): Promise<FaceDetectionResult | null> {
        if (!this.initialized || !video) {
            logger.log('Detection skipped: not initialized or no video', 'DEBUG', 'VideoProcessor');
            return null;
        }

        try {
            if (this.videoElement !== video) {
                this.videoElement = video;
            }

            // 确保视频已经准备好
            if (video.readyState !== video.HAVE_ENOUGH_DATA) {
                logger.log('Video not ready yet', 'DEBUG', 'VideoProcessor');
                return null;
            }

            if (this.frameCount++ % this.config.skipFrames !== 0) {
                return null;
            }

            const startTime = performance.now();
            logger.log('Starting face detection...', 'DEBUG', 'VideoProcessor');

            // 使用更宽松的检测参数
            const options = new faceapi.TinyFaceDetectorOptions({
                inputSize: 160,        // 降低输入大小以提高性能
                scoreThreshold: 0.1    // 降低阈值使检测更容易
            });

            logger.log('Calling detectSingleFace...', 'DEBUG', 'VideoProcessor');
            const detection = await faceapi.detectSingleFace(video, options);
            logger.log(`Detection result: ${detection ? 'Face found' : 'No face'}`, 'DEBUG', 'VideoProcessor');

            if (detection) {
                const { box, score } = detection;
                logger.log(`Face detected with score: ${score}`, 'DEBUG', 'VideoProcessor');
                logger.log(`Box: x=${box.x}, y=${box.y}, w=${box.width}, h=${box.height}`, 'DEBUG', 'VideoProcessor');

                const result: FaceDetectionResult = {
                    position: {
                        x: box.x + box.width / 2,
                        y: box.y + box.height / 2
                    },
                    size: {
                        width: box.width,
                        height: box.height
                    },
                    confidence: score,
                    processingTime: performance.now() - startTime,
                    fps: this.calculateFps(startTime)
                };

                return result;
            }

            return null;
        } catch (error) {
            logger.log(`Error in face detection: ${error}`, 'ERROR', 'VideoProcessor');
            if (error instanceof Error) {
                logger.log(`Error stack: ${error.stack}`, 'ERROR', 'VideoProcessor');
            }
            return null;
        }
    }

    private calculateFps(currentTime: number): number {
        if (this.lastProcessingTime) {
            const delta = currentTime - this.lastProcessingTime;
            this.currentFps = 1000 / delta;
        }
        this.lastProcessingTime = currentTime;
        return Math.round(this.currentFps);
    }

    setVideo(video: HTMLVideoElement): void {
        this.videoElement = video;
        logger.log('Video element set', 'INFO', 'VideoProcessor');
    }

    isWebGLEnabled(): boolean {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        const hasWebGL = !!gl;
        if (gl) {
            (gl as WebGLRenderingContext).getExtension('WEBGL_lose_context')?.loseContext();
        }
        return hasWebGL;
    }

    dispose(): void {
        // Clean up resources
        this.initialized = false;
        this.videoElement = null;
    }
}
