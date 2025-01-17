import OpenAI from 'openai';
import { db } from './db';
import { logger } from '../utils/logger';

const ModelName = "OpenAIService";

let openaiInstance: OpenAI | null = null;

async function getOpenAIInstance() {
  if (!openaiInstance) {
    logger.log('Creating new OpenAI instance', 'INFO', ModelName);
    const apiKey = await db.settings.get('apiKey');
    const apiUrl = await db.settings.get('apiUrl');
    if (!apiKey || !apiKey.value) {
      logger.log('OpenAI API key not found in settings', 'ERROR', ModelName);
      throw new Error('OpenAI API key not found in settings');
    }
    if (!apiUrl || !apiUrl.value) {
      logger.log('OpenAI baseurl not found in settings', 'ERROR', ModelName);
      throw new Error('OpenAI baseurl not found in settings');
    }
    logger.log(`Creating OpenAI instance with baseURL: ${apiUrl.value}`, 'INFO', ModelName);
    openaiInstance = new OpenAI({
      apiKey: apiKey.value,
      baseURL: apiUrl.value,
      dangerouslyAllowBrowser: true ,
    });
  }
  return openaiInstance;
}

export async function generateResponse(prompt: string) {
  try {
    logger.log(`Generating response for prompt: ${prompt}`, 'INFO', ModelName);
    const openai = await getOpenAIInstance();
    const systemPrompt = await db.settings.get('systemPrompt');
    const modelName = await db.settings.get('modelName');

    logger.log(`Using model: ${modelName?.value || "gpt-3.5-turbo-0125"}`, 'INFO', ModelName);
    logger.log(`System prompt: ${systemPrompt?.value}`, 'INFO', ModelName);

    const defaultSystemPrompt = "假设你是一个可以和人类对话的具身机器人,返回内容包括响应内容,以及对应的kaomoji表情和头部动作(双轴舵机转动参数)。以json格式返回，响应内容定义为response，表情定义为kaomoji，kaomoji表情要反映响应内容情感。与表情对应的头部动作水平角度（无需单位）为servoX，范围是10~170，面向正前方是90。与表情对应的头部动作垂直角度（无需单位）为servoY，范围是10~170，水平面是90。";

    const response = await openai.chat.completions.create({
      model: modelName?.value || "gpt-3.5-turbo-0125",
      messages: [
        { role: "system", content: (systemPrompt?.value || defaultSystemPrompt) + " 请以JSON格式输出你的响应。" },
        { role: "user", content: prompt + " 请记住以JSON格式回复。" }
      ],
      response_format: { type: "json_object" },
    });

    logger.log(`Response received from OpenAI`, 'INFO', ModelName);
    logger.log(`Raw response content: ${JSON.stringify(response)}`, 'INFO', ModelName);
    const parsedResponse = JSON.parse(response.choices[0].message.content || '{}');
    logger.log(`Parsed response: ${JSON.stringify(parsedResponse)}`, 'INFO', ModelName);

    return parsedResponse;
  } catch (error) {
    logger.log(`Error calling OpenAI API: ${error}`, 'ERROR', ModelName);
    console.error('Error calling OpenAI API:', error);
    throw error;
  }
}

export async function generateSpeechOpenAI(text: string) {
  try {
    logger.log(`Generating speech for text: ${text}`, 'INFO', ModelName);
    const openai = await getOpenAIInstance();
    const response = await openai.audio.speech.create({
      model: "tts-1",
      voice: "alloy",
      input: text,
    });

    logger.log(`Speech generated successfully`, 'INFO', ModelName);
    const buffer = Buffer.from(await response.arrayBuffer());
    logger.log(`Speech buffer created, size: ${buffer.length} bytes`, 'INFO', ModelName);
    return buffer;
  } catch (error) {
    logger.log(`Error generating speech: ${error}`, 'ERROR', ModelName);
    console.error('Error generating speech:', error);
    throw error;
  }
}