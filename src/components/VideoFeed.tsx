import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {  CameraOff } from "lucide-react";
import { invoke } from '@tauri-apps/api/tauri';
import { logger } from '../utils/logger';

const ModelName = "VideoFeed";

interface VideoFeedProps {
  onFaceDetected: (facePosition: { x: number, y: number }, canvasSize: { width: number, height: number }) => void;
}

interface CameraInfo {
  index: number;
  name: string;
  description?: string;
}

const VideoFeed: React.FC<VideoFeedProps> = ({ onFaceDetected }) => {
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [canvasSize] = useState({ width: 640, height: 480 });
  const [cameras, setCameras] = useState<CameraInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const fetchCameras = useCallback(async () => {
    logger.log('Fetching available cameras', 'INFO', ModelName);
    try {
      const availableCameras: CameraInfo[] = await invoke('get_available_cameras');
      setCameras(availableCameras);
      logger.log(`Found ${availableCameras.length} cameras`, 'INFO', ModelName);
      if (availableCameras.length > 0 && selectedCamera === null) {
        setSelectedCamera(availableCameras[0].index);
        logger.log(`Auto-selected camera with index ${availableCameras[0].index}`, 'INFO', ModelName);
      }
    } catch (error) {
      logger.log(`Error fetching cameras: ${error}`, 'ERROR', ModelName);
      setError('Failed to fetch available cameras.');
    }
  }, [selectedCamera]);

  const selectCamera = useCallback(async (index: number) => {
    logger.log(`Attempting to select camera with index ${index}`, 'INFO', ModelName);
    try {
      await invoke('select_camera', { index });
      setSelectedCamera(index);
      setError(null);
      logger.log(`Successfully selected camera with index ${index}`, 'INFO', ModelName);
    } catch (error) {
      logger.log(`Error selecting camera: ${error}`, 'ERROR', ModelName);
      setError('Failed to select camera.');
    }
  }, []);

  const toggleCamera = useCallback(async (active: boolean) => {
    logger.log(`Attempting to ${active ? 'activate' : 'deactivate'} camera`, 'INFO', ModelName);
    try {
      await invoke('toggle_camera', { active });
      setIsCameraActive(active);
      setError(null);
      logger.log(`Camera successfully ${active ? 'activated' : 'deactivated'}`, 'INFO', ModelName);
    } catch (error) {
      logger.log(`Error toggling camera: ${error}`, 'ERROR', ModelName);
      setError('Failed to toggle camera.');
    }
  }, []);

  useEffect(() => {
    fetchCameras();
  }, [fetchCameras]);

  useEffect(() => {
    if (!isCameraActive) return;

    logger.log('Starting face detection interval', 'INFO', ModelName);
    const interval = setInterval(async () => {
      try {
        const facePosition: [number, number] | null = await invoke('get_face_position');
        if (facePosition && canvasRef.current) {
          const ctx = canvasRef.current.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);
            ctx.fillStyle = 'red';
            ctx.beginPath();
            ctx.arc(facePosition[0], facePosition[1], 5, 0, 2 * Math.PI);
            ctx.fill();
          }
          logger.log(`Face detected at position: (${facePosition[0]}, ${facePosition[1]})`, 'INFO', ModelName);
          onFaceDetected(
            { x: facePosition[0], y: facePosition[1] },
            canvasSize
          );
        }
      } catch (error) {
        logger.log(`Error getting face position: ${error}`, 'ERROR', ModelName);
      }
    }, 100);

    return () => {
      clearInterval(interval);
      logger.log('Face detection interval cleared', 'INFO', ModelName);
    };
  }, [isCameraActive, onFaceDetected, canvasSize]);

  return (
    <Card>
      <CardContent className="p-6">
        <div className="mb-4 flex items-center space-x-4">
          <div className="w-48">
            <Select
              value={selectedCamera?.toString() || ''}
              onValueChange={(value) => selectCamera(parseInt(value, 10))}
              disabled={isCameraActive}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select camera" />
              </SelectTrigger>
              <SelectContent>
                {cameras.map((camera) => (
                  <SelectItem key={camera.index} value={camera.index.toString()}>
                    {camera.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium">Camera</span>
            <Switch
              checked={isCameraActive}
              onCheckedChange={toggleCamera}
              disabled={selectedCamera === null}
            />
          </div>
          <Button onClick={fetchCameras} disabled={isCameraActive} size="sm">
            Refresh
          </Button>
        </div>
        
        <div className="relative w-full h-[360px] bg-gray-100 rounded-lg flex items-center justify-center">
          {isCameraActive ? (
            <canvas ref={canvasRef} width={canvasSize.width} height={canvasSize.height} className="absolute top-0 left-0" />
          ) : (
            <div className="text-center">
              <CameraOff className="mx-auto mb-2" size={48} />
              <p>Camera inactive</p>
            </div>
          )}
        </div>
        
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