import { invoke } from '@tauri-apps/api/tauri';

interface OpenAIResponse {
  response: string;
  kaomoji: string;
  servoX: number;
  servoY: number;
}

export async function generateResponse(prompt: string): Promise<OpenAIResponse> {
  try {
    // 在实际应用中，你可能需要从配置或环境变量中获取 API 密钥
    const apiKey = 'your_openai_api_key_here';
    
    // 使用 Tauri 的 invoke 函数调用后端的 Rust 函数来处理 API 请求
    // 这样可以避免在前端暴露 API 密钥
    const result = await invoke<OpenAIResponse>('call_openai_api', {
      apiKey,
      prompt,
    });

    return result;
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    throw error;
  }
}

export async function generateSpeech(text: string): Promise<ArrayBuffer> {
  try {
    // 同样使用 Tauri 的 invoke 函数调用后端的 Rust 函数来生成语音
    const result = await invoke<number[]>('generate_speech', {
      text,
    });

    // 将返回的数字数组转换为 ArrayBuffer
    return new Uint8Array(result).buffer;
  } catch (error) {
    console.error('Error generating speech:', error);
    throw error;
  }
}