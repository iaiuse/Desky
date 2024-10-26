export interface WebSocketConfig {
  endpoint: string;
}

export interface WebSocketMessage {
  type: 'FACE_DETECTION' | 'CHAT_REQUEST' | 'CHAT_RESPONSE' | 'AUDIO_READY';
  payload: any;
}

export interface AudioMessage {
  audioUrl: string;
  kaomoji: string;
  text: string;
}
