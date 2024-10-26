import { useState, useCallback, useRef, useEffect } from 'react';
import { logger } from '../utils/logger';
import { FaceDetectionService } from '../services/FaceDetectionService';
import { getVideoStreamInfo, getErrorMessage, detectCameraType } from '../utils/videoUtils';
import type { FaceDetectionResult } from '../types/faceDetection';

const ModelName = 'useCamera';

export interface CameraDevice {
  deviceId: string;
  label: string;
  type: 'builtin' | 'external' | 'virtual' | 'unknown';
}

interface CameraOptions {
  width?: { ideal: number };
  height?: { ideal: number };
  frameRate?: { ideal: number };
}

const DEFAULT_CAMERA_OPTIONS: CameraOptions = {
  width: { ideal: 640 },  // 降低分辨率
  height: { ideal: 480 }, // 降低分辨率
  frameRate: { ideal: 24 } // 降低帧率
};

export function useCamera(
  onFaceDetected: (result: FaceDetectionResult, size: { width: number; height: number }) => void,
  options: CameraOptions = DEFAULT_CAMERA_OPTIONS
) {
  // States
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamInfo, setStreamInfo] = useState('');
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<'checking' | 'granted' | 'denied' | 'prompt'>('checking');

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number>();
  // 将 faceDetectionServiceRef 改为 videoProcessorRef
  const videoProcessorRef = useRef<FaceDetectionService | null>(null);

  // 修改初始化视频处理部分
  // useCamera.ts

