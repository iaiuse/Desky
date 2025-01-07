import { db } from './db';
import { logger } from '../utils/logger';
import { invoke } from '@tauri-apps/api/tauri';

const ModelName = "TTSService";

interface TTSSettings {
  baseUrl: string;
  apiKey: string;
  model: string;
  groupId: string;
}

async function getTTSSettings(): Promise<TTSSettings> {
  const baseUrl = await db.settings.get('tts_baseUrl');
  const apiKey = await db.settings.get('tts_apiKey');
  const model = await db.settings.get('tts_modelName');
  const groupId = await db.settings.get('tts_groupId');

  if (!baseUrl?.value || !apiKey?.value || !model?.value || !groupId?.value) {
    logger.log('TTS settings not found', 'ERROR', ModelName);
    throw new Error('TTS settings not found');
  }

  return {
    baseUrl: baseUrl.value,
    apiKey: apiKey.value,
    model: model.value,
    groupId: groupId.value
  };
}

function validateVoiceId(voiceId: string): string {
  // Remove any special characters and spaces
  let sanitizedId = voiceId.replace(/[^a-zA-Z0-9]/g, '');
  
  // Ensure the ID is not too long (assuming max length of 32 characters)
  if (sanitizedId.length > 32) {
    sanitizedId = sanitizedId.substring(0, 32);
  }
  
  // Ensure it ends with a valid character
  if (!/[a-zA-Z0-9]$/.test(sanitizedId)) {
    sanitizedId += '0'; // Append a safe character if needed
  }
  
  return sanitizedId;
}

// 上传音频文件
export async function uploadAudioFile(file: File, purpose: 'voice_clone' | 'prompt_audio'): Promise<string> {
  try {
    logger.log(`Uploading file: ${file.name}, size: ${file.size}, type: ${purpose}`, 'INFO', ModelName);
    const settings = await getTTSSettings();
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('purpose', purpose);

    const url = new URL(settings.baseUrl);
    const baseUrl = `${url.origin}/v1/files/upload`;
    
    const response = await fetch(`${baseUrl}?GroupId=${settings.groupId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${settings.apiKey}`,
      },
      body: formData
    });

    const data = await response.json();
    
    if (data.base_resp?.status_code === 0) {
      logger.log(`File upload successful, file_id: ${data.file.file_id}`, 'INFO', ModelName);
      return data.file.file_id;
    } else {
      throw new Error(data.base_resp?.status_msg || 'Unknown error');
    }
  } catch (error) {
    logger.log(`File upload failed: ${error}`, 'ERROR', ModelName);
    throw error;
  }
}

// 克隆声音
export async function cloneVoice_rust(params: {
  fileId: string,
  voiceId: string,
  accuracy: number,
  noiseReduction: boolean,
  volumeNormalization: boolean,
  promptAudio?: { fileId: string, text: string }
}): Promise<void> {
  try {
    const settings = await getTTSSettings();
    
    const payload: any = {
      file_id: params.fileId,
      voice_id: params.voiceId,
      model: settings.model,
      accuracy: params.accuracy,
      need_noise_reduction: params.noiseReduction,
      need_volume_normalization: params.volumeNormalization
    };

    if (params.promptAudio) {
      payload.clone_prompt = {
        prompt_audio: params.promptAudio.fileId,
        prompt_text: params.promptAudio.text
      };
    }

    const jsonString = JSON.stringify(payload);
    const encoder = new TextEncoder();
    const bodyBytes = Array.from(encoder.encode(jsonString));

    const requestConfig = {
      targetUrl: `${settings.baseUrl}/v1/voice_clone`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${settings.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: bodyBytes
    };

    logger.log(`Sending request to: ${requestConfig.targetUrl}`, 'DEBUG', ModelName);
    const response = await invoke('proxy_request', requestConfig);
    
    // 添加响应内容日志
    logger.log(`Received response: ${response}`, 'DEBUG', ModelName);

    try {
      const result = JSON.parse(response as string);
      if (result.base_resp?.status_code !== 0) {
        throw new Error(result.base_resp?.status_msg || 'Unknown error');
      }
    } catch (parseError) {
      logger.log(`Failed to parse response: ${String(response)}`, 'ERROR', ModelName);
      throw new Error(`Invalid response from server: ${String(response).substring(0, 100)}...`);
    }
  } catch (error) {
    logger.log(`Voice clone failed: ${error}`, 'ERROR', ModelName); 
    throw error;
  }
}

// 克隆声音
export async function cloneVoice(params: {
  fileId: string,
  voiceId: string,
  accuracy: number,
  noiseReduction: boolean,
  volumeNormalization: boolean,
  textValidation?: string,
  promptAudio?: { fileId: string, text: string }
}): Promise<void> {
  try {
    const settings = await getTTSSettings();
    
    const payload: any = {
      file_id: params.fileId,
      voice_id: validateVoiceId(params.voiceId),
      model: settings.model,
      accuracy: params.accuracy,
      need_noise_reduction: params.noiseReduction,
      need_volume_normalization: params.volumeNormalization
    };

    if (params.textValidation) {
      payload.text_validation = params.textValidation;
    }

    if (params.promptAudio) {
      payload.clone_prompt = {
        prompt_audio: params.promptAudio.fileId,
        prompt_text: params.promptAudio.text
      };
    }

    logger.log(`Sending request to: ${settings.baseUrl}/v1/voice_clone`, 'DEBUG', ModelName);

    const response = await fetch(`${settings.baseUrl}/v1/voice_clone?GroupId=${settings.groupId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${settings.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    logger.log(`Received response: ${JSON.stringify(result)}`, 'DEBUG', ModelName);

    if (result.base_resp?.status_code !== 0) {
      throw new Error(result.base_resp?.status_msg || 'Unknown error');
    }

  } catch (error) {
    logger.log(`Voice clone failed: ${error}`, 'ERROR', ModelName);
    throw error;
  }
}

// 生成语音
export async function generateSpeech(text: string, voiceId: string): Promise<ArrayBuffer> {
  try {
    logger.log(`Generating speech for text: ${text}`, 'INFO', ModelName);
    const settings = await getTTSSettings();

    //logger.log(`TTS Settings: ${JSON.stringify(settings)}`, 'INFO', ModelName);

    const response = await fetch(`${settings.baseUrl}/v1/t2a_v2`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${settings.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: settings.model,
        text: text,
        stream: false,
        voice_setting: {
          voice_id: voiceId || "male-qn-qingse",
          speed: 1,
          vol: 1,
          pitch: 0
        },
        audio_setting: {
          sample_rate: 32000,
          bitrate: 128000,
          format: "mp3",
          channel: 1
        }
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    logger.log(`API Response received`, 'INFO', ModelName);
    logger.log(`Speech generated successfully`, 'INFO', ModelName);

    // API returns audio data as a hex string
    const audioHex = result.data.audio;
    logger.log(`Audio data received (first 100 chars): ${audioHex.substring(0, 100)}`, 'INFO', ModelName);

    // Convert hex string to ArrayBuffer
    const audioBuffer = new ArrayBuffer(audioHex.length / 2);
    const view = new Uint8Array(audioBuffer);
    for (let i = 0; i < audioHex.length; i += 2) {
      view[i / 2] = parseInt(audioHex.substr(i, 2), 16);
    }
    
    logger.log(`Speech buffer created, size: ${audioBuffer.byteLength} bytes`, 'INFO', ModelName);
    return audioBuffer;
  } catch (error) {
    logger.log(`Error generating speech: ${error}`, 'ERROR', ModelName);
    console.error('Error generating speech:', error);
    throw error;
  }
}