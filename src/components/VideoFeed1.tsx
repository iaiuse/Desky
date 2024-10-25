// src/components/VideoFeed.tsx

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CameraOff, Camera, RefreshCw } from "lucide-react";
import { invoke } from '@tauri-apps/api/tauri';
import PermissionHandler from './VideoFeed/PermissionHandler';
import { logger } from '../utils/logger';
import { permissionManager } from '../utils/permissionUtils';
import { FaceDetectionService } from '../services/FaceDetectionService';
import { FaceDetectionResult } from '../types/faceDetection';
import {
  detectCameraType,
  getCameraTypeLabel,
  getCameraIcon,
  getErrorMessage,
  getPlaceholderText,
  getVideoStreamInfo
} from '../utils/videoUtils';

const ModelName = "VideoFeed";

interface VideoFeedProps {
  onFaceDetected: (result: FaceDetectionResult, canvasSize: { width: number; height: number }) => void;
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
  const [canvasSize, setCanvasSize] = useState({ width: 640, height: 480 });
  const [error, setError] = useState<string | null>(null);
  const [streamInfo, setStreamInfo] = useState<string>('');

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const faceDetectionServiceRef = useRef<FaceDetectionService | null>(null);
  const animationFrameRef = useRef<number>();
  const currentStreamRef = useRef<MediaStream | null>(null);
  // 提前声明 processVideoFrame
  // 添加舵机控制相关的引用
  const lastServoPositionRef = useRef({ x: 90, y: 90 });

  // 初始化时检查权限状态
  useEffect(() => {
    const checkInitialPermission = async () => {
      try {
        logger.log('Checking initial camera permission', 'INFO', ModelName);
        const result = await permissionManager.checkPermission();
        setPermissionStatus(result.state === 'granted' ? 'granted' : 'prompt');

        if (result.state === 'granted') {
          // 如果已经有权限，直接获取摄像头列表
          await fetchCameras();
        }
      } catch (error) {
        logger.log(`Error checking initial permission: ${error}`, 'ERROR', ModelName);
        setPermissionStatus('denied');
      }
    };

    checkInitialPermission();
  }, []);

  // 获取摄像头列表
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
        // 优先选择内置摄像头
        const defaultCamera = videoDevices.find(c => c.type === 'builtin') || videoDevices[0];
        setSelectedCamera(defaultCamera.deviceId);
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

  // 处理权限授予
  const handlePermissionGranted = useCallback(async () => {
    logger.log('Permission granted, setting up camera', 'INFO', ModelName);
    setPermissionStatus('granted');
    await fetchCameras();
  }, [fetchCameras]);




