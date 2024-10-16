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