const initializeVideoProcessor = useCallback(async () => {
  let retryCount = 0;
  const maxRetries = 3;

  while (retryCount < maxRetries) {
      try {
          if (!videoRef.current || !canvasRef.current) {
              throw new Error('Video or canvas element not initialized');
          }

          // Try WebGL2 first, then WebGL1, then fallback to no WebGL
          const webglContext = canvasRef.current.getContext('webgl2') || 
                             canvasRef.current.getContext('webgl');

          if (!webglContext) {
              logger.log('WebGL not supported - falling back to CPU processing', 'WARN', ModelName);
              // Continue without WebGL context
          }

          if (!videoProcessorRef.current) {
              videoProcessorRef.current = new FaceDetectionService({
                  skipFrames: 2,
                  smoothingFactor: 0.5,
                  ...(webglContext ? { webglContext } : {})
              });
          }

          await videoProcessorRef.current.initialize();
          if (videoRef.current) {
              videoProcessorRef.current.setVideo(videoRef.current);
          }
          
          logger.log('Video processor initialized successfully', 'INFO', ModelName);
          return;
      } catch (error) {
          retryCount++;
          logger.log(`Initialization attempt ${retryCount} failed: ${error}`, 'WARN', ModelName);
          
          if (retryCount === maxRetries) {
              logger.log(`All initialization attempts failed`, 'ERROR', ModelName);
              throw new Error(`Unable to initialize video processor after ${maxRetries} attempts`);
          }
          
          await new Promise(resolve => setTimeout(resolve, 1000));
      }
  }
}, []);

  // 修改人脸检测处理部分
  const startFaceDetection = useCallback(() => {
    logger.log('Attempting to start face detection...', 'INFO', ModelName);
    
    // 检查所有必需的条件
    if (!videoRef.current) {
        logger.log('Video ref is missing', 'WARN', ModelName);
        return;
    }
    if (!canvasRef.current) {
        logger.log('Canvas ref is missing', 'WARN', ModelName);
        return;
    }
    if (!videoProcessorRef.current) {
        logger.log('VideoProcessor ref is missing', 'WARN', ModelName);
        return;
    }
    if (!isCameraActive) {
        logger.log('Camera is not active', 'WARN', ModelName);
        return;
    }

    logger.log('All requirements met, starting detection loop', 'INFO', ModelName);

    const detectFace = async () => {
        try {
            // 再次检查条件（因为可能在循环过程中发生变化）
            if (!videoProcessorRef.current || !isCameraActive || !videoRef.current) {
                logger.log('Detection requirements no longer met', 'DEBUG', ModelName);
                return;
            }

            // 检查视频是否准备好
            if (videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA) {
                logger.log('Video not ready yet', 'DEBUG', ModelName);
                if (isCameraActive) {
                    animationFrameRef.current = requestAnimationFrame(detectFace);
                }
                return;
            }

            logger.log('Attempting face detection', 'DEBUG', ModelName);
            const result = await videoProcessorRef.current.detectFace(videoRef.current);
            
            if (result) {
                logger.log(`Face detected at (${result.position.x}, ${result.position.y}) with confidence ${result.confidence}`, 'INFO', ModelName);
                onFaceDetected(result, {
                    width: videoRef.current.videoWidth,
                    height: videoRef.current.videoHeight
                });
            }

        } catch (error) {
            logger.log(`Error in face detection loop: ${error}`, 'ERROR', ModelName);
        }

        if (isCameraActive) {
            animationFrameRef.current = requestAnimationFrame(detectFace);
        }
    };

    logger.log('Starting face detection loop', 'INFO', ModelName);
    detectFace();
  }, [isCameraActive, onFaceDetected]);

  // 确保在摄像头激活时启动检测
  useEffect(() => {
    logger.log(`Camera active state changed: ${isCameraActive}`, 'INFO', ModelName);
    if (isCameraActive) {
        startFaceDetection();
    }
  }, [isCameraActive, startFaceDetection]);

  const initializeCamera = useCallback(async (deviceId: string) => {
    try {
      logger.log(`Initializing camera: ${deviceId}`, 'INFO', ModelName);
      logger.log(`Camera options: ${JSON.stringify(options)}`, 'INFO', ModelName);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: { exact: deviceId },
          ...options
        }
      });

      logger.log(`Stream obtained successfully`, 'INFO', ModelName);

      if (!videoRef.current || !canvasRef.current) {
        throw new Error('Video or canvas element not initialized');
      }

      videoRef.current.srcObject = stream;
      logger.log(`Video source set`, 'INFO', ModelName);

      await videoRef.current.play();
      logger.log(`Video playback started`, 'INFO', ModelName);

      canvasRef.current.width = videoRef.current.videoWidth;
      canvasRef.current.height = videoRef.current.videoHeight;
      logger.log(`Canvas size set to ${canvasRef.current.width}x${canvasRef.current.height}`, 'INFO', ModelName);

      streamRef.current = stream;
      setStreamInfo(getVideoStreamInfo(stream));
      logger.log(`Stream info set`, 'INFO', ModelName);

      logger.log(`Starting VideoProcessor initialization`, 'INFO', ModelName);
      await initializeVideoProcessor();
      logger.log(`VideoProcessor initialized`, 'INFO', ModelName);

      // 修改这部分代码，安全地检查上下文类型
      const contextTypes = ['2d', 'webgl', 'experimental-webgl'] as const;
      let gl = null;
      for (const type of contextTypes) {
        gl = canvasRef.current.getContext(type);
        if (gl) {
          logger.log(`Context obtained: ${type}`, 'INFO', ModelName);
          break;
        }
      }

      if (!gl) {
        logger.log(`Could not get any rendering context`, 'WARN', ModelName);
      } else {
        logger.log(`Rendering context details:`, 'INFO', ModelName);
        // 安全地检查上下文类型
        if (gl instanceof CanvasRenderingContext2D) {
          logger.log(`- Type: 2D Context`, 'INFO', ModelName);
        } else if (gl instanceof WebGLRenderingContext) {
          logger.log(`- Type: WebGL`, 'INFO', ModelName);
          logger.log(`- WebGL vendor: ${gl.getParameter(gl.VENDOR)}`, 'INFO', ModelName);
          logger.log(`- WebGL renderer: ${gl.getParameter(gl.RENDERER)}`, 'INFO', ModelName);
          logger.log(`- WebGL version: ${gl.getParameter(gl.VERSION)}`, 'INFO', ModelName);
          logger.log(`- GLSL version: ${gl.getParameter(gl.SHADING_LANGUAGE_VERSION)}`, 'INFO', ModelName);
        }
      }

      logger.log('Camera initialized successfully', 'INFO', ModelName);

      return stream;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.log(`Error initializing camera: ${error}`, 'ERROR', ModelName);
      logger.log(`Error stack: ${(error as Error).stack}`, 'INFO', ModelName);
      throw new Error(errorMessage);
    }
  }, [options, initializeVideoProcessor]);

  const toggleCamera = useCallback(async (active: boolean) => {
    try {
      setIsLoading(true);
      setError(null);

      if (active) {
        if (!selectedCamera) {
          throw new Error('未选择摄像头');
        }

        await initializeCamera(selectedCamera);
        setIsCameraActive(true);
        startFaceDetection();
        logger.log('Camera activated successfully', 'INFO', ModelName);
      } else {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = undefined;
        }

        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }

        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }

        if (videoProcessorRef.current) {
          videoProcessorRef.current.dispose();
          videoProcessorRef.current = null;
        }

        setIsCameraActive(false);
        setStreamInfo('');
        logger.log('Camera deactivated successfully', 'INFO', ModelName);
      }
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.log(`Error toggling camera: ${error}`, 'ERROR', ModelName);
      setError(errorMessage);
      setIsCameraActive(false);
    } finally {
      setIsLoading(false);
    }
  }, [selectedCamera, initializeCamera, startFaceDetection]);

  

  const fetchCameras = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      logger.log('Fetching camera list', 'INFO', ModelName);

      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices
        .filter(device => device.kind === 'videoinput')
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || '未命名摄像头',
          type: detectCameraType(device.label)
        }));

      setCameras(videoDevices);
      logger.log(`Found ${videoDevices.length} cameras`, 'INFO', ModelName);

      if (videoDevices.length > 0 && !selectedCamera) {
        const defaultCamera = videoDevices.find(c => c.type === 'builtin') || videoDevices[0];
        setSelectedCamera(defaultCamera.deviceId);
        logger.log(`Selected default camera: ${defaultCamera.label}`, 'INFO', ModelName);
      }
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.log(`Error fetching cameras: ${error}`, 'ERROR', ModelName);
      setError(errorMessage);
      setCameras([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedCamera]);

  // 增加详细的权限检查逻辑
  const checkCameraPermission = useCallback(async () => {
    logger.log('Starting camera permission check...', 'INFO', ModelName);
    
    try {
      // 首先尝试使用 Permissions API
      if (navigator.permissions) {
        logger.log('Using Permissions API to check camera access', 'INFO', ModelName);
        const { state } = await navigator.permissions.query({ name: 'camera' as PermissionName });
        logger.log(`Permissions API returned state: ${state}`, 'INFO', ModelName);
        
        switch (state) {
          case 'granted':
            setPermissionStatus('granted');
            logger.log('Camera permission already granted', 'INFO', ModelName);
            return true;
          case 'prompt':
            setPermissionStatus('prompt');
            logger.log('Camera permission needs to be requested', 'INFO', ModelName);
            return false;
          case 'denied':
            setPermissionStatus('denied');
            logger.log('Camera permission denied', 'INFO', ModelName);
            return false;
        }
      }

      // 如果 Permissions API 不可用，尝试直接请求摄像头
      logger.log('Permissions API not available, trying direct camera access', 'INFO', ModelName);
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      
      // 立即停止流，为这只是权限检查
      stream.getTracks().forEach(track => track.stop());
      
      setPermissionStatus('granted');
      logger.log('Camera access granted through direct request', 'INFO', ModelName);
      return true;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.log(`Camera permission check failed: ${errorMessage}`, 'ERROR', ModelName);
      
      if (error instanceof DOMException) {
        switch (error.name) {
          case 'NotAllowedError':
            setPermissionStatus('denied');
            logger.log('Camera access explicitly denied by user', 'INFO', ModelName);
            break;
          case 'NotFoundError':
            setPermissionStatus('denied');
            logger.log('No camera devices found', 'INFO', ModelName);
            break;
          default:
            setPermissionStatus('denied');
            logger.log(`Unexpected camera error: ${error.name}`, 'ERROR', ModelName);
        }
      } else {
        setPermissionStatus('denied');
        logger.log('Unknown camera permission error', 'ERROR', ModelName);
      }
      return false;
    }
  }, []);

  // 处理权限授予
  const handlePermissionGranted = useCallback(async () => {
    logger.log('Handling permission granted event', 'INFO', ModelName);
    try {
      setPermissionStatus('granted');
      logger.log('Permission status updated to granted', 'INFO', ModelName);
      
      // 尝试重新获取摄像头列表
      logger.log('Attempting to fetch cameras after permission granted', 'INFO', ModelName);
      await fetchCameras();
      
      logger.log('Successfully handled permission granted', 'INFO', ModelName);
    } catch (error) {
      logger.log(`Error handling permission granted: ${error}`, 'ERROR', ModelName);
      setError('获取摄像头列表失败');
    }
  }, [fetchCameras]);

  // 修改初始化检查逻辑
  useEffect(() => {
    logger.log('Initial camera permission check starting', 'INFO', ModelName);
    const initializeCamera = async () => {
      setPermissionStatus('checking');
      logger.log('Permission status set to checking', 'INFO', ModelName);
      
      const hasPermission = await checkCameraPermission();
      logger.log(`Initial permission check result: ${hasPermission}`, 'INFO', ModelName);
      
      if (hasPermission) {
        logger.log('Permission granted, fetching cameras', 'INFO', ModelName);
        await fetchCameras();
      } else {
        logger.log('No initial permission, waiting for user action', 'INFO', ModelName);
      }
    };

    initializeCamera();
  }, [checkCameraPermission, fetchCameras]);


  // 监听设备变化
  useEffect(() => {
    const handleDeviceChange = () => {
      logger.log('Device change detected', 'INFO', ModelName);
      fetchCameras();
    };

    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);

    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
    };
  }, [fetchCameras]);

  // 组件清理
  useEffect(() => {
    return () => {
      logger.log('Cleaning up camera resources', 'INFO', ModelName);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      if (videoProcessorRef.current) {
        videoProcessorRef.current.dispose();
      }
    };
  }, []);

  return {
    // 状态
    isCameraActive,
    isLoading,
    error,
    streamInfo,
    cameras,
    selectedCamera,
    permissionStatus,

    // Refs
    videoRef,
    canvasRef,

    // 方法
    fetchCameras,
    toggleCamera,
    setSelectedCamera,
    handlePermissionGranted,
    checkCameraPermission
  };
}

export type { CameraOptions };  // 只导出CameraOptions，因为CameraDevice已经在上面导出了

