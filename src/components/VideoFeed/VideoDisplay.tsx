import React, { useEffect, useRef } from 'react';
import { CameraOff, Camera } from "lucide-react";
import type { FaceDetectionResult } from '@/types/faceDetection';

interface VideoDisplayProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  isActive: boolean;
  isLoading: boolean;
  hasCameras: boolean;
  currentResult?: FaceDetectionResult | null;
  debug?: boolean;
  // 添加舵机位置的状态
  currentServoX?: number;
  currentServoY?: number;
  isLocked: boolean;
}

const VideoDisplay: React.FC<VideoDisplayProps> = ({
  videoRef,
  canvasRef,
  isActive,
  isLoading,
  hasCameras,
  currentResult,
  currentServoX = 90,
  currentServoY = 90,
  debug = false,
  isLocked
}) => {
  const drawRef = useRef<number>();
  const lastDrawnPosition = useRef<{x: number, y: number} | null>(null);

  const calculateScreenCoordinates = (servoX: number, servoY: number, canvas: HTMLCanvasElement) => {
    // 将舵机角度（0-180）转换为画布坐标
    const x = (servoX / 180) * canvas.width;
    const y = (servoY / 180) * canvas.height;
    return { x, y };
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    
    if (!canvas || !ctx) return;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 设置基本样式
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#FF0000';
      
      // 计算绘制位置 - 使用人脸检测结果或舵机位置
      let drawPosition: { x: number; y: number };
      let detectionActive = false;

      if (currentResult && currentResult.confidence > 0.7) {
        drawPosition = currentResult.position;
        detectionActive = true;
        lastDrawnPosition.current = drawPosition;
      } else if (lastDrawnPosition.current) {
        drawPosition = lastDrawnPosition.current;
      } else {
        drawPosition = calculateScreenCoordinates(currentServoX, currentServoY, canvas);
      }

      if (isActive) {
        // 绘制十字准星和辅助线
        ctx.beginPath();
        ctx.moveTo(0, drawPosition.y);
        ctx.lineTo(canvas.width, drawPosition.y);
        ctx.moveTo(drawPosition.x, 0);
        ctx.lineTo(drawPosition.x, canvas.height);
        ctx.stroke();

        // 绘制目标圈
        ctx.beginPath();
        ctx.arc(drawPosition.x, drawPosition.y, 80, 0, Math.PI * 2);
        ctx.stroke();

        // 设置状态文本样式
        ctx.font = '32px "Arial Black"';
        ctx.fillStyle = detectionActive ? '#FF00FF' : '#FF0000';
        // 状态文本
        const targetStatusText = detectionActive ? 'TARGET LOCKED' : 'NO TARGET';
        const textWidth = ctx.measureText(targetStatusText).width;
        ctx.fillText(targetStatusText, canvas.width - textWidth - 20, 40);

        // 绘制状态面板背景
        const statusText = [
          `Servo X: ${currentServoX.toFixed(1)}°`,
          `Servo Y: ${currentServoY.toFixed(1)}°`,
          `Status: ${isLocked ? 'Locked' : (detectionActive ? 'Tracking' : 'Searching')}`,
          ...(detectionActive && currentResult ? [
            `Confidence: ${(currentResult.confidence * 100).toFixed(1)}%`,
            `Size: ${currentResult.size.width.toFixed(0)}x${currentResult.size.height.toFixed(0)}`
          ] : [])
        ];

        // 状态面板背景
        const padding = 15;
        const lineHeight = 30;
        const boxWidth = 300;
        const boxHeight = (statusText.length * lineHeight) + (padding * 2);
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(10, 10, boxWidth, boxHeight);

        // 状态信息
        ctx.font = '20px "Arial"';
        statusText.forEach((text, index) => {
          const y = 35 + (index * lineHeight);
          
          // 根据内容类型选择颜色
          if (text.startsWith('Servo')) {
            ctx.fillStyle = '#00FFFF'; // 舵机信息
          } else if (text.includes('Confidence')) {
            ctx.fillStyle = '#00FF00'; // 置信度
          } else if (text.includes('Status')) {
            ctx.fillStyle = detectionActive ? '#00FF00' : '#FFA500'; // 状态
          } else {
            ctx.fillStyle = '#FFFFFF'; // 其他信息
          }
          
          ctx.fillText(text, 20, y);
        });

        // Debug信息
        if (debug && currentResult) {
          const debugInfo = [
            `X: ${drawPosition.x.toFixed(1)}`,
            `Y: ${drawPosition.y.toFixed(1)}`,
            `FPS: ${currentResult.fps ?? 0}`,
            `Process: ${currentResult.processingTime?.toFixed(1) ?? 0}ms`
          ];

          const debugBoxHeight = debugInfo.length * 25 + 20;
          ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
          ctx.fillRect(
            canvas.width - 200,
            canvas.height - debugBoxHeight,
            190,
            debugBoxHeight
          );

          ctx.font = '16px "Arial"';
          ctx.fillStyle = '#00FF00';
          debugInfo.forEach((text, i) => {
            ctx.fillText(
              text,
              canvas.width - 190,
              canvas.height - debugBoxHeight + 25 + (i * 22)
            );
          });
        }
      }

      drawRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (drawRef.current) {
        cancelAnimationFrame(drawRef.current);
      }
    };
  }, [canvasRef, currentResult, isActive, debug, currentServoX, currentServoY, isLocked]);

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