  // 修改initializeCamera函数
  const initializeCamera = useCallback(async (deviceId: string) => {
    if (!videoRef.current) {
      throw new Error('Video element not initialized');
    }

    const constraints = {
      video: {
        deviceId: deviceId ? { exact: deviceId } : undefined,
        width: { ideal: 640 },
        height: { ideal: 480 },
        frameRate: { ideal: 30 },
        facingMode: "user"
      }
    };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);

    // 设置视频源
    videoRef.current.srcObject = stream;
    currentStreamRef.current = stream;

    // 等待视频加载
    await new Promise<void>((resolve, reject) => {
      if (!videoRef.current) return reject(new Error('Video element not found'));

      const handleCanPlay = () => {
        if (videoRef.current) {
          // 更新canvas尺寸以匹配视频尺寸
          const videoWidth = videoRef.current.videoWidth;
          const videoHeight = videoRef.current.videoHeight;

          setCanvasSize({
            width: videoWidth,
            height: videoHeight
          });

          if (canvasRef.current) {
            canvasRef.current.width = videoWidth;
            canvasRef.current.height = videoHeight;
          }

          videoRef.current.play()
            .then(() => {
              setStreamInfo(getVideoStreamInfo(stream));
              resolve();
            })
            .catch(reject);
        }
      };

      videoRef.current.addEventListener('canplay', handleCanPlay, { once: true });
      videoRef.current.onerror = () => reject(new Error('Video loading failed'));
    });

    return stream;
  }, []);
  // 修改后的 processVideoFrame 函数
  const processVideoFrame = useCallback(async () => {
    if (!canvasRef.current || !videoRef.current || !faceDetectionServiceRef.current) return;

    try {
      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;

      if (videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
        // 将视频帧绘制到 canvas
        ctx.drawImage(
          videoRef.current,
          0, 0,
          canvasSize.width,
          canvasSize.height
        );

        // 进行人脸检测
        const result = await faceDetectionServiceRef.current.detectFace();

        if (result) {
          // 调用回调函数
          onFaceDetected(result, canvasSize);

          // 计算并更新舵机位置
          const newServoX = Math.round(180 - (result.position.x / canvasSize.width) * 180);
          const newServoY = Math.round((result.position.y / canvasSize.height) * 180);

          // 平滑处理
          const smoothedX = lastServoPositionRef.current.x +
            (newServoX - lastServoPositionRef.current.x) * 0.3;
          const smoothedY = lastServoPositionRef.current.y +
            (newServoY - lastServoPositionRef.current.y) * 0.3;

          // 限制范围
          const clampedX = Math.max(0, Math.min(180, Math.round(smoothedX)));
          const clampedY = Math.max(0, Math.min(180, Math.round(smoothedY)));

          // 检查是否需要更新舵机位置
          const threshold = 2;
          if (
            Math.abs(clampedX - lastServoPositionRef.current.x) > threshold ||
            Math.abs(clampedY - lastServoPositionRef.current.y) > threshold
          ) {
            try {
              await invoke('set_servo_position', {
                x: clampedX,
                y: clampedY
              });
              lastServoPositionRef.current = { x: clampedX, y: clampedY };
            } catch (error) {
              logger.log(`Error setting servo position: ${error}`, 'ERROR', ModelName);
            }
          }
        }

        // 添加调试信息
        if (debug) {
          const debugInfo = faceDetectionServiceRef.current.getDebugInfo();
          if (debugInfo.performance) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(10, canvasSize.height - 70, 200, 60);
            ctx.fillStyle = '#ffffff';
            ctx.font = '12px Arial';
            ctx.fillText(`FPS: ${debugInfo.performance.fps}`, 20, canvasSize.height - 50);
            ctx.fillText(`Servo: (${lastServoPositionRef.current.x}°, ${lastServoPositionRef.current.y}°)`, 20, canvasSize.height - 30);
          }
        }
      }
    } catch (error) {
      logger.log(`Error processing video frame: ${error}`, 'ERROR', ModelName);
    }

    animationFrameRef.current = requestAnimationFrame(processVideoFrame);
  }, [canvasSize, onFaceDetected, debug]);

  // 修改 toggleCamera 函数
  const toggleCamera = useCallback(async (active: boolean) => {
    try {
      setIsLoading(true);
      setError(null);

      if (active) {
        if (!selectedCamera) {
          throw new Error('未选择摄像头');
        }

        // 初始化摄像头
        const stream = await initializeCamera(selectedCamera);

        // 初始化人脸检测服务
        if (!faceDetectionServiceRef.current) {
          faceDetectionServiceRef.current = new FaceDetectionService({
            scaleFactor: 1.1,
            minNeighbors: 5,
            minConfidence: 0.7,
            skipFrames: 2,
            shakeFilterSize: 30,
            smoothingFactor: 0.3
          });
        }

        await faceDetectionServiceRef.current.initialize(stream);
        setIsCameraActive(true);

        // 重置舵机位置到中心
        await invoke('set_servo_position', { x: 90, y: 90 });
        lastServoPositionRef.current = { x: 90, y: 90 };

        // 开始处理视频帧
        requestAnimationFrame(processVideoFrame);
      } else {
        // 停止视频处理
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }

        // 停止视频流
        if (currentStreamRef.current) {
          currentStreamRef.current.getTracks().forEach(track => track.stop());
          currentStreamRef.current = null;
        }

        // 清理视频元素
        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }

        // 清理人脸检测服务
        if (faceDetectionServiceRef.current) {
          faceDetectionServiceRef.current.dispose();
          faceDetectionServiceRef.current = null;
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
  }, [selectedCamera, initializeCamera, processVideoFrame]);







  // 选择摄像头
  const handleCameraSelect = useCallback(async (deviceId: string) => {
    if (deviceId === selectedCamera) return;

    try {
      // 如果摄像头正在运行，先停止
      if (isCameraActive) {
        await toggleCamera(false);
      }

      setSelectedCamera(deviceId);
      logger.log(`Selected camera: ${deviceId}`, 'INFO', ModelName);

      // 如果之前摄像头是开启的，选择新摄像头后自动开启
      if (isCameraActive) {
        await toggleCamera(true);
      }
    } catch (error) {
      logger.log(`Error selecting camera: ${error}`, 'ERROR', ModelName);
      setError('切换摄像头失败');
    }
  }, [selectedCamera, isCameraActive, toggleCamera]);

  // 初始化时获取摄像头列表
  useEffect(() => {
    fetchCameras();

    // 监听设备变化
    const handleDeviceChange = () => {
      fetchCameras();
    };

    if (navigator.mediaDevices?.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    }

    return () => {
      if (navigator.mediaDevices?.removeEventListener) {
        navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
      }

      // 清理资源
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      if (currentStreamRef.current) {
        currentStreamRef.current.getTracks().forEach(track => track.stop());
      }

      if (faceDetectionServiceRef.current) {
        faceDetectionServiceRef.current.dispose();
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

  // 渲染主界面 (摄像头已获得权限)
  return (
    <Card className="w-full">
      <CardContent className="p-6">
        {/* 摄像头控制栏 */}
        <div className="mb-4 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center space-x-4">
            {/* 摄像头选择下拉框 */}
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
                        {getCameraIcon(camera.type)}
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

            {/* 摄像头开关 */}
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

          {/* 刷新按钮 */}
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

        {/* 修改后的视频显示区域 */}
        <div className="relative rounded-lg overflow-hidden bg-gray-900"
          style={{
            width: '100%',
            paddingBottom: `${(canvasSize.height / canvasSize.width) * 100}%`
          }}>
          {/* 隐藏的video元素 */}
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            style={{ display: 'none' }}
          />

          {/* 渲染画布 */}
          <canvas
            ref={canvasRef}
            width={canvasSize.width}
            height={canvasSize.height}
            className="absolute top-0 left-0 w-full h-full object-contain"
          />

          {/* 状态覆盖层保持不变 */}
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

        {/* 调试信息区域 */}
        {debug && (
          <div className="mt-2 space-y-1 text-sm text-gray-500">
            {streamInfo && <div>{streamInfo}</div>}
            <div>Canvas Size: {canvasSize.width}x{canvasSize.height}</div>
            {videoRef.current && (
              <div>Video Size: {videoRef.current.videoWidth}x{videoRef.current.videoHeight}</div>
            )}
          </div>
        )}

        {/* 错误提示 */}
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
