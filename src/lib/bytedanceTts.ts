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
    volume_ratio: number;
    pitch_ratio: number;
  };
  request: {
    reqid: string;
    text: string;
    text_type: string;
    operation: string;
    with_frontend: number;
    frontend_type: string;
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
    baseUrl: baseUrl.value || 'https://openspeech.bytedance.com',
    appId: appId.value,
    token: token.value,
    cluster: cluster.value
  };
}

export async function generateBytedanceSpeech(text: string, voiceId: string): Promise<ArrayBuffer> {
  try {
    logger.log(`Generating ByteDance speech for text: ${text}`, 'INFO', ModelName);
    const settings = await getTTSSettings();

    const requestBody: TTSRequest = {
      app: {
        appid: settings.appId,
        token: settings.token,
        cluster: settings.cluster
      },
      user: {
        uid: nanoid()  // 生成唯一ID
      },
      audio: {
        voice_type: voiceId,
        encoding: 'mp3',
        speed_ratio: 1.0,
        volume_ratio: 1.0,
        pitch_ratio: 1.0
      },
      request: {
        reqid: nanoid(),
        text: text,
        text_type: 'plain',
        operation: 'query',
        with_frontend: 1,
        frontend_type: 'unitTson'
      }
    };

    const response = await invoke<string>('proxy_request_with_headers', {
      targetUrl: `${settings.baseUrl}/api/v1/tts`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer;${settings.token}`,
        'Content-Type': 'application/json'
      },
      body: Array.from(new TextEncoder().encode(JSON.stringify(requestBody)))
    });

    const result = JSON.parse(response);
    
    if (result.code !== 3000) {
      throw new Error(`TTS error: ${result.message}`);
    }

    // 将base64编码的音频数据转换为ArrayBuffer
    const binaryString = atob(result.data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    logger.log(`Speech generated successfully`, 'INFO', ModelName);
    return bytes.buffer;

  } catch (error) {
    logger.log(`Error generating ByteDance speech: ${error}`, 'ERROR', ModelName);
    throw error;
  }
}

async function makeRequest(url: string, method: string, headers: Record<string, string>, body: any): Promise<string> {
  logger.log(`Making request to ${url}`, 'DEBUG', ModelName);
  logger.log(`Headers: ${JSON.stringify(headers)}`, 'DEBUG', ModelName);
  
  return await invoke<string>('proxy_request_with_headers', {
    targetUrl: url,
    method,
    headers,
    body: Array.from(new TextEncoder().encode(JSON.stringify(body)))
  });
}

export async function uploadAudioFile(
  file: File,
  speakerId: string,
  options: UploadOptions
): Promise<string> {
  try {
    logger.log(`Starting to upload file: ${file.name}`, 'INFO', ModelName);
    logger.log(`File size: ${file.size} bytes, type: ${file.type}`, 'DEBUG', ModelName);
    logger.log(`Using speaker ID: ${speakerId}`, 'DEBUG', ModelName);
    logger.log(`Upload options:`, 'DEBUG', ModelName);
    logger.log(JSON.stringify(options, null, 2), 'DEBUG', ModelName);

    const settings = await getTTSSettings();
    logger.log(`Using settings - baseUrl: ${settings.baseUrl}`, 'DEBUG', ModelName);

    // 获取base64编码的音频数据
    const audioBase64 = await fileToBase64(file);
    logger.log(`Audio file encoded successfully (length: ${audioBase64.length})`, 'DEBUG', ModelName);

    const audioFormat = file.name.split('.').pop() || 'wav';
    logger.log(`Detected audio format: ${audioFormat}`, 'DEBUG', ModelName);

    // 构建请求数据 - 参照Python示例调整结构
    const requestData = {
      appid: settings.appId,
      speaker_id: speakerId,
      audios: [{
        audio_bytes: audioBase64,
        audio_format: audioFormat
      }],
      source: 2,
      language: options.language,
      model_type: options.modelType
    };

    logger.log('Prepared request data:', 'DEBUG', ModelName);
    logger.log(JSON.stringify({
      ...requestData,
      audios: [{
        audio_format: requestData.audios[0].audio_format,
        audio_bytes: `${requestData.audios[0].audio_bytes.substring(0, 50)}...` // 只显示部分base64数据
      }]
    }, null, 2), 'DEBUG', ModelName);

    const response = await makeRequest(
      `${settings.baseUrl}/api/v1/mega_tts/audio/upload`,
      'POST',
      {
        'Authorization': `Bearer;${settings.token}`,
        'Resource-Id': 'volc.megatts.voiceclone',
        'Content-Type': 'application/json'
      },
      requestData
    );

    logger.log(`Raw response received:`, 'DEBUG', ModelName);
    logger.log(response, 'DEBUG', ModelName);

    const result = JSON.parse(response);
    logger.log(`Parsed response:`, 'DEBUG', ModelName);
    logger.log(JSON.stringify(result, null, 2), 'DEBUG', ModelName);
    
    // 根据Python示例调整状态码判断
    if (result.BaseResp?.StatusCode === 0) {
      logger.log(`File upload successful, speaker_id: ${result.speaker_id}`, 'INFO', ModelName);
      return result.speaker_id;
    } else {
      const errorMessage = result.BaseResp?.StatusMessage || 'Unknown error';
      logger.log(`Upload failed with error: ${errorMessage}`, 'ERROR', ModelName);
      throw new Error(errorMessage);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.log(`File upload failed: ${errorMessage}`, 'ERROR', ModelName);
    logger.log(`Error details: ${JSON.stringify(error)}`, 'ERROR', ModelName);
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

// 定义API返回的状态枚举
export enum VoiceStatus {
  NotFound = 0,
  Training = 1,
  Success = 2,
  Failed = 3,
  Active = 4
}

export interface VoiceStatusResponse {
  status: VoiceStatus;
  demoAudio?: string;
  createTime?: number;
  version?: string;
}

export async function checkVoiceStatus(speakerId: string): Promise<VoiceStatusResponse> {
  try {
    const settings = await getTTSSettings();
    
    const response = await makeRequest(
      `${settings.baseUrl}/api/v1/mega_tts/status`,
      'POST',
      {
        'Authorization': `Bearer;${settings.token}`,
        'Resource-Id': 'volc.megatts.voiceclone',
        'Content-Type': 'application/json'
      },
      {
        appid: settings.appId,
        speaker_id: speakerId
      }
    );

    const result = JSON.parse(response);
    
    if (result.BaseResp?.StatusCode === 0) {
      return {
        status: result.status,
        demoAudio: result.demo_audio,
        createTime: result.create_time,
        version: result.version
      };
    } else {
      throw new Error(result.BaseResp?.StatusMessage || 'Unknown error');
    }
  } catch (error) {
    logger.log(`Check voice status failed: ${error}`, 'ERROR', ModelName);
    throw error;
  }
}

// 添加音色列表接口
export interface VoiceInfo {
  speakerId: string;
  createTime: number;
  status: VoiceStatus;
  version?: string;
  demoAudio?: string;
}

// 获取可用音色列表
export async function listAvailableVoices(): Promise<VoiceInfo[]> {
  try {
    logger.log('Starting to fetch available voices...', 'INFO', ModelName);
    
    // 返回固定的音色ID
    const fixedVoice: VoiceInfo = {
      speakerId: 'S_v5wkjbif1',
      createTime: Date.now(),
      status: VoiceStatus.Active,
      version: '2.0'
    };

    logger.log(`Returning fixed voice ID: ${fixedVoice.speakerId}`, 'INFO', ModelName);
    return [fixedVoice];

    /* 暂时注释掉动态获取的代码
    const settings = await getTTSSettings();
    
    const requestBody = JSON.stringify({
      AppID: settings.appId
    });
    logger.log(`Request body: ${requestBody}`, 'DEBUG', ModelName);
    
    const response = await invoke<string>('proxy_request', {
      targetUrl: 'https://open.volcengineapi.com/?Action=ListMegaTTSTrainStatus&Version=2023-11-07',
      method: 'POST',
      headers: {
        'Authorization': `Bearer;${settings.token}`,
        'Content-Type': 'application/json; charset=utf-8',
        'Host': 'open.volcengineapi.com'
      },
      body: Array.from(new TextEncoder().encode(requestBody))
    });

    logger.log(`Raw response received: ${response}`, 'DEBUG', ModelName);
    const result = JSON.parse(response);
    
    logger.log(`Parsed response: ${JSON.stringify(result, null, 2)}`, 'DEBUG', ModelName);
    
    if (result.ResponseMetadata?.Error === null) {
      const speakers = result.Result?.SpeakerList || [];
      if (!Array.isArray(speakers)) {
        logger.log(`Unexpected response format - speakers: ${JSON.stringify(speakers)}`, 'ERROR', ModelName);
        throw new Error('Invalid response format: speakers array not found');
      }

      const voices = speakers.map((speaker: any) => {
        logger.log(`Processing speaker: ${JSON.stringify(speaker)}`, 'DEBUG', ModelName);
        return {
          speakerId: speaker.SpeakerID,
          createTime: new Date(speaker.CreateTime).getTime(),
          status: speaker.Status,
          version: speaker.Version,
          demoAudio: speaker.DemoAudio
        };
      });

      logger.log(`Successfully processed ${voices.length} voices`, 'INFO', ModelName);
      return voices;
    } else {
      const errorMessage = `API error: ${result.ResponseMetadata?.Error?.Message || 'Unknown error'} (Code: ${result.ResponseMetadata?.Error?.Code})`;
      logger.log(errorMessage, 'ERROR', ModelName);
      throw new Error(errorMessage);
    }
    */
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.log(`Failed to list voices: ${errorMessage}`, 'ERROR', ModelName);
    throw error;
  }
} 