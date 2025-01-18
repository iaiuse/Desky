declare global {
  interface Window {
    CryptoJS: any;
    WebRecorder: any;
    SpeechRecognizer: any;
  }
}

import { logger } from '../utils/logger';
import { db } from './db';

const ModelName = 'VoiceRecognitionService';

// 添加脚本路径常量
const SCRIPT_PATHS = {
  CRYPTO_JS: '/src/lib/tencent/asr/CryptoJS.js',
  SPEECH_RECOGNIZER: '/src/lib/tencent/asr/speechrecognizer.js'
} as const;

interface VoiceRecognitionConfig {
  secretId: string;
  secretKey: string;
  appId: string;
}

// Event types for voice recognition
type VoiceRecognitionEvent = {
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (error: Error) => void;
  onReconnecting?: () => void;
  onReconnected?: () => void;
  onComplete?: (finalText: string) => void;
};

class VoiceRecognitionService {
  private speechRecognizer: any = null;
  private config: VoiceRecognitionConfig | null = null;
  private onResultCallback: ((text: string) => void) | null = null;
  private events: VoiceRecognitionEvent = {};
  private recorder: any = null;
  private isCanSendData: boolean = false;
  private scriptsLoaded: boolean = false;
  private retryCount: number = 0;
  private maxRetries: number = 3;
  private retryDelay: number = 2000; // 2 seconds
  private finalResult: string = '';

  constructor() {
    this.config = null;
  }

  private async loadScripts(): Promise<void> {
    if (this.scriptsLoaded) return;

    const scripts = [
      SCRIPT_PATHS.CRYPTO_JS,
      SCRIPT_PATHS.SPEECH_RECOGNIZER
    ];

    try {
      for (const script of scripts) {
        await new Promise((resolve, reject) => {
          const scriptElement = document.createElement('script');
          scriptElement.src = script;
          scriptElement.onload = resolve;
          scriptElement.onerror = () => reject(new Error(`Failed to load ${script}`));
          document.head.appendChild(scriptElement);
        });
      }
      this.scriptsLoaded = true;
      logger.log('Voice recognition scripts loaded successfully', 'INFO', ModelName);
    } catch (error) {
      logger.log(`Error loading voice recognition scripts: ${error}`, 'ERROR', ModelName);
      throw new Error('Failed to load required voice recognition scripts');
    }
  }

  public async initialize(_config?: VoiceRecognitionConfig) {
    try {
      // 首先加载必要的脚本
      await this.loadScripts();

      // Use provided config if available
      if (_config) {
        this.config = _config;
        logger.log('Voice recognition initialized with provided config', 'INFO', ModelName);
        return;
      }

      // Get config from database
      const secretId = await db.settings.get('tencent_asr_secretId');
      const secretKey = await db.settings.get('tencent_asr_secretKey');
      const appId = await db.settings.get('tencent_asr_appId');

      if (!secretId?.value || !secretKey?.value || !appId?.value) {
        throw new Error('请在设置面板中配置腾讯语音识别服务（SecretId、SecretKey和AppId）');
      }

      this.config = {
        secretId: secretId.value,
        secretKey: secretKey.value,
        appId: appId.value
      };
      
      logger.log('Voice recognition initialized with database config', 'INFO', ModelName);
    } catch (error) {
      logger.log(`Error initializing voice recognition: ${error}`, 'ERROR', ModelName);
      throw error;
    }
  }

  private signCallback(signStr: string): string {
    if (!this.config) throw new Error('Config not initialized');
    
    const hash = window.CryptoJS.HmacSHA1(signStr, this.config.secretKey);
    const bytes = this.uint8ArrayToString(this.toUint8Array(hash));
    return window.btoa(bytes);
  }

  private toUint8Array(wordArray: any): Uint8Array {
    const words = wordArray.words;
    const sigBytes = wordArray.sigBytes;
    const u8 = new Uint8Array(sigBytes);
    for (let i = 0; i < sigBytes; i++) {
      u8[i] = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
    }
    return u8;
  }

  private uint8ArrayToString(fileData: Uint8Array): string {
    let dataString = '';
    for (let i = 0; i < fileData.length; i++) {
      dataString += String.fromCharCode(fileData[i]);
    }
    return dataString;
  }

  public async start(onResult: (text: string) => void): Promise<void> {
    try {
      if (!this.scriptsLoaded) {
        await this.loadScripts();
      }

      if (!this.config) {
        await this.initialize();
      }

      if (!this.config) {
        throw new Error('Voice recognition service initialization failed');
      }

      this.onResultCallback = onResult;
      this.retryCount = 0;

      await this.initializeRecognition();

    } catch (error) {
      logger.log(`Error starting voice recognition: ${error}`, 'ERROR', ModelName);
      throw error;
    }
  }

  private async initializeRecognition(): Promise<void> {
    const params = {
      signCallback: this.signCallback.bind(this),
      secretid: this.config!.secretId,
      appid: this.config!.appId,
      engine_model_type: '16k_zh',
      voice_format: 1,
      needvad: 1,
      filter_dirty: 1,
      filter_modal: 2,
      filter_punc: 0,
      convert_num_mode: 1,
      word_info: 2
    };

    if (typeof window.WebRecorder === 'undefined') {
      throw new Error('WebRecorder not loaded. Please check script loading.');
    }

    // Initialize recorder
    this.recorder = new window.WebRecorder();
    this.recorder.OnReceivedData = (res: any) => {
      if (this.isCanSendData && this.speechRecognizer) {
        this.speechRecognizer.write(res);
      }
    };

    this.recorder.OnError = (err: any) => {
      logger.log(`Recorder error: ${err}`, 'ERROR', ModelName);
      this.handleError(new Error(`Recorder error: ${err}`));
    };

    // Initialize speech recognizer
    this.speechRecognizer = new window.SpeechRecognizer(params);
    this.finalResult = '';

    this.speechRecognizer.OnRecognitionStart = () => {
      logger.log('Recognition started', 'INFO', ModelName);
      this.isCanSendData = true;
      this.retryCount = 0;
      this.events.onConnected?.();
    };

    this.speechRecognizer.OnRecognitionResultChange = (res: any) => {
      if (res.result.voice_text_str) {
        this.finalResult = res.result.voice_text_str;
        // 实时回调中间结果，但不触发提交
        this.onResultCallback?.(this.finalResult);
      }
    };

    this.speechRecognizer.OnRecognitionComplete = () => {
      logger.log('Recognition completed successfully', 'INFO', ModelName);
      
      if (this.finalResult) {
        // 识别完成时，用最终结果触发回调并标记可以提交
        this.onResultCallback?.(this.finalResult);
        this.events.onComplete?.(this.finalResult);
      }
      
      // 不要在这里自动停止，让用户控制停止时机
      // this.stop();
    };

    this.speechRecognizer.OnError = (error: any) => {
      // 检查是否是正常的结束信号
      if (error instanceof Event && error.type === 'close') {
        // 正常关闭的WebSocket连接，不需要特殊处理
        return;
      }
      
      // 真正的错误情况
      this.handleError(error);
    };

    // Start recording and recognition
    this.recorder.start();
    this.speechRecognizer.start();
  }

  private async handleError(error: any): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.log(`Recognition error: ${typeof errorMessage === 'object' ? JSON.stringify(errorMessage) : errorMessage}`, 'ERROR', ModelName);
    
    this.isCanSendData = false;
    
    // Check if we should retry
    if (this.retryCount < this.maxRetries) {
      this.retryCount++;
      logger.log(`Attempting retry ${this.retryCount} of ${this.maxRetries}...`, 'INFO', ModelName);
      
      this.events.onReconnecting?.();
      
      // Clean up existing instances
      await this.stop();
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, this.retryDelay));
      
      try {
        await this.initializeRecognition();
        this.events.onReconnected?.();
        return;
      } catch (retryError) {
        logger.log(`Retry ${this.retryCount} failed: ${retryError}`, 'ERROR', ModelName);
      }
    }

    // If we've exhausted retries or immediate error handling is needed
    this.events.onError?.(new Error(errorMessage));
  }

  public async stop(): Promise<void> {
    try {
      if (this.recorder) {
        this.recorder.stop();
        this.recorder = null;
      }

      if (this.speechRecognizer) {
        this.speechRecognizer.stop();
        this.speechRecognizer = null;
      }

      this.isCanSendData = false;
      this.onResultCallback = null;
      this.finalResult = '';  // 清除最终结果

      logger.log('Voice recognition stopped successfully', 'INFO', ModelName);
    } catch (error) {
      logger.log(`Error stopping voice recognition: ${error}`, 'ERROR', ModelName);
      throw error;
    }
  }

  public addEventListener(events: VoiceRecognitionEvent & {
    onComplete?: (finalText: string) => void;
  }) {
    this.events = { ...this.events, ...events };
  }

  public removeEventListener() {
    this.events = {};
  }
}

export const voiceRecognitionService = new VoiceRecognitionService(); 