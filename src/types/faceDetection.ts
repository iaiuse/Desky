// src/types/faceDetection.ts

export interface FacePosition {
  x: number;
  y: number;
}

export interface FaceSize {
  width: number;
  height: number;
}

export interface FaceDetectionResult {
  position: FacePosition;
  size: FaceSize;
  confidence: number;
  processingTime?: number;
  angle?: number;
  fps?: number;
}

export interface FaceDetectionOptions {
  // 人脸检测参数
  scaleFactor?: number;       // 缩放因子
  minNeighbors?: number;      // 最小邻居数
  minSize?: number;           // 最小人脸尺寸
  maxSize?: number;           // 最大人脸尺寸
  minConfidence?: number;     // 最小置信度阈值 (添加这个选项)

  // 性能优化参数
  pyramidScale?: number;      // 图像金字塔缩放比例
  useImagePyramid?: boolean;  // 是否使用图像金字塔
  skipFrames?: number;        // 跳帧数量
  
  // 防抖参数
  shakeFilterSize?: number;   // 平滑滤波器大小
  smoothingFactor?: number;   // 平滑系数 (0-1)
  maxHistorySize?: number;    // 历史记录最大长度
  
  // 美颜参数
  beautyLevel?: number;       // 美颜程度 (0-1)
  brightnessAdjust?: number; // 亮度调整
}

export class FaceDetectionError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = 'FaceDetectionError';
  }
}

export interface VideoSize {
  width: number;
  height: number;
}