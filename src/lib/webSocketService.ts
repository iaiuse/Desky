import { invoke } from '@tauri-apps/api/tauri';
import { logger } from '../utils/logger';
import { db } from './db';

const ModelName = "WebSocketService";

// Types
export interface MessagePayload {
  text: string;
  audioBuffer: ArrayBuffer;
  expression: string;
  deviceName: string;
  phoneSerialNumber: string;
}

// Get server URL from settings
async function getServerUrl(): Promise<string> {
  try {
    const serverConfig = await db.settings.get('wsEndpoint');
    return serverConfig?.value || '';
  } catch (error) {
    logger.log(`Failed to get server URL from settings: ${error}`, 'ERROR', ModelName);
    throw error;
  }
}

// Core Communication Functions
export async function sendMessage(message: any): Promise<void> {
  try {
    const serverUrl = await getServerUrl();
    logger.log(`Using server URL: ${serverUrl}`, 'DEBUG', ModelName);
    
    // 创建 FormData 对象
    const formData = new FormData();
    
    // 添加音频数据（必需字段）
    if (message.audio) {
      const audioBlob = new Blob([message.audio], { type: 'audio/wav' });
      formData.append('audio', audioBlob, 'audio.wav');
    } else {
      // 如果没有音频，创建一个空的音频文件
      const emptyAudio = new Uint8Array(44); // WAV header size
      const emptyBlob = new Blob([emptyAudio], { type: 'audio/wav' });
      formData.append('audio', emptyBlob, 'audio.wav');
    }
    
    // 添加表情数据（必需字段）
    formData.append('expression', message.expression || 'neutral');
    // 添加设备ID（必需字段）
    formData.append('deviceId', message.phoneSerialNumber);

    // 将 FormData 转换为字节数组
    const formDataArray = await formDataToBytes(formData);

    // 构建请求配置
    const requestConfig = {
      targetUrl: `${serverUrl}/api/message`,
      method: 'POST',
      body: formDataArray
    };

    const response = await invoke('proxy_request', requestConfig);
    logger.log(`Response received: ${response}`, 'INFO', ModelName);
    
    return;
  } catch (error) {
    logger.log(`Failed to send message: ${error}`, 'ERROR', ModelName);
    throw error;
  }
}

// 新的辅助函数：将 FormData 转换为字节数组
async function formDataToBytes(formData: FormData): Promise<number[]> {
  const encoder = new TextEncoder();
  const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
  let parts: Uint8Array[] = [];

  for (const [key, value] of formData.entries()) {
    // 添加分隔符
    parts.push(encoder.encode(`--${boundary}\r\n`));
    
    if (value instanceof Blob) {
      // 处理文件类型
      parts.push(encoder.encode(
        `Content-Disposition: form-data; name="${key}"; filename="audio.wav"\r\n` +
        `Content-Type: ${value.type}\r\n\r\n`
      ));
      parts.push(new Uint8Array(await value.arrayBuffer()));
    } else {
      // 处理普通字段
      parts.push(encoder.encode(
        `Content-Disposition: form-data; name="${key}"\r\n\r\n${value}`
      ));
    }
    parts.push(encoder.encode('\r\n'));
  }
  
  // 添加结束分隔符
  parts.push(encoder.encode(`--${boundary}--\r\n`));

  // 合并所有部分
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }

  return Array.from(result);
}

export async function checkServerStatus(): Promise<boolean> {
  try {
    const serverUrl = await getServerUrl();
    if (!serverUrl) {
      return false;
    }

    logger.log(`Checking server status: ${serverUrl}/api/hello`, 'DEBUG', ModelName);
    
    const result = await invoke('check_server_status', {
      url: `${serverUrl}/api/hello`
    });
    logger.log(`Server status check result: ${result}`, 'INFO', ModelName);
    return Boolean(result);
  } catch (error) {
    logger.log(`Server status check failed: ${error}`, 'ERROR', ModelName);
    return false;
  }
}
