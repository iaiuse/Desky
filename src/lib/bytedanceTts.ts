import { db } from './db';
import { logger } from '../utils/logger';

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

    const reqId = crypto.randomUUID();
    
    const requestBody: TTSRequest = {
      app: {
        appid: settings.appId,
        token: settings.token,
        cluster: settings.cluster
      },
      user: {
        uid: reqId // 使用reqId作为用户标识
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

    const response = await fetch(`${settings.baseUrl}/api/v1/tts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer;${settings.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result: TTSResponse = await response.json();
    
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

// 上传音频文件用于声音克隆
export async function uploadAudioFile(file: File, purpose: 'voice_clone' | 'prompt_audio'): Promise<string> {
  try {
    logger.log(`Uploading file for ${purpose}: ${file.name}`, 'INFO', ModelName);
    const settings = await getTTSSettings();
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('purpose', purpose);

    const response = await fetch(`${settings.baseUrl}/v1/files/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer;${settings.token}`
      },
      body: formData
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    if (result.base_resp?.status_code === 0) {
      logger.log(`File upload successful, file_id: ${result.file.file_id}`, 'INFO', ModelName);
      return result.file.file_id;
    } else {
      throw new Error(result.base_resp?.status_msg || 'Unknown error');
    }
  } catch (error) {
    logger.log(`File upload failed: ${error}`, 'ERROR', ModelName);
    throw error;
  }
} 