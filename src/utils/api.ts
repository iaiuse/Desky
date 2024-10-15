import axios from 'axios';

const GPT_API_URL = 'https://api.openai.com/v1/chat/completions';
const MIDJOURNEY_API_URL = 'https://api.midjourney.com/v1/imagine';
const JIANYING_API_URL = 'https://api.jianying.com/v1/edit';

export const gptApi = async (prompt: string, apiKey: string) => {
  try {
    const response = await axios.post(GPT_API_URL, {
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }]
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('Error calling GPT API:', error);
    throw error;
  }
};

export const midjourneyApi = async (prompt: string, apiKey: string) => {
  try {
    const response = await axios.post(MIDJOURNEY_API_URL, {
      prompt: prompt
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    return response.data.image_url;
  } catch (error) {
    console.error('Error calling Midjourney API:', error);
    throw error;
  }
};

export const jianyingApi = async (videoData: any, apiKey: string) => {
  try {
    const response = await axios.post(JIANYING_API_URL, videoData, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error calling Jianying API:', error);
    throw error;
  }
};