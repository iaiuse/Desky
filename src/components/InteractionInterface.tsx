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
import { addCustomVoice, CustomVoice, defaultVoices, removeCustomVoice } from '../lib/voiceSettings';
import { VoiceCloneDialog } from './VoiceCloneDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { generateBytedanceSpeech } from '@/lib/bytedanceTts';
import { Switch } from "@/components/ui/switch";
import { messageQueueService } from '../lib/messageQueueService';
import { voiceRecognitionService } from '../lib/voiceRecognitionService';

const ModelName = "InteractionInterface";

interface ChatResponse {
  response: string;
  kaomoji: string;
  servoX: number;
  servoY: number;
}

export interface MessagePayload {
  text: string;
  audioBuffer: ArrayBuffer;
  expression: string;
  deviceName: string;
  phoneSerialNumber: string;
}

export const InteractionInterface: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState<ChatResponse | null>(null);
  const [deviceStatus, setDeviceStatus] = useState('检查中...');
  const [serverStatus, setServerStatus] = useState('检查中...');
  const [servoX, setServoX] = useState(90);
  const [servoY, setServoY] = useState(90);
  const [deviceName, setDeviceName] = useState('');
  const [phoneSerialNumber, setPhoneSerialNumber] = useState('');
  const [serverEndpoint, setServerEndpoint] = useState('');
  const [servoConfig, setServoConfig] = useState<ServoConfig>({
    deviceName: 'Default Device'
  });
  const [audioBuffer, setAudioBuffer] = useState<ArrayBuffer | null>(null);
  const [voices, setVoices] = useState<Array<CustomVoice | { id: string; name: string; }>>(defaultVoices);
  const [selectedVoice, setSelectedVoice] = useState<string>(defaultVoices[0].id);
  const [isVoiceCloningOpen, setIsVoiceCloningOpen] = useState(false);
  const [voiceToDelete, setVoiceToDelete] = useState<string | null>(null);
  const [isVoiceRecognitionEnabled, setIsVoiceRecognitionEnabled] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

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
        const phoneSerialSetting = await db.settings.get('phoneSerialNumber');
        
        const deviceName = deviceNameSetting?.value || 'Not set';
        const endpoint = endpointSetting?.value || '';
        const phoneSerial = phoneSerialSetting?.value || '';
        
        setDeviceName(deviceName);
        setServerEndpoint(endpoint);
        setPhoneSerialNumber(phoneSerial);

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

  // 添加新的生成语音函数
  const generateAudioForResponse = async (text: string, selectedVoiceId: string): Promise<ArrayBuffer> => {
    const selectedVoiceConfig = voices.find(voice => voice.id === selectedVoiceId);
    if (!selectedVoiceConfig) {
      throw new Error('Selected voice not found');
    }

    if ('isCustom' in selectedVoiceConfig) {
      if (selectedVoiceConfig.provider === 'bytedance') {
        if (!selectedVoiceConfig.speakerId) {
          throw new Error('Speaker ID not found for bytedance voice');
        }
        return await generateBytedanceSpeech(text, selectedVoiceConfig.speakerId);
      } else {
        // Minimax case
        if (!selectedVoiceConfig.modelPath) {
          throw new Error('Model path not found for minimax voice');
        }
        throw new Error('Minimax TTS not implemented yet');
      }
    } else {
      // Default TTS case
      return await generateSpeech(text, selectedVoiceConfig.id);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      logger.log(`Starting chat submission with prompt: ${prompt}`, 'INFO', ModelName);

      const result = await generateResponse(prompt);
      logger.log(`Generated response: ${JSON.stringify(result)}`, 'INFO', ModelName);
      setResponse(result);

      const audioBuffer = await generateAudioForResponse(result.response, selectedVoice);
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
        deviceName,
        phoneSerialNumber
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

  

  // 删除自定义语音
  const handleRemoveCustomVoice = async (voiceId: string) => {
    try {
      await removeCustomVoice(voiceId);
      const voicesSetting = await db.settings.get('voices');
      if (voicesSetting) {
        setVoices(voicesSetting.value);
      }
      logger.log(`Custom voice ${voiceId} removed successfully`, 'INFO', ModelName);
    } catch (error) {
      logger.log(`Error removing custom voice: ${error}`, 'ERROR', ModelName);
    }
    setVoiceToDelete(null);
  };

  const handleVoiceCloned = async (voiceId: string, name: string) => {
    try {
      const customVoice: CustomVoice = {
        id: '',  // 会在 addCustomVoice 中生成
        name: name,
        isCustom: true,
        provider: 'bytedance',
        originalVoiceId: voiceId,
        speakerId: voiceId,
        modelPath: ''
      };

      const newId = await addCustomVoice(customVoice);
      
      // 重新加载语音列表
      const voicesSetting = await db.settings.get('voices');
      if (voicesSetting) {
        setVoices(voicesSetting.value);
        setSelectedVoice(newId);
      }
    } catch (error) {
      logger.log(`Error adding cloned voice: ${error}`, 'ERROR', ModelName);
    }
  };

  const handleSendToApp = async () => {
    try {
      logger.log(`Starting app submission with prompt: ${prompt}`, 'INFO', ModelName);

      const result = await generateResponse(prompt);
      logger.log(`Generated response: ${JSON.stringify(result)}`, 'INFO', ModelName);
      setResponse(result);

      const audioBuffer = await generateAudioForResponse(result.response, selectedVoice);
      logger.log(`Generated speech buffer size: ${audioBuffer.byteLength}`, 'DEBUG', ModelName);
      setAudioBuffer(audioBuffer);

      // 发送到消息队列
      await messageQueueService.addMessage(
        result.kaomoji || 'neutral',
        audioBuffer
      );
      logger.log('Message added to app queue successfully', 'INFO', ModelName);

    } catch (error) {
      logger.log(`Error in app submission: ${error}`, 'ERROR', ModelName);
    }
  };

  // 处理语音识别结果
  const handleVoiceResult = (text: string) => {
    setPrompt(text);
  };

  const handleVoiceRecognitionChange = async (enabled: boolean) => {
    setIsVoiceRecognitionEnabled(enabled);
    try {
      if (enabled) {
        setIsRecording(true);
        // 初始化并启动语音识别
        await voiceRecognitionService.initialize();
        await voiceRecognitionService.start(handleVoiceResult);
        
        // 添加事件监听
        voiceRecognitionService.addEventListener({
          onError: (error) => {
            logger.log(`Voice recognition error: ${error}`, 'ERROR', ModelName);
            setIsRecording(false);
            setIsVoiceRecognitionEnabled(false);
          },
          onDisconnected: () => {
            setIsRecording(false);
            setIsVoiceRecognitionEnabled(false);
          }
        });
      } else {
        setIsRecording(false);
        // 停止语音识别
        await voiceRecognitionService.stop();
        voiceRecognitionService.removeEventListener();
      }
    } catch (error) {
      logger.log(`Error handling voice recognition: ${error}`, 'ERROR', ModelName);
      setIsRecording(false);
      setIsVoiceRecognitionEnabled(false);
    }
  };

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      if (isVoiceRecognitionEnabled) {
        voiceRecognitionService.stop();
        voiceRecognitionService.removeEventListener();
      }
    };
  }, [isVoiceRecognitionEnabled]);

  return (
    <div className="container max-w-[1100px] mx-auto p-6 space-y-8">
      <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle>机器人交互</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setIsVoiceCloningOpen(true)}>
              复刻新语音
            </Button>
            <VoiceCloneDialog
              open={isVoiceCloningOpen}
              onOpenChange={setIsVoiceCloningOpen}
              onVoiceCloned={handleVoiceCloned}
            />
            <Select value={selectedVoice} onValueChange={handleVoiceChange}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="选择语音" />
              </SelectTrigger>
              <SelectContent>
                {voices.map((voice) => (
                  <div key={voice.id} className="flex items-center justify-between">
                    <SelectItem value={voice.id}>
                      {voice.name}
                    </SelectItem>
                    {'isCustom' in voice && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setVoiceToDelete(voice.id);
                        }}
                      >
                        删除
                      </Button>
                    )}
                  </div>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <label className="text-sm">语音识别</label>
              <Switch
                checked={isVoiceRecognitionEnabled}
                onCheckedChange={handleVoiceRecognitionChange}
              />
              {isRecording && <span className="text-sm text-green-500">录音中...</span>}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="在这里输入你想说的话..."
              className="mb-4"
            />
            <div className="flex gap-2">
              <Button type="submit">发送</Button>
              <Button 
                type="button" 
                variant="secondary"
                onClick={handleSendToApp}
                disabled={!prompt}
              >
                发送App
              </Button>
            </div>
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
        currentServoX={servoX}
        currentServoY={servoY}
      />

      <DebugPanel
        onServoControl={handleServoControl}
        servoConfig={servoConfig}
      />

      <AlertDialog open={!!voiceToDelete} onOpenChange={() => setVoiceToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除这个自定义语音吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (voiceToDelete) {
                  handleRemoveCustomVoice(voiceToDelete);
                }
              }}
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
