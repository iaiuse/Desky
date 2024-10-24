import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CameraOff, Camera, RefreshCw } from "lucide-react";
import {
  detectCameraType,
  getCameraTypeLabel,
  getCameraIcon,
  getErrorMessage,
  getPlaceholderText,
  getVideoStreamInfo
} from '../utils/videoUtils';

interface VideoFeedProps {
  onVideoFrame?: (videoElement: HTMLVideoElement) => void;
}

interface CameraDevice {
  deviceId: string;
  label: string;
  type: 'builtin' | 'external' | 'virtual' | 'unknown';
}

const VideoFeed: React.FC<VideoFeedProps> = ({ onVideoFrame }) => {
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamInfo, setStreamInfo] = useState<string>('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const fetchCameras = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
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
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, [selectedCamera]);

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
        setStreamInfo(getVideoStreamInfo(stream));
      }

      streamRef.current = stream;
      return stream;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }, []);

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
      setError(error instanceof Error ? error.message : '摄像头控制失败');
      setIsCameraActive(false);
    } finally {
      setIsLoading(false);
    }
  }, [selectedCamera, initializeCamera]);

  const handleCameraSelect = useCallback(async (deviceId: string) => {
    if (deviceId === selectedCamera) return;

    try {
      if (isCameraActive) {
        await toggleCamera(false);
      }
      setSelectedCamera(deviceId);
      if (isCameraActive) {
        await toggleCamera(true);
      }
    } catch (error) {
      setError('切换摄像头失败');
    }
  }, [selectedCamera, isCameraActive, toggleCamera]);

  useEffect(() => {
    fetchCameras();

    const handleDeviceChange = () => {
      fetchCameras();
    };

    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);

    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [fetchCameras]);

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
                        {camera.type === 'builtin' && <Camera className="h-4 w-4 text-blue-500" />}
                        {camera.type === 'external' && <Camera className="h-4 w-4 text-green-500" />}
                        {camera.type === 'virtual' && <Camera className="h-4 w-4 text-purple-500" />}
                        {camera.type === 'unknown' && <Camera className="h-4 w-4 text-gray-500" />}
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {getCameraTypeLabel(camera.type)}
                          </span>
                          <span className="text-xs text-gray-500">
                            {camera.label}
                          </span>
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

        {streamInfo && (
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