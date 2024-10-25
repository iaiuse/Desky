import { logger } from '../utils/logger';
import {  FaceSize } from '../types/faceDetection';

const ModelName = 'FaceDetectionUtils';

interface Point {
  x: number;
  y: number;
}

export class FaceDetectionUtils {
  private static readonly FACE_PADDING_THRESHOLD = 0.1;
  private static readonly FACE_SHAKE_FILTER_SIZE = 40;
  private static shakeFilterList: Array<{ position: Point, size: FaceSize }> = [];

  /**
   * 为人脸区域添加填充
   */
  static addPadding(
    position: Point,
    size: FaceSize,
    canvasWidth: number,
    canvasHeight: number,
    ratio: number = FaceDetectionUtils.FACE_PADDING_THRESHOLD
  ): { position: Point; size: FaceSize } {
    const padding = Math.min(canvasWidth, canvasHeight) * ratio;

    // 计算新的位置和大小，确保不超出画布范围
    const newPosition = {
      x: Math.max(position.x - padding, 0),
      y: Math.max(position.y - padding, 0)
    };

    const maxWidth = Math.min(size.width + 2 * padding, canvasWidth - newPosition.x);
    const maxHeight = Math.min(size.height + 2 * padding, canvasHeight - newPosition.y);

    // 确保框是正方形
    const sideLength = Math.min(maxWidth, maxHeight);

    return {
      position: newPosition,
      size: {
        width: sideLength,
        height: sideLength
      }
    };
  }

  /**
   * 应用防抖过滤
   */
  static applyShakeFilter(
    position: Point,
    size: FaceSize,
    filterSize: number = FaceDetectionUtils.FACE_SHAKE_FILTER_SIZE
  ): { position: Point; size: FaceSize } {
    // 更新历史记录
    if (this.shakeFilterList.length >= filterSize) {
      this.shakeFilterList.shift();
    }
    this.shakeFilterList.push({ position, size });

    // 计算平均值
    const sum = this.shakeFilterList.reduce(
      (prev, curr) => ({
        position: {
          x: prev.position.x + curr.position.x,
          y: prev.position.y + curr.position.y
        },
        size: {
          width: prev.size.width + curr.size.width,
          height: prev.size.height + curr.size.height
        }
      }),
      {
        position: { x: 0, y: 0 },
        size: { width: 0, height: 0 }
      }
    );

    const length = this.shakeFilterList.length;
    return {
      position: {
        x: sum.position.x / length,
        y: sum.position.y / length
      },
      size: {
        width: sum.size.width / length,
        height: sum.size.height / length
      }
    };
  }

  /**
   * 应用美颜效果
   */
  static applyBeautyEffect(cv: any, src: any): any {
    try {
      const dst = new cv.Mat();
      const dst2 = new cv.Mat();

      // 转换颜色空间并应用双边滤波
      cv.cvtColor(src, dst, cv.COLOR_RGBA2RGB);
      cv.bilateralFilter(dst, dst2, 4, 100, 10, 4);
      
      dst.delete();
      return dst2;
    } catch (error) {
      logger.log(`Error applying beauty effect: ${error}`, 'ERROR', ModelName);
      return src;
    }
  }

  /**
   * 清理防抖过滤器
   */
  static clearShakeFilter(): void {
    this.shakeFilterList = [];
  }
}