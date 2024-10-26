import { logger } from '../utils/logger';

const ModelName = "WebSocketService";

export interface WebSocketConfig {
  endpoint: string;
  deviceName: string;
}

export interface WebSocketMessage {
  type: 'FACE_DETECTION' | 'CHAT_REQUEST' | 'CHAT_RESPONSE' | 'AUDIO_READY';
  payload: any;
}

let wsInstance: WebSocket | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;

export async function initializeWebSocket(config: WebSocketConfig): Promise<void> {
  try {
    logger.log(`Initializing WebSocket connection to ${config.endpoint}`, 'INFO', ModelName);
    wsInstance = new WebSocket(config.endpoint);
    
    wsInstance.onopen = () => {
      logger.log('WebSocket connected successfully', 'INFO', ModelName);
      // 发送初始化消息
      sendMessage({
        type: 'CHAT_REQUEST',
        payload: {
          deviceName: config.deviceName,
          timestamp: Date.now()
        }
      });
    };

    wsInstance.onclose = () => {
      logger.log('WebSocket connection closed', 'WARN', ModelName);
      scheduleReconnect(config);
    };

    wsInstance.onerror = (error) => {
      logger.log(`WebSocket error: ${error}`, 'ERROR', ModelName);
    };

    wsInstance.onmessage = handleMessage;
  } catch (error) {
    logger.log(`Failed to initialize WebSocket: ${error}`, 'ERROR', ModelName);
    throw error;
  }
}

export async function checkWebSocketStatus(): Promise<boolean> {
  try {
    return wsInstance?.readyState === WebSocket.OPEN;
  } catch (error) {
    logger.log(`Failed to check WebSocket status: ${error}`, 'ERROR', ModelName);
    return false;
  }
}

export function sendMessage(message: WebSocketMessage): void {
  if (wsInstance?.readyState === WebSocket.OPEN) {
    wsInstance.send(JSON.stringify(message));
    logger.log(`Message sent: ${JSON.stringify(message)}`, 'INFO', ModelName);
  } else {
    logger.log('WebSocket not connected, message not sent', 'WARN', ModelName);
  }
}

function handleMessage(event: MessageEvent) {
  try {
    const message = JSON.parse(event.data) as WebSocketMessage;
    logger.log(`Received message: ${JSON.stringify(message)}`, 'INFO', ModelName);
    // 处理不同类型的消息
    switch (message.type) {
      case 'CHAT_RESPONSE':
        // 处理聊天响应
        break;
      case 'AUDIO_READY':
        // 处理音频就绪
        break;
    }
  } catch (error) {
    logger.log(`Error handling message: ${error}`, 'ERROR', ModelName);
  }
}

function scheduleReconnect(config: WebSocketConfig) {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
  }
  reconnectTimer = setTimeout(() => {
    initializeWebSocket(config);
  }, 5000);
}

export function closeWebSocket() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
  }
  if (wsInstance) {
    wsInstance.close();
    wsInstance = null;
  }
}
