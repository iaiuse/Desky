import { db } from './db';
import { logger } from '../utils/logger';

const ModelName = "TTSService";

interface TTSSettings {
  baseUrl: string;
  apiKey: string;
  model: string;
}

async function getTTSSettings(): Promise<TTSSettings> {
  const baseUrl = await db.settings.get('tts_baseUrl');
  const apiKey = await db.settings.get('tts_apiKey');
  const model = await db.settings.get('tts_modelName');

  if (!baseUrl?.value || !apiKey?.value || !model?.value) {
    logger.log('TTS settings not found', 'ERROR', ModelName);
    throw new Error('TTS settings not found');
  }

  return {
    baseUrl: baseUrl.value,
    apiKey: apiKey.value,
    model: model.value,
  };
}

export async function generateSpeech(text: string): Promise<ArrayBuffer> {
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
          voice_id: "male-qn-qingse",
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
    logger.log(`API Response: ${JSON.stringify(result)}`, 'INFO', ModelName);
    logger.log(`Speech generated successfully`, 'INFO', ModelName);

    // Assuming the API returns the audio data in the 'audio' field as a base64 string
    const audioBase64 = result.data.audio;
    logger.log(`Audio data received (first 100 chars): ${audioBase64.substring(0, 100)}`, 'INFO', ModelName);

    // Convert base64 to ArrayBuffer
    const binaryString = window.atob(audioBase64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    const audioBuffer = bytes.buffer;
    
    logger.log(`Speech buffer created, size: ${audioBuffer.byteLength} bytes`, 'INFO', ModelName);
    return audioBuffer;
  } catch (error) {
    logger.log(`Error generating speech: ${error}`, 'ERROR', ModelName);
    console.error('Error generating speech:', error);
    throw error;
  }
}