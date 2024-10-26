// src/utils/cameraUtils.ts

import { logger } from './logger';

const ModelName = 'CameraUtils';

interface WebGLContextOptions {
  alpha?: boolean;
  antialias?: boolean;
  depth?: boolean;
  failIfMajorPerformanceCaveat?: boolean;
  powerPreference?: 'default' | 'high-performance' | 'low-power';
  premultipliedAlpha?: boolean;
  preserveDrawingBuffer?: boolean;
  stencil?: boolean;
}

export async function initializeWebGL(canvas: HTMLCanvasElement): Promise<WebGLRenderingContext> {
  logger.log('Initializing WebGL context...', 'INFO', ModelName);

  const contextOptions: WebGLContextOptions[] = [
    {
      alpha: false,
      antialias: false,
      depth: false,
      failIfMajorPerformanceCaveat: false,
      powerPreference: 'high-performance',
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      stencil: false
    },
    {
      alpha: true,
      antialias: true,
      depth: true,
      powerPreference: 'default'
    },
    {}
  ];

  let gl: WebGLRenderingContext | null = null;

  for (const options of contextOptions) {
    try {
      const context = canvas.getContext('webgl', options) || 
                     canvas.getContext('experimental-webgl', options);
      if (context instanceof WebGLRenderingContext || context instanceof WebGL2RenderingContext) {
        gl = context as WebGLRenderingContext;
        logger.log('Successfully created WebGL context', 'INFO', ModelName);
        break;
      }
    } catch (e) {
      logger.log(`Failed to create WebGL context with options: ${JSON.stringify(options)}`, 'WARN', ModelName);
    }
  }

  if (!gl) {
    throw new Error('Failed to initialize WebGL context');
  }

  return gl;
}

export async function getOptimalVideoConstraints(deviceId: string): Promise<MediaTrackConstraints> {
  logger.log('Getting optimal video constraints...', 'INFO', ModelName);

  // 按优先级排序的分辨率选项
  const resolutionOptions = [
    { width: 1280, height: 720 },
    { width: 960, height: 540 },
    { width: 640, height: 480 },
    { width: 480, height: 360 },
    {}  // 最后使用默认值
  ];

  // 按优先级排序的帧率选项
  const frameRateOptions = [
    { ideal: 30 },
    { ideal: 24 },
    { ideal: 15 },
    {}  // 最后使用默认值
  ];

  for (const resolution of resolutionOptions) {
    for (const frameRate of frameRateOptions) {
      const constraints: MediaTrackConstraints = {
        deviceId: { exact: deviceId },
        ...resolution,
        frameRate
      };

      try {
        // 测试这些约束是否可用
        const stream = await navigator.mediaDevices.getUserMedia({ video: constraints });
        stream.getTracks().forEach(track => track.stop());

        logger.log(`Found working constraints: ${JSON.stringify(constraints)}`, 'INFO', ModelName);
        return constraints;
      } catch (e) {
        logger.log(`Constraints not supported: ${JSON.stringify(constraints)}`, 'WARN', ModelName);
      }
    }
  }

  // 如果所有选项都失败，返回最基本的约束
  return {
    deviceId: { exact: deviceId }
  };
}

export async function setupVideoProcessing(video: HTMLVideoElement, deviceId: string): Promise<MediaStream> {
  logger.log('Setting up video processing...', 'INFO', ModelName);

  try {
    const constraints = await getOptimalVideoConstraints(deviceId);
    const stream = await navigator.mediaDevices.getUserMedia({ video: constraints });

    video.srcObject = stream;
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error('Video loading failed'));
    });

    logger.log('Video processing setup complete', 'INFO', ModelName);
    return stream;
  } catch (error) {
    logger.log(`Error in video processing setup: ${error}`, 'ERROR', ModelName);
    throw error;
  }
}

// cameraUtils.ts

export function checkWebGLSupport(): boolean {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  const hasWebGL = !!gl;
  if (gl) {
    (gl as WebGLRenderingContext).getExtension('WEBGL_lose_context')?.loseContext();
  }
  return hasWebGL;
}

export function getVideoPerformanceInfo(stream: MediaStream): Record<string, any> {
  const videoTrack = stream.getVideoTracks()[0];
  const settings = videoTrack.getSettings();
  const capabilities = videoTrack.getCapabilities();

  return {
    settings,
    capabilities,
    constraints: videoTrack.getConstraints()
  };
}
