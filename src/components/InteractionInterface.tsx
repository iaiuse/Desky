import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { DebugPanel } from './DebugPanel';
import VideoFeed from './VideoFeed';
import { generateResponse } from '../lib/openai';
import { generateSpeech } from '@/lib/tts';
import { setServoPosition, initializeServo, ServoConfig, checkDeviceStatus } from '../lib/servoControl';
import { sendMessage, checkServerStatus } from '../lib/webSocketService';
import { FaceDetectionResult } from '../types/faceDetection';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { db } from '../lib/db';
import { logger } from '../utils/logger';
import { SystemStatusCard } from './SystemStatusCard';
import AudioPlayer from './AudioPlayer';
import { defaultVoices } from '../lib/voiceSettings';

const ModelName = "InteractionInterface";

interface ChatResponse {
  response: string;
  kaomoji: string;
  servoX: number;
  servoY: number;
}

export const InteractionInterface: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState<ChatResponse | null>(null);
  const [deviceStatus, setDeviceStatus] = useState('检查中...');
  const [serverStatus, setServerStatus] = useState('检查中...');
  const [servoX, setServoX] = useState(90);
  const [servoY, setServoY] = useState(90);
  const [deviceName, setDeviceName] = useState('');
  const [serverEndpoint, setServerEndpoint] = useState('');
  const [servoConfig, setServoConfig] = useState<ServoConfig>({
    deviceName: 'Default Device'
  });
  const [audioBuffer, setAudioBuffer] = useState<ArrayBuffer | null>(null);
  const [voices, setVoices] = useState<Array<{ id: string, name: string }>>(defaultVoices);
  const [selectedVoice, setSelectedVoice] = useState<string>(defaultVoices[0].id);


  useEffect(() => {
    const loadVoices = async () => {
      try {
        const voicesSetting = await db.settings.get('voices');
        if (voicesSetting && Array.isArray(voicesSetting.value)) {
          setVoices(voicesSetting.value);
          if (voicesSetting.value.length > 0) {
            setSelectedVoice(voicesSetting.value[0].id);
          }
        } else {
          logger.log('Using default voices', 'INFO', ModelName);
        }
      } catch (error) {
        logger.log(`Error loading voices: ${error}`, 'ERROR', ModelName);
      }
    };

    loadVoices();
  }, []);

  const handleVoiceChange = (value: string) => {
    setSelectedVoice(value);
    // You might want to update the TTS settings here or when generating speech
  };

  useEffect(() => {
    const initializeComponent = async () => {
      try {
        // 加载设置
        const deviceNameSetting = await db.settings.get('deviceName');
        const endpointSetting = await db.settings.get('wsEndpoint');
        
        const deviceName = deviceNameSetting?.value || 'Not set';
        const endpoint = endpointSetting?.value || '';
        
        setDeviceName(deviceName);
        setServerEndpoint(endpoint);

        // 检查服务器状态
        const serverCheck = await checkServerStatus();
        setServerStatus(serverCheck ? 'Connected' : 'Offline');
        
        // 初始化舵机配置
        const servoConfig: ServoConfig = {
          deviceName: deviceName
        };
        setServoConfig(servoConfig);

        // 检查设备状态
        const deviceCheck = await checkDeviceStatus(servoConfig);
        setDeviceStatus(deviceCheck ? 'Online' : 'Offline');

        if (deviceCheck) {
          await initializeServo(servoConfig);
        }

      } catch (error) {
        logger.log(`Error initializing component: ${error}`, 'ERROR', ModelName);
        setServerStatus('Error');
      }
    };

    initializeComponent();
  }, []);

  const handleServoControl = async (axis: 'X' | 'Y', value: number) => {
    if (axis === 'X') setServoX(value);
    else setServoY(value);

    try {
      if (servoConfig) {
        await setServoPosition({ x: servoX, y: servoY }, servoConfig);
      } else {
        throw new Error('Servo configuration not initialized');
      }
    } catch (error) {
      console.error('Failed to set servo position:', error);
      logger.log(`Failed to set servo position: ${error}`, 'ERROR', ModelName);
    }
  };

  

  const handleFaceDetected = (
    result: FaceDetectionResult,
    canvasSize: { width: number, height: number }
  ) => {
    const servoX = Math.round((result.position.x / canvasSize.width) * 180);
    const servoY = Math.round((result.position.y / canvasSize.height) * 180);
    
    if (result.confidence > 0.7 && servoConfig) {
      setServoPosition({ x: servoX, y: servoY }, servoConfig);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      logger.log(`Starting chat submission with prompt: ${prompt}`, 'INFO', ModelName);

      // 生成回复
      const result = await generateResponse(prompt);
      logger.log(`Generated response: ${JSON.stringify(result)}`, 'INFO', ModelName);
      setResponse(result);

      // 生成语音
      const audioBuffer = await generateSpeech(result.response, selectedVoice);
      logger.log(`Generated speech buffer size: ${audioBuffer.byteLength}`, 'DEBUG', ModelName);
      setAudioBuffer(audioBuffer);

      // 检查设备名称
      if (!deviceName) {
        logger.log('Device name is not set', 'WARN', ModelName);
      }
      logger.log(`Current device name: ${deviceName}`, 'DEBUG', ModelName);

      // 发送消息到服务器
      logger.log('Preparing to send message to server', 'DEBUG', ModelName);
      await sendMessage({
        text: result.response,
        audio: audioBuffer,
        expression: result.kaomoji ||'neutral',
        deviceName
      });
      logger.log('Message sent to server successfully', 'INFO', ModelName);

      // 更新舵机位置
      if (result.servoX !== undefined && result.servoY !== undefined) {
        logger.log(
          `Updating servo position: X=${result.servoX}, Y=${result.servoY}, Device=${deviceName}`,
          'DEBUG',
          ModelName
        );
        await setServoPosition({ x: result.servoX, y: result.servoY }, servoConfig);
        logger.log('Servo position updated successfully', 'INFO', ModelName);
      } else {
        logger.log('No servo position update required', 'DEBUG', ModelName);
      }

    } catch (error) {
      logger.log(`Error in chat submission: ${error}`, 'ERROR', ModelName);
    }
  };

  return (
    <div className="container mx-auto p-4 space-y-6">
      <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle>机器人交互</CardTitle>
          <Select value={selectedVoice} onValueChange={handleVoiceChange}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="选择语音" />
            </SelectTrigger>
            <SelectContent>
              {voices.map((voice) => (
                <SelectItem key={voice.id} value={voice.id}>
                  {voice.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="在这里输入你想说的话..."
              className="mb-4"
            />
            <Button type="submit">发送</Button>
          </form>
          {response && (
            <div className="mt-4">
              <h3 className="font-bold">回复:</h3>
              <p>{response.response}</p>
              <p>{response.kaomoji}</p>
            </div>
          )}
          {audioBuffer && <AudioPlayer audioBuffer={audioBuffer} />}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <SystemStatusCard
        serverStatus={serverStatus}
        deviceStatus={deviceStatus}
        deviceId={deviceName}
        serverEndpoint={serverEndpoint}
      />

        <Card>
          <CardHeader>
            <CardTitle>舵机控制</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="block mb-2">水平角度: {servoX}°</label>
                <Slider
                  min={0}
                  max={180}
                  step={1}
                  value={[servoX]}
                  onValueChange={([value]) => handleServoControl('X', value)}
                />
              </div>
              <div>
                <label className="block mb-2">垂直角度: {servoY}°</label>
                <Slider
                  min={0}
                  max={180}
                  step={1}
                  value={[servoY]}
                  onValueChange={([value]) => handleServoControl('Y', value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <VideoFeed 
        onFaceDetected={handleFaceDetected}
        debug={true}
        currentServoX={servoX}  // 使用已有的 servoX 状态
        currentServoY={servoY}  // 使用已有的 servoY 状态
      />

      <DebugPanel
        onServoControl={handleServoControl}
        servoConfig={servoConfig}
      />
    </div>
  );
};
