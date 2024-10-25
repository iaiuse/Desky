import React from 'react';
import { CameraOff, Camera } from "lucide-react";

interface VideoDisplayProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  isActive: boolean;
  isLoading: boolean;
  hasCameras: boolean;
}

const VideoDisplay: React.FC<VideoDisplayProps> = ({
  videoRef,
  canvasRef,
  isActive,
  isLoading,
  hasCameras
}) => {
  return (
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
        className="absolute top-0 left-0 w-full h-full pointer-events-none"
      />

      {!isActive && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="text-center text-white">
            <CameraOff className="mx-auto mb-2" size={48} />
            <p>{!hasCameras ? "未找到摄像头" : "摄像头未启动"}</p>
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
  );
};

export default VideoDisplay;