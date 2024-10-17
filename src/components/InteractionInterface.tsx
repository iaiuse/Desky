import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { DebugPanel } from './DebugPanel';
import VideoFeed from './VideoFeed';
import { generateResponse } from '../lib/openai';
import { generateSpeech } from '@/lib/tts';
import { setServoPosition, initializeServo, moveServoToFace, ServoConfig, checkDeviceStatus } from '../lib/servoControl';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { db } from '../lib/db';
import { logger } from '../utils/logger';
import { SystemStatusCard } from './SystemStatusCard';
import { checkMobilePhoneStatus, initializeConnection, mobilePhoneConfig } from '../lib/phoneCommunication';
import AudioPlayer from './AudioPlayer';
import { defaultVoices } from '../lib/voiceSettings';

const ModelName = "InteractionInterface";

export const InteractionInterface: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [mobilePhoneStatus, setMobilePhoneStatus] = useState('Checking...');
  const [deviceStatus, setDeviceStatus] = useState('Checking...');
  const [servoX, setServoX] = useState(90);
  const [servoY, setServoY] = useState(90);
  const [deviceName, setDeviceName] = useState('');
  const [ipAddress, setIpAddress] = useState('');
  const [servoConfig, setServoConfig] = useState<ServoConfig>({
    deviceName: 'Default Device',
    ipAddress: 'Default IP'
  });

  const [mobilePhoneConfig, setMobilePhoneConfig] = useState<mobilePhoneConfig>({
    ipAddress: 'Default IP',
    port: 12345
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
        const deviceNameSetting = await db.settings.get('deviceName');
        const phoneIpSetting = await db.settings.get('phoneIpAddress');
        const phonePortSetting = await db.settings.get('phonePort');

        logger.log(`deviceNameSetting: ${JSON.stringify(deviceNameSetting)}`, 'INFO', ModelName);
        logger.log(`phoneIpSetting: ${JSON.stringify(phoneIpSetting)}`, 'INFO', ModelName);
        logger.log(`phonePortSetting: ${JSON.stringify(phonePortSetting)}`, 'INFO', ModelName);

        const deviceName = deviceNameSetting?.value || 'Not set';
        const ipAddress = phoneIpSetting?.value || 'Not set';
        let port: number;
        if (phonePortSetting?.value) {
          const parsedPort = parseInt(phonePortSetting.value, 10);
          if (isNaN(parsedPort) || parsedPort < 0 || parsedPort > 65535) {
            logger.log(`Invalid port number in settings: ${phonePortSetting.value}. Using default.`, 'WARN', ModelName);
            port = 12345;
          } else {
            port = parsedPort;
          }
        } else {
          port = 12345;
        }

        logger.log(`Port: ${port}`, 'INFO', ModelName);

        setDeviceName(deviceName);
        setIpAddress(ipAddress);

        logger.log(`Device Name: ${deviceName}`, 'INFO', ModelName);
        logger.log(`IP Address: ${ipAddress}`, 'INFO', ModelName);
        logger.log(`Port: ${port}`, 'INFO', ModelName);

        const servoConfig: ServoConfig = {
          deviceName: deviceName,
          ipAddress: ipAddress
        };
        setServoConfig(servoConfig);

        const phoneConfig: mobilePhoneConfig = {
          ipAddress: ipAddress,
          port: port
        };
        setMobilePhoneConfig(phoneConfig);

        const deviceCheck = await checkDeviceStatus(servoConfig);
        setDeviceStatus(deviceCheck ? 'Online' : 'Offline');
        logger.log(`Servo Device Status: ${deviceStatus}`, 'INFO', ModelName);

        if (deviceCheck) {
          await initializeServo(servoConfig);
          logger.log(`initializeServo success`, 'INFO', ModelName);
        }

        const phoneCheck = await checkMobilePhoneStatus(phoneConfig);
        setMobilePhoneStatus(phoneCheck ? 'Online' : 'Offline');
        logger.log(`Phone Status: ${mobilePhoneConfig}`, 'INFO', ModelName);

        if (phoneCheck) {
          await initializeConnection(phoneConfig);
          logger.log(`initializeConnection success`, 'INFO', ModelName);
        }

      } catch (error) {
        console.error('Error initializing component:', error);
        logger.log(`Error initializing component: ${error}`, 'ERROR', ModelName);
        setDeviceStatus('Error');
        setMobilePhoneStatus('Error');
      }
    };

    initializeComponent();
  }, []);



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResponse('Processing...');
    setAudioBuffer(null);  // Reset audio buffer
    try {
      const result = await generateResponse(prompt);
      setResponse(result.response);
  
      const newAudioBuffer = await generateSpeech(result.response, selectedVoice);
      setAudioBuffer(newAudioBuffer);
  
      if (result.servoX !== undefined && result.servoY !== undefined && servoConfig) {
        await setServoPosition({ x: result.servoX, y: result.servoY }, servoConfig);
        setServoX(result.servoX);
        setServoY(result.servoY);
      }
    } catch (error) {
      console.error('Error processing request:', error);
      logger.log(`Error processing request: ${error}`, 'ERROR', ModelName);
      setResponse(`An error occurred while processing your request.${error}`);
    }
  };

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

  const handleFaceDetected = async (facePosition: { x: number, y: number }, canvasSize: { width: number, height: number }) => {
    try {
      if (servoConfig) {
        await moveServoToFace(facePosition, canvasSize, servoConfig);
      } else {
        throw new Error('Servo configuration not initialized');
      }
    } catch (error) {
      console.error('Failed to move servo to face:', error);
      logger.log(`Failed to move servo to face: ${error}`, 'ERROR', ModelName);
    }
  };

  return (
    <div className="container mx-auto p-4 space-y-6">
      <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle>Robot Interaction</CardTitle>
          <Select value={selectedVoice} onValueChange={handleVoiceChange}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select voice" />
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
              placeholder="Enter your prompt here..."
              className="mb-4"
            />
            <Button type="submit">Send</Button>
          </form>
          {response && (
            <div className="mt-4">
              <h3 className="font-bold">Response:</h3>
              <p>{response}</p>
            </div>
          )}
          {audioBuffer && <AudioPlayer audioBuffer={audioBuffer} />}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SystemStatusCard
          networkStatus={mobilePhoneStatus}
          deviceStatus={deviceStatus}
          deviceId={deviceName}
          ipAddress={ipAddress}
        />

        <Card>
          <CardHeader>
            <CardTitle>Servo Control</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="block mb-2">Servo X: {servoX}°</label>
                <Slider
                  min={0}
                  max={180}
                  step={1}
                  value={[servoX]}
                  onValueChange={([value]) => handleServoControl('X', value)}
                />
              </div>
              <div>
                <label className="block mb-2">Servo Y: {servoY}°</label>
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

      <VideoFeed onFaceDetected={handleFaceDetected} />

      <DebugPanel
        onServoControl={handleServoControl}
        servoConfig={servoConfig}
      />
    </div>
  );
};