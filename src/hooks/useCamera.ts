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
  width: { ideal: 1280 },
  height: { ideal: 720 },
  frameRate: { ideal: 30 }
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
  const faceDetectionServiceRef = useRef<FaceDetectionService | null>(null);

  

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

  // 修改initializeFaceDetection部分的代码
  const initializeFaceDetection = useCallback(async () => {
    try {
      // 创建 FaceDetectionService 实例
      faceDetectionServiceRef.current = new FaceDetectionService({
        shakeFilterSize: 30,
        smoothingFactor: 0.3,
        minConfidence: 0.7,
        skipFrames: 2
      });

      // 初始化服务
      if (streamRef.current) {
        await faceDetectionServiceRef.current.initialize(streamRef.current);
        logger.log('Face detection service initialized successfully', 'INFO', ModelName);
      }
    } catch (error) {
      logger.log(`Failed to initialize face detection: ${error}`, 'ERROR', ModelName);
      setError('人脸检测初始化失败');
    }
  }, []);

  const startFaceDetection = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !faceDetectionServiceRef.current) return;

    const detectFace = async () => {
      try {
        if (!faceDetectionServiceRef.current || !isCameraActive) return;

        const result = await faceDetectionServiceRef.current.detectFace();
        if (result && videoRef.current) {
          onFaceDetected(result, {
            width: videoRef.current.videoWidth,
            height: videoRef.current.videoHeight
          });
        }
      } catch (error) {
        logger.log(`Error in face detection: ${error}`, 'ERROR', ModelName);
      }

      animationFrameRef.current = requestAnimationFrame(detectFace);
    };

    detectFace();
  }, [isCameraActive, onFaceDetected]);

  const initializeCamera = useCallback(async (deviceId: string) => {
    try {
      logger.log(`Initializing camera: ${deviceId}`, 'INFO', ModelName);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: { exact: deviceId },
          ...options
        }
      });

      if (!videoRef.current || !canvasRef.current) {
        throw new Error('Video or canvas element not initialized');
      }

      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      // Set canvas size to match video
      canvasRef.current.width = videoRef.current.videoWidth;
      canvasRef.current.height = videoRef.current.videoHeight;

      streamRef.current = stream;
      setStreamInfo(getVideoStreamInfo(stream));

      await initializeFaceDetection();
      logger.log('Camera initialized successfully', 'INFO', ModelName);

      return stream;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.log(`Error initializing camera: ${error}`, 'ERROR', ModelName);
      throw new Error(errorMessage);
    }
  }, [options, initializeFaceDetection]);

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

        if (faceDetectionServiceRef.current) {
          faceDetectionServiceRef.current.dispose();
          faceDetectionServiceRef.current = null;
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
      
      // 立即停止流，因为这只是权限检查
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

      if (faceDetectionServiceRef.current) {
        faceDetectionServiceRef.current.dispose();
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
