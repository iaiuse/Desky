import React, { useEffect, useRef } from 'react';
import { CameraOff, Camera } from "lucide-react";
import { drawDetectionResult } from '@/utils/videoUtils';
import type { FaceDetectionResult } from '@/types/faceDetection';

interface VideoDisplayProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  isActive: boolean;
  isLoading: boolean;
  hasCameras: boolean;
  currentResult?: FaceDetectionResult | null;
  debug?: boolean;
}

const VideoDisplay: React.FC<VideoDisplayProps> = ({
  videoRef,
  canvasRef,
  isActive,
  isLoading,
  hasCameras,
  currentResult,
  debug = false
}) => {
  const drawRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    
    if (!canvas || !ctx) return;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (isActive && currentResult) {
        // 绘制十字准星和目标框
        const { position } = currentResult;
        
        // 绘制辅助线
        ctx.strokeStyle = '#FF0000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, position.y);
        ctx.lineTo(canvas.width, position.y);
        ctx.moveTo(position.x, 0);
        ctx.lineTo(position.x, canvas.height);
        ctx.stroke();

        // 绘制目标圈
        ctx.beginPath();
        ctx.arc(position.x, position.y, 80, 0, Math.PI * 2);
        ctx.stroke();

        // 绘制 TARGET LOCKED 文本
        ctx.font = '24px Arial';
        ctx.fillStyle = '#FF00FF';
        ctx.fillText('TARGET LOCKED', canvas.width - 200, 50);

        // 显示舵机角度
        const servoX = Math.round((position.x / canvas.width) * 180);
        const servoY = Math.round((position.y / canvas.height) * 180);
        
        ctx.font = '16px Arial';
        ctx.fillStyle = '#0000FF';
        ctx.fillText(`Servo X: ${servoX} deg`, 10, 30);
        ctx.fillText(`Servo Y: ${servoY} deg`, 10, 60);

        // 使用 drawDetectionResult 绘制调试信息
        if (debug) {
          drawDetectionResult(ctx, currentResult, true);
        }
      } else if (isActive) {
        // 绘制默认的十字准星
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;

        ctx.strokeStyle = '#FF0000';
        ctx.lineWidth = 2;
        
        // 绘制十字线
        ctx.beginPath();
        ctx.moveTo(0, centerY);
        ctx.lineTo(canvas.width, centerY);
        ctx.moveTo(centerX, 0);
        ctx.lineTo(centerX, canvas.height);
        ctx.stroke();

        // 绘制中心圆圈
        ctx.beginPath();
        ctx.arc(centerX, centerY, 80, 0, Math.PI * 2);
        ctx.stroke();

        // 绘制 NO TARGET 文本
        ctx.font = '24px Arial';
        ctx.fillStyle = '#FF0000';
        ctx.fillText('NO TARGET', canvas.width - 180, 50);

        // 显示默认舵机角度
        ctx.font = '16px Arial';
        ctx.fillStyle = '#0000FF';
        ctx.fillText('Servo X: 90 deg', 10, 30);
        ctx.fillText('Servo Y: 90 deg', 10, 60);
      }

      drawRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (drawRef.current) {
        cancelAnimationFrame(drawRef.current);
      }
    };
  }, [canvasRef, currentResult, isActive, debug]);

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