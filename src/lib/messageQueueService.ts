import { invoke } from '@tauri-apps/api/tauri';
import { logger } from '../utils/logger';

const ModelName = 'MessageQueueService';
const BASE_URL = 'http://localhost:3030';

interface MessageQueueResponse {
  status: string;
  message: string;
}

export const messageQueueService = {
  async addMessage(emoji: string, audioBuffer: ArrayBuffer): Promise<MessageQueueResponse> {
    try {
      // 创建 FormData
      const formData = new FormData();
      
      // 添加音频数据
      const audioBlob = new Blob([audioBuffer], { type: 'audio/wav' });
      formData.append('audio', audioBlob, 'audio.wav');
      
      // 添加表情数据
      formData.append('emoji', emoji);

      // 将 FormData 转换为字节数组
      const formDataArray = await formDataToBytes(formData);

      const requestConfig = {
        targetUrl: `${BASE_URL}/resources`,
        method: 'POST',
        body: formDataArray
      };

      logger.log(`Sending request to: ${requestConfig.targetUrl}`, 'DEBUG', ModelName);
      const response = await invoke('proxy_request', requestConfig);

      logger.log(`Received response: ${response}`, 'DEBUG', ModelName);

      try {
        const result = JSON.parse(response as string);
        if (!result.status) {
          throw new Error('Invalid response format');
        }
        logger.log('Message added to queue successfully', 'INFO', ModelName);
        return result;
      } catch (parseError) {
        logger.log(`Failed to parse response: ${String(response)}`, 'ERROR', ModelName);
        throw new Error(`Invalid response from server: ${String(response).substring(0, 100)}...`);
      }
    } catch (error) {
      logger.log(`Error adding message to queue: ${error}`, 'ERROR', ModelName);
      throw error;
    }
  }
};

// 辅助函数：将 FormData 转换为字节数组
async function formDataToBytes(formData: FormData): Promise<number[]> {
  const encoder = new TextEncoder();
  const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
  let parts: Uint8Array[] = [];

  for (const [key, value] of formData.entries()) {
    parts.push(encoder.encode(`--${boundary}\r\n`));
    
    if (value instanceof Blob) {
      parts.push(encoder.encode(
        `Content-Disposition: form-data; name="${key}"; filename="audio.wav"\r\n` +
        `Content-Type: ${value.type}\r\n\r\n`
      ));
      parts.push(new Uint8Array(await value.arrayBuffer()));
    } else {
      parts.push(encoder.encode(
        `Content-Disposition: form-data; name="${key}"\r\n\r\n${value}`
      ));
    }
    parts.push(encoder.encode('\r\n'));
  }
  
  parts.push(encoder.encode(`--${boundary}--\r\n`));

  const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }

  return Array.from(result);
} 