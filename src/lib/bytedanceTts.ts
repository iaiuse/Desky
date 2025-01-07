import { db } from './db';
import { logger } from '../utils/logger';
import { invoke } from '@tauri-apps/api/tauri';
import { nanoid } from 'nanoid';

const ModelName = "ByteDanceTTSService";

interface TTSSettings {
  baseUrl: string;
  appId: string;
  token: string;
  cluster: string;
}

interface TTSRequest {
  app: {
    appid: string;
    token: string;
    cluster: string;
  };
  user: {
    uid: string;
  };
  audio: {
    voice_type: string;
    encoding: string;
    speed_ratio: number;
  };
  request: {
    reqid: string;
    text: string;
    operation: string;
  };
}

interface TTSResponse {
  reqid: string;
  code: number;
  message: string;
  sequence: number;
  data: string;
  addition: {
    duration: string;
  };
}

type Language = 0 | 1 | 2 | 3 | 4 | 5;

interface UploadOptions {
  language: Language;
  modelType: number;
  textValidation?: string;
  noiseReduction: boolean;
  volumeNormalization: boolean;
}

async function getTTSSettings(): Promise<TTSSettings> {
  const baseUrl = await db.settings.get('bytedance_tts_baseUrl');
  const appId = await db.settings.get('bytedance_tts_appId');
  const token = await db.settings.get('bytedance_tts_token');
  const cluster = await db.settings.get('bytedance_tts_cluster');

  if (!baseUrl?.value || !appId?.value || !token?.value || !cluster?.value) {
    logger.log('ByteDance TTS settings not found', 'ERROR', ModelName);
    throw new Error('ByteDance TTS settings not found');
  }

  return {
    baseUrl: baseUrl.value,
    appId: appId.value,
    token: token.value,
    cluster: cluster.value
  };
}

export async function generateSpeech(text: string, voiceId: string): Promise<ArrayBuffer> {
  try {
    logger.log(`Generating speech for text: ${text}`, 'INFO', ModelName);
    const settings = await getTTSSettings();

    const reqId = nanoid();
    
    const requestBody: TTSRequest = {
      app: {
        appid: settings.appId,
        token: settings.token,
        cluster: settings.cluster
      },
      user: {
        uid: reqId
      },
      audio: {
        voice_type: voiceId,
        encoding: 'mp3',
        speed_ratio: 1.0
      },
      request: {
        reqid: reqId,
        text: text,
        operation: 'query'
      }
    };

    const response = await invoke<string>('proxy_request', {
      targetUrl: `${settings.baseUrl}/api/v1/tts`,
      method: 'POST',
      body: Array.from(new TextEncoder().encode(JSON.stringify(requestBody)))
    });

    const result: TTSResponse = JSON.parse(response);
    
    if (result.code !== 3000) {
      throw new Error(`TTS error: ${result.message}`);
    }

    // 将base64编码的音频数据转换为ArrayBuffer
    const binaryString = atob(result.data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    logger.log(`Speech generated successfully, duration: ${result.addition.duration}ms`, 'INFO', ModelName);
    return bytes.buffer;

  } catch (error) {
    logger.log(`Error generating speech: ${error}`, 'ERROR', ModelName);
    throw error;
  }
}

export async function uploadAudioFile(
  file: File,
  options: UploadOptions
): Promise<string> {
  try {
    logger.log(`Uploading file: ${file.name}`, 'INFO', ModelName);
    const settings = await getTTSSettings();
    
    const requestData = {
      speaker_id: nanoid(),
      appid: settings.appId,
      audios: [{
        audio_bytes: await fileToBase64(file),
        audio_format: file.name.split('.').pop() || 'wav'
      }],
      source: 2,
      model_type: options.modelType
    };

    const response = await invoke<string>('proxy_request', {
      targetUrl: `${settings.baseUrl}/api/v1/mega_tts/audio/upload`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer;${settings.token}`,
        'Resource-Id': 'volc.megatts.voiceclone',
        'Content-Type': 'application/json'
      },
      body: Array.from(new TextEncoder().encode(JSON.stringify(requestData)))
    });

    const result = JSON.parse(response);
    
    if (result.BaseResp?.StatusCode === 0) {
      logger.log(`File upload successful, speaker_id: ${result.speaker_id}`, 'INFO', ModelName);
      return result.speaker_id;
    } else {
      throw new Error(result.BaseResp?.StatusMessage || 'Unknown error');
    }
  } catch (error) {
    logger.log(`File upload failed: ${error}`, 'ERROR', ModelName);
    throw error;
  }
}

// 辅助函数：将文件转换为 base64
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64 = reader.result as string;
      // 移除 data:image/jpeg;base64, 这样的前缀
      resolve(base64.split(',')[1]);
    };
    reader.onerror = error => reject(error);
  });
}

// 添加状态查询函数
export async function checkVoiceStatus(speakerId: string): Promise<{
  status: 'Unknown' | 'Training' | 'Success' | 'Failed' | 'Active' | 'Expired' | 'Reclaimed';
  demoAudio?: string;
}> {
  try {
    const settings = await getTTSSettings();
    
    const response = await invoke('proxy_request', {
      targetUrl: `${settings.baseUrl}/api/v1/mega_tts/status`,
      method: 'POST',
      body: Array.from(new TextEncoder().encode(JSON.stringify({
        appid: settings.appId,
        speaker_id: speakerId
      })))
    });

    const result = JSON.parse(response as string);
    
    if (result.BaseResp?.StatusCode === 0) {
      return {
        status: result.status,
        demoAudio: result.demo_audio
      };
    } else {
      throw new Error(result.BaseResp?.StatusMessage || 'Unknown error');
    }
  } catch (error) {
    logger.log(`Check voice status failed: ${error}`, 'ERROR', ModelName);
    throw error;
  }
} 