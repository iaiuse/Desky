// src/utils/videoUtils.ts

import { FaceDetectionResult } from '../types/faceDetection';
import { logger } from './logger';

const ModelName = 'VideoUtils';

export function detectCameraType(label: string): 'builtin' | 'external' | 'virtual' | 'unknown' {
  const lowerLabel = label.toLowerCase();
  if (lowerLabel.includes('built-in') || lowerLabel.includes('facetime') || lowerLabel.includes('正面')) {
    return 'builtin';
  }
  if (lowerLabel.includes('virtual') || lowerLabel.includes('obs') || lowerLabel.includes('虚拟')) {
    return 'virtual';
  }
  if (lowerLabel.includes('usb') || lowerLabel.includes('webcam') || lowerLabel.includes('hdmi')) {
    return 'external';
  }
  return 'unknown';
}

export function getCameraTypeLabel(type: string): string {
  const labels = {
    builtin: '内置摄像头',
    external: '外接摄像头',
    virtual: '虚拟摄像头',
    unknown: '未知摄像头'
  };
  return labels[type as keyof typeof labels];
}

export function getCameraIconStyle(type: string): string {
  const iconColors = {
    builtin: 'text-blue-500',
    external: 'text-green-500',
    virtual: 'text-purple-500',
    unknown: 'text-gray-500'
  };
  
  return `h-4 w-4 ${iconColors[type as keyof typeof iconColors]}`;
}


export function getCameraIcon(type: string): string {
  const icons = {
    builtin: '💻',
    external: '🔌',
    virtual: '🎬',
    unknown: '📷'
  };
  return icons[type as keyof typeof icons];
}

export function getErrorMessage(error: any): string {
  if (error.name === 'NotAllowedError') return '请允许访问摄像头';
  if (error.name === 'NotFoundError') return '未找到可用的摄像头设备';
  if (error.name === 'NotReadableError') return '摄像头可能被其他应用程序占用';
  if (error.name === 'OverconstrainedError') return '摄像头不支持请求的分辨率';
  if (error.name === 'TypeError') return '摄像头参数无效';
  return `获取摄像头失败: ${error.message || '未知错误'}`;
}

export function getPlaceholderText(isLoading: boolean, camerasCount: number): string {
  if (isLoading) return "正在加载摄像头...";
  if (camerasCount === 0) return "未找到摄像头";
  return "选择摄像头";
}

export function drawDetectionResult(
  ctx: CanvasRenderingContext2D, 
  result: FaceDetectionResult,
  debugInfo: boolean = false
): void {
  // 清除之前的绘制
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  // 绘制人脸框
  ctx.strokeStyle = `rgba(0, 255, 0, ${result.confidence})`;
  ctx.lineWidth = 2;
  ctx.strokeRect(
    result.position.x - result.size.width / 2,
    result.position.y - result.size.height / 2,
    result.size.width,
    result.size.height
  );

  // 绘制中心十字准线
  ctx.beginPath();
  ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
  ctx.moveTo(result.position.x - 15, result.position.y);
  ctx.lineTo(result.position.x + 15, result.position.y);
  ctx.moveTo(result.position.x, result.position.y - 15);
  ctx.lineTo(result.position.x, result.position.y + 15);
  ctx.stroke();

  // 绘制信息面板
  const padding = 10;
  const panelHeight = debugInfo ? 100 : 60;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fillRect(padding, padding, 200, panelHeight);
  
  ctx.fillStyle = 'white';
  ctx.font = '12px Arial';
  
  // 基本信息
  ctx.fillText(
    `位置: (${Math.round(result.position.x)}, ${Math.round(result.position.y)})`,
    padding + 10,
    padding + 20
  );
  ctx.fillText(
    `大小: ${Math.round(result.size.width)}x${Math.round(result.size.height)}`,
    padding + 10,
    padding + 40
  );
  ctx.fillText(
    `置信度: ${(result.confidence * 100).toFixed(1)}%`,
    padding + 10,
    padding + 60
  );

  // 调试信息
  if (debugInfo && result.processingTime) {
    ctx.fillText(
      `处理时间: ${result.processingTime.toFixed(1)}ms`,
      padding + 10,
      padding + 80
    );
  }
}

export function calculateFaceAngle(
  prevPosition: { x: number; y: number } | null,
  currentPosition: { x: number; y: number }
): number | null {
  if (!prevPosition) return null;
  
  const deltaX = currentPosition.x - prevPosition.x;
  const deltaY = currentPosition.y - prevPosition.y;
  return Math.atan2(deltaY, deltaX) * (180 / Math.PI);
}

export async function setupVideoStream(
  videoElement: HTMLVideoElement,
  deviceId: string,
  constraints?: MediaTrackConstraints
): Promise<MediaStream> {
  try {
    const defaultConstraints = {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 30 }
    };

    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        ...defaultConstraints,
        ...constraints,
        deviceId: { exact: deviceId }
      }
    });

    videoElement.srcObject = stream;
    await new Promise<void>((resolve, reject) => {
      videoElement.onloadedmetadata = () => {
        videoElement.play()
          .then(() => resolve())
          .catch(reject);
      };
      videoElement.onerror = () => reject(new Error('Failed to load video'));
    });

    logger.log('Video stream setup completed', 'INFO', ModelName);
    return stream;
  } catch (error) {
    logger.log(`Video stream setup failed: ${error}`, 'ERROR', ModelName);
    throw error;
  }
}

export function cleanupVideoStream(
  videoElement: HTMLVideoElement | null,
  stream: MediaStream | null
): void {
  try {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    if (videoElement) {
      videoElement.srcObject = null;
      videoElement.removeAttribute('src');
    }
  } catch (error) {
    logger.log(`Error cleaning up video stream: ${error}`, 'ERROR', ModelName);
  }
}

export async function checkVideoPlayback(video: HTMLVideoElement): Promise<boolean> {
  return new Promise((resolve) => {
    if (video.readyState === 4) {
      resolve(!video.paused);
      return;
    }

    const handleCanPlay = () => {
      video.removeEventListener('canplay', handleCanPlay);
      resolve(true);
    };

    const handleError = () => {
      video.removeEventListener('error', handleError);
      resolve(false);
    };

    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('error', handleError);
  });
}

// 视频流信息获取函数优化
export  function getVideoStreamInfo(stream: MediaStream): string {
  const videoTrack = stream.getVideoTracks()[0];
  const settings = videoTrack.getSettings();
  const capabilities = videoTrack.getCapabilities?.() || {};
  
  return `
    Track label: ${videoTrack.label}
    Resolution: ${settings.width}x${settings.height}
    Frame rate: ${settings.frameRate}fps
    ${capabilities ? `
    Capabilities:
      Width: ${capabilities.width?.min}-${capabilities.width?.max}
      Height: ${capabilities.height?.min}-${capabilities.height?.max}
      Frame rate: ${capabilities.frameRate?.min}-${capabilities.frameRate?.max}
    ` : ''}
  `.trim();
}