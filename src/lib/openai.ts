import OpenAI from 'openai';
import { db } from './db';

let openaiInstance: OpenAI | null = null;

async function getOpenAIInstance() {
  if (!openaiInstance) {
    const apiKey = await db.settings.get('openaiApiKey');
    if (!apiKey || !apiKey.value) {
      throw new Error('OpenAI API key not found in settings');
    }
    openaiInstance = new OpenAI({
      apiKey: apiKey.value,
    });
  }
  return openaiInstance;
}

export async function generateResponse(prompt: string) {
  try {
    const openai = await getOpenAIInstance();
    const systemPrompt = await db.settings.get('systemPrompt');
    const modelName = await db.settings.get('modelName');

    const response = await openai.chat.completions.create({
      model: modelName?.value || "gpt-3.5-turbo-0125",
      messages: [
        { role: "system", content: systemPrompt?.value || "假设你是一个可以和人类对话的具身机器人,反应内容包括响应内容,以及对应的kaomoji表情和头部动作(双轴舵机转动参数)。" },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" },
    });

    return JSON.parse(response.choices[0].message.content || '{}');
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    throw error;
  }
}

export async function generateSpeech(text: string) {
  try {
    const openai = await getOpenAIInstance();
    const response = await openai.audio.speech.create({
      model: "tts-1",
      voice: "alloy",
      input: text,
    });

    const buffer = Buffer.from(await response.arrayBuffer());
    return buffer;
  } catch (error) {
    console.error('Error generating speech:', error);
    throw error;
  }
}