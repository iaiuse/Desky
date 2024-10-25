// src/components/VideoFeed/types.ts

import { FaceDetectionResult } from './faceDetection';

export interface VideoFeedProps {
  onFaceDetected: (result: FaceDetectionResult, canvasSize: { width: number, height: number }) => void;
  debug?: boolean;
}

export interface CameraDevice {
  deviceId: string;
  label: string;
  type: 'builtin' | 'external' | 'virtual' | 'unknown';
}

export type PermissionStatus = 'checking' | 'granted' | 'denied' | 'prompt';

export interface CameraControlsProps {
  cameras: CameraDevice[];
  selectedCamera: string | null;
  isLoading: boolean;
  isCameraActive: boolean;
  onCameraSelect: (deviceId: string) => void;
  onToggleCamera: (active: boolean) => void;
  onRefresh: () => void;
}

export interface VideoDisplayProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  isActive: boolean;
  isLoading: boolean;
  hasCameras: boolean;
}

export interface PermissionHandlerProps {
  onPermissionGranted: () => void;
}