import { useState } from 'react';
import { db } from '../lib/db';
import { logger } from '../utils/logger';

const ModelName = 'useMidjourney';

// src/hooks/useMidjourney.ts
export interface MidjourneyTask {
  id: string;
  status: 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILURE';
  imageUrl?: string[]; // 注意这里是复数形式
}

export const useMidjourney = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateImages = async (prompt: string): Promise<{ taskId: string, channelId: string, instanceId: string }> => {
    logger.log('Starting generateImages with prompt: ' + prompt, 'INFO', ModelName);

    setIsLoading(true);
    setError(null);
    try {
      const apiKeySetting = await db.settings.get('midjourney_key');
      const baseUrlSetting = await db.settings.get('midjourney_url');

      logger.log('API Key: ' + (apiKeySetting?.value ? 'Found' : 'Not found'), 'INFO', ModelName);
      logger.log('Base URL: ' + baseUrlSetting?.value, 'INFO', ModelName);

      const myHeaders = new Headers();
      myHeaders.append("Authorization", `Bearer ${apiKeySetting?.value}`);
      myHeaders.append("Accept", "application/json");
      myHeaders.append("User-Agent", "Apifox/1.0.0 (https://apifox.com)");
      myHeaders.append("Content-Type", "application/json");

      const requestBody = {
        "botType": "MID_JOURNEY",
        "prompt": prompt,
        "base64Array": [],
        "accountFilter": {
          "channelId": "",
          "instanceId": "",
          "modes": [],
          "remark": "",
          "remixAutoConsidered": true
        },
        "notifyHook": "",
        "state": ""
      };

      const requestOptions = {
        method: 'POST',
        headers: myHeaders,
        body: JSON.stringify(requestBody),
        redirect: 'follow' as RequestRedirect
      };

      // 添加调试输出
      logger.log('Debug - Request Details:', 'INFO', ModelName);
      logger.log(`URL: POST ${baseUrlSetting?.value}/mj/submit/imagine`, 'INFO', ModelName);
      logger.log('Headers:', 'INFO', ModelName);
      myHeaders.forEach((value, key) => {
        logger.log(`${key}: ${value}`, 'INFO', ModelName);
      });
      logger.log('Body:', 'INFO', ModelName);
      logger.log(JSON.stringify(requestBody, null, 2), 'INFO', ModelName);

      const response = await fetch(`${baseUrlSetting?.value}/mj/submit/imagine`, requestOptions);

      logger.log('API Response status: ' + response.status, 'INFO', ModelName);

      if (!response.ok) {
        logger.log('API request failed: ' + response.statusText, 'ERROR', ModelName);
        throw new Error('Failed to submit image generation task');
      }

      const data = await response.json();
      logger.log('API Response data: ' + JSON.stringify(data), 'INFO', ModelName);

      if (data.code !== 1 || !data.result) {
        throw new Error(data.description || 'Failed to submit image generation task');
      }

      return {
        taskId: data.result,
        channelId: data.properties?.discordChannelId || '',
        instanceId: data.properties?.discordInstanceId || ''
      };
    } catch (err) {
      logger.log('Error in generateImages: ' + err, 'ERROR', ModelName);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unknown error occurred');
      }
      throw err;
    } finally {
      setIsLoading(false);
      logger.log('generateImages finished', 'INFO', ModelName);
    }
  };

  const checkTaskStatus = async (taskId: string): Promise<MidjourneyTask> => {
    logger.log('Starting checkTaskStatus for taskId: ' + taskId, 'INFO', ModelName);
    const apiKeySetting = await db.settings.get('midjourney_key');
    const baseUrlSetting = await db.settings.get('midjourney_url');

    logger.log('API Key: ' + (apiKeySetting?.value ? 'Found' : 'Not found'), 'INFO', ModelName);
    logger.log('Base URL: ' + baseUrlSetting?.value, 'INFO', ModelName);

    const myHeaders = new Headers();
    myHeaders.append("Authorization", `Bearer ${apiKeySetting?.value}`);
    myHeaders.append("Accept", "application/json");
    myHeaders.append("User-Agent", "Apifox/1.0.0 (https://apifox.com)");
    myHeaders.append("Content-Type", "application/json");

    const requestOptions = {
      method: 'GET',
      headers: myHeaders,
      redirect: 'follow' as RequestRedirect
    };

    const response = await fetch(`${baseUrlSetting?.value}/mj/task/${taskId}/fetch`, requestOptions);

    logger.log('API Response status: ' + response.status, 'INFO', ModelName);

    if (!response.ok) {
      logger.log('API request failed: ' + response.statusText, 'ERROR', ModelName);
      throw new Error('Failed to check task status');
    }

    const data = await response.json();
    logger.log('API Response data: ' + JSON.stringify(data), 'INFO', ModelName);

    const result: MidjourneyTask = {
      id: data.id,
      status: data.status,
      imageUrl: data.imageUrl
    };
    logger.log('Processed task result: ' + JSON.stringify(result), 'INFO', ModelName);
    return result;
  };

  return { generateImages, checkTaskStatus, isLoading, error };
};