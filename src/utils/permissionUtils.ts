// src/utils/permissionUtils.ts

import { logger } from './logger';

const ModelName = 'PermissionUtils';

export type PermissionState = 'prompt' | 'granted' | 'denied' | 'unsupported';

export class PermissionError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'PermissionError';
  }
}

export interface PermissionResult {
  state: PermissionState;
  error?: string;
  stream?: MediaStream;
}

export class PermissionManager {
  private static instance: PermissionManager;
  private permissionState: PermissionState = 'prompt';
  private listeners: Set<(state: PermissionState) => void> = new Set();
  private currentStream: MediaStream | null = null;
  private checkingPromise: Promise<PermissionResult> | null = null;

  private constructor() {
    this.setupPermissionChangeListener();
  }

  static getInstance(): PermissionManager {
    if (!PermissionManager.instance) {
      PermissionManager.instance = new PermissionManager();
    }
    return PermissionManager.instance;
  }

  private async setupPermissionChangeListener() {
    try {
      if ('permissions' in navigator) {
        const permission = await navigator.permissions.query({ name: 'camera' as PermissionName });
        permission.addEventListener('change', () => {
          this.updatePermissionState(permission.state as PermissionState);
        });
      }
    } catch (error) {
      logger.log(`Failed to setup permission listener: ${error}`, 'ERROR', ModelName);
    }
  }

  private updatePermissionState(state: PermissionState) {
    if (this.permissionState !== state) {
      this.permissionState = state;
      this.notifyListeners();
      this.persistPermissionState();
    }
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.permissionState));
  }

  private persistPermissionState() {
    try {
      localStorage.setItem('camera-permission', this.permissionState);
    } catch (error) {
      logger.log(`Failed to persist permission state: ${error}`, 'ERROR', ModelName);
    }
  }

  async checkPermission(): Promise<PermissionResult> {
    // 如果已经在检查中，返回现有的 Promise
    if (this.checkingPromise) {
      return this.checkingPromise;
    }

    this.checkingPromise = this._checkPermission();
    try {
      const result = await this.checkingPromise;
      return result;
    } finally {
      this.checkingPromise = null;
    }
  }

  private async _checkPermission(): Promise<PermissionResult> {
    logger.log('Checking camera permission', 'INFO', ModelName);

    // 如果已经有权限且有流，直接返回
    if (this.permissionState === 'granted' && this.currentStream) {
      return { state: 'granted', stream: this.currentStream };
    }

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        this.updatePermissionState('unsupported');
        return { 
          state: 'unsupported',
          error: '您的浏览器不支持所需的摄像头API' 
        };
      }

      if ('permissions' in navigator) {
        const permission = await navigator.permissions.query({ name: 'camera' as PermissionName });
        
        if (permission.state === 'granted') {
          const stream = await this.requestPermission();
          return { state: 'granted', stream };
        }
        
        this.updatePermissionState(permission.state as PermissionState);
        return { state: permission.state as PermissionState };
      }

      // 如果不支持权限API，尝试直接请求摄像头
      const stream = await this.requestPermission();
      return { state: 'granted', stream };

    } catch (error) {
      logger.log(`Permission check error: ${error}`, 'ERROR', ModelName);
      return { 
        state: 'denied',
        error: '检查权限时发生错误' 
      };
    }
  }

  async requestPermission(): Promise<MediaStream> {
    logger.log('Requesting camera permission', 'INFO', ModelName);

    try {
      // 如果已经有流，先停止它
      if (this.currentStream) {
        this.currentStream.getTracks().forEach(track => track.stop());
        this.currentStream = null;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user"
        } 
      });

      this.currentStream = stream;
      this.updatePermissionState('granted');
      logger.log('Camera permission granted', 'INFO', ModelName);
      return stream;
    } catch (error) {
      this.updatePermissionState('denied');
      logger.log(`Camera permission denied: ${error}`, 'ERROR', ModelName);
      throw new PermissionError(
        '无法访问摄像头，请确保已授予权限',
        'PERMISSION_DENIED'
      );
    }
  }

  async stopStream() {
    if (this.currentStream) {
      this.currentStream.getTracks().forEach(track => track.stop());
      this.currentStream = null;
    }
  }

  addListener(listener: (state: PermissionState) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getCurrentState(): PermissionState {
    return this.permissionState;
  }

  async initialize(): Promise<void> {
    logger.log('Initializing permission manager', 'INFO', ModelName);
    
    // 从本地存储恢复权限状态
    const savedState = localStorage.getItem('camera-permission') as PermissionState;
    if (savedState) {
      this.permissionState = savedState;
    }

    // 验证保存的状态是否仍然有效
    await this.checkPermission();
  }
}

export const permissionManager = PermissionManager.getInstance();