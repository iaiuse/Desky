import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CameraOff, Camera, RefreshCw } from "lucide-react";
import PermissionHandler from './VideoFeed/PermissionHandler';
import { logger } from '../utils/logger';
import { permissionManager } from '../utils/permissionUtils';
import {
  detectCameraType,
  getCameraTypeLabel,
  getErrorMessage,
  getPlaceholderText,
  getVideoStreamInfo,
  getCameraIconStyle,
  drawDetectionResult
} from '../utils/videoUtils';
import { FaceDetectionService } from '../services/FaceDetectionService';
import { FaceDetectionResult } from '../types/faceDetection';

const ModelName = "VideoFeed";

interface VideoFeedProps {
  onFaceDetected: (result: FaceDetectionResult, canvasSize: { width: number, height: number }) => void;
  debug?: boolean;
}

interface CameraDevice {
  deviceId: string;
  label: string;
  type: 'builtin' | 'external' | 'virtual' | 'unknown';
}

const VideoFeed: React.FC<VideoFeedProps> = ({ onFaceDetected, debug = false }) => {
  // 状态管理
  const [permissionStatus, setPermissionStatus] = useState<'checking' | 'granted' | 'denied' | 'prompt'>('checking');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamInfo, setStreamInfo] = useState<string>('');

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number>();
  const faceDetectionServiceRef = useRef<FaceDetectionService | null>(null);

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

  const processVideoFrame = useCallback(async () => {
    if (!canvasRef.current || !faceDetectionServiceRef.current || !isCameraActive) return;

    try {
      // 检测人脸
      const result = await faceDetectionServiceRef.current.detectFace();
      
      if (result) {
        // 使用 videoUtils 中的方法绘制检测结果
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          drawDetectionResult(ctx, result, debug);
          onFaceDetected(result, {
            width: canvasRef.current.width,
            height: canvasRef.current.height
          });
        }
      }

      // 继续下一帧处理
      animationFrameRef.current = requestAnimationFrame(processVideoFrame);
    } catch (error) {
      logger.log(`Error processing video frame: ${error}`, 'ERROR', ModelName);
    }
  }, [debug, isCameraActive, onFaceDetected]);

  const initializeCamera = useCallback(async (deviceId: string) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: { exact: deviceId },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        // 设置canvas尺寸
        if (canvasRef.current) {
          canvasRef.current.width = videoRef.current.videoWidth;
          canvasRef.current.height = videoRef.current.videoHeight;
        }

        streamRef.current = stream;
        setStreamInfo(getVideoStreamInfo(stream));

        // 初始化人脸检测
        await initializeFaceDetection();
        
        // 开始处理视频帧
        animationFrameRef.current = requestAnimationFrame(processVideoFrame);
      }
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }, [initializeFaceDetection, processVideoFrame]);

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
      } else {
        // 停止视频处理
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }

        // 清理人脸检测服务
        if (faceDetectionServiceRef.current) {
          faceDetectionServiceRef.current.dispose();
          faceDetectionServiceRef.current = null;
        }

        // 停止视频流
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }

        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }

        setIsCameraActive(false);
        setStreamInfo('');
      }
    } catch (error) {
      logger.log(`Error toggling camera: ${error}`, 'ERROR', ModelName);
      setError(error instanceof Error ? error.message : '摄像头控制失败');
      setIsCameraActive(false);
    } finally {
      setIsLoading(false);
    }
  }, [selectedCamera, initializeCamera]);

  // 初始化时检查权限状态
  useEffect(() => {
    const checkInitialPermission = async () => {
      try {
        logger.log('Checking initial camera permission', 'INFO', ModelName);
        const result = await permissionManager.checkPermission();
        setPermissionStatus(result.state === 'granted' ? 'granted' : 'prompt');

        if (result.state === 'granted') {
          logger.log('Camera permission already granted', 'INFO', ModelName);
          await fetchCameras();
        }
      } catch (error) {
        logger.log(`Error checking initial permission: ${error}`, 'ERROR', ModelName);
        setPermissionStatus('denied');
      }
    };

    checkInitialPermission();
  }, []);

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

      if (videoDevices.length > 0 && !selectedCamera) {
        const defaultCamera = videoDevices.find(c => c.type === 'builtin') || videoDevices[0];
        setSelectedCamera(defaultCamera.deviceId);
        logger.log(`Default camera selected: ${defaultCamera.label}`, 'INFO', ModelName);
      }

      logger.log(`Found ${videoDevices.length} cameras`, 'INFO', ModelName);
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.log(`Error fetching cameras: ${error}`, 'ERROR', ModelName);
      setError(errorMessage);
      setCameras([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedCamera]);

  const handlePermissionGranted = useCallback(async () => {
    logger.log('Permission granted, setting up camera', 'INFO', ModelName);
    setPermissionStatus('granted');
    await fetchCameras();
  }, [fetchCameras]);

  const simulateFaceDetection = useCallback(() => {
    if (!videoRef.current || !isCameraActive) return;

    const mockResult: FaceDetectionResult = {
      position: {
        x: videoRef.current.videoWidth / 2,
        y: videoRef.current.videoHeight / 2
      },
      size: {
        width: 100,
        height: 100
      },
      confidence: 0.9
    };

    onFaceDetected(
      mockResult,
      { 
        width: videoRef.current.videoWidth, 
        height: videoRef.current.videoHeight 
      }
    );

    animationFrameRef.current = requestAnimationFrame(simulateFaceDetection);
  }, [onFaceDetected, isCameraActive]);

  const handleCameraSelect = useCallback(async (deviceId: string) => {
    if (deviceId === selectedCamera) return;

    try {
      logger.log(`Selecting camera: ${deviceId}`, 'INFO', ModelName);
      if (isCameraActive) {
        await toggleCamera(false);
      }
      setSelectedCamera(deviceId);
      if (isCameraActive) {
        await toggleCamera(true);
      }
    } catch (error) {
      logger.log(`Error selecting camera: ${error}`, 'ERROR', ModelName);
      setError('切换摄像头失败');
    }
  }, [selectedCamera, isCameraActive, toggleCamera]);

  useEffect(() => {
    const handleDeviceChange = () => {
      logger.log('Device change detected', 'INFO', ModelName);
      fetchCameras();
    };

    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);

    return () => {
      logger.log('Cleaning up VideoFeed component', 'INFO', ModelName);
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [fetchCameras]);

  // 根据权限状态渲染不同内容
  if (permissionStatus === 'checking') {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <Camera className="mx-auto mb-2 animate-pulse" size={48} />
            <p>正在检查摄像头权限...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (permissionStatus !== 'granted') {
    return (
      <Card>
        <CardContent className="p-6">
          <PermissionHandler onPermissionGranted={handlePermissionGranted} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardContent className="p-6">
        <div className="mb-4 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center space-x-4">
            <div className="w-64">
              <Select
                value={selectedCamera || ''}
                onValueChange={handleCameraSelect}
                disabled={isLoading || isCameraActive}
              >
                <SelectTrigger>
                  <SelectValue placeholder={getPlaceholderText(isLoading, cameras.length)} />
                </SelectTrigger>
                <SelectContent>
                  {cameras.map((camera) => (
                    <SelectItem key={camera.deviceId} value={camera.deviceId}>
                      <div className="flex items-center gap-2">
                        <Camera className={getCameraIconStyle(camera.type)} />
                        <div className="flex flex-col">
                          <span className="font-medium">{getCameraTypeLabel(camera.type)}</span>
                          <span className="text-xs text-gray-500">{camera.label}</span>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                checked={isCameraActive}
                onCheckedChange={toggleCamera}
                disabled={!selectedCamera || isLoading}
              />
              <span className="text-sm font-medium">
                {isCameraActive ? '关闭摄像头' : '开启摄像头'}
              </span>
            </div>
          </div>

          <Button
            onClick={fetchCameras}
            disabled={isLoading || isCameraActive}
            size="sm"
            variant="outline"
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            刷新列表
          </Button>
        </div>

        <div className="relative w-full h-[360px] bg-gray-900 rounded-lg overflow-hidden">
          <video
            ref={videoRef}
            className="w-full h-full object-contain"
            playsInline
            muted
            autoPlay
          />
          <canvas
            ref={canvasRef}
            className="absolute top-0 left-0 w-full h-full"
          />

          {!isCameraActive && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
              <div className="text-center text-white">
                <CameraOff className="mx-auto mb-2" size={48} />
                <p>{cameras.length === 0 ? "未找到摄像头" : "摄像头未启动"}</p>
              </div>
            </div>
          )}

          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
              <div className="text-center text-white">
                <Camera className="mx-auto mb-2 animate-pulse" size={48} />
                <p>正在初始化摄像头...</p>
              </div>
            </div>
          )}
        </div>

        {debug && streamInfo && (
          <div className="mt-2 text-sm text-gray-500">
            {streamInfo}
          </div>
        )}

        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

export default VideoFeed;