import React, { useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { logger } from '@/utils/logger';
import VideoDisplay from './VideoFeed/VideoDisplay';
import CameraControls from './VideoFeed/CameraControls';
import PermissionStatus from './VideoFeed/PermissionStatus';
import { useCamera } from '@/hooks/useCamera';
import type { FaceDetectionResult } from '@/types/faceDetection';

const ModelName = "VideoFeed";

interface VideoFeedProps {
  onFaceDetected: (result: FaceDetectionResult, canvasSize: { width: number, height: number }) => void;
  debug?: boolean;
}

const VideoFeed: React.FC<VideoFeedProps> = ({ onFaceDetected, debug = false }) => {
  const {
    isCameraActive,
    isLoading,
    error,
    streamInfo,
    cameras,
    selectedCamera,
    videoRef,
    canvasRef,
    permissionStatus,
    fetchCameras,
    toggleCamera,
    setSelectedCamera,
    handlePermissionGranted
  } = useCamera(onFaceDetected);

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
    }
  }, [selectedCamera, isCameraActive, toggleCamera, setSelectedCamera]);

  // 权限检查中或未获得权限时的渲染
  if (permissionStatus === 'checking' || permissionStatus !== 'granted') {
    return (
      <PermissionStatus
        status={permissionStatus}
        onPermissionGranted={handlePermissionGranted}
      />
    );
  }

  return (
    <Card className="w-full">
      <CardContent className="p-6">
        <CameraControls
          cameras={cameras}
          selectedCamera={selectedCamera}
          isLoading={isLoading}
          isCameraActive={isCameraActive}
          onCameraSelect={handleCameraSelect}
          onToggleCamera={toggleCamera}
          onRefresh={fetchCameras}
        />

        <VideoDisplay
          videoRef={videoRef}
          canvasRef={canvasRef}
          isActive={isCameraActive}
          isLoading={isLoading}
          hasCameras={cameras.length > 0}
        />

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