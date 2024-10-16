import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { invoke } from '@tauri-apps/api/tauri';
import { DebugPanel } from './DebugPanel';
import VideoFeed from './VideoFeed';
import { generateResponse, generateSpeech } from '../lib/openai';
import { setServoPosition, initializeServo, moveServoToFace, ServoConfig, checkDeviceStatus } from '../lib/servoControl';
import { db } from '../lib/db';
import { logger } from '../utils/logger';
import { SystemStatusCard } from './SystemStatusCard';

const ModelName = "InteractionInterface";

export const InteractionInterface: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [networkStatus, setNetworkStatus] = useState('Checking...');
  const [deviceStatus, setDeviceStatus] = useState('Checking...');
  const [servoX, setServoX] = useState(90);
  const [servoY, setServoY] = useState(90);
  const [deviceName, setDeviceName] = useState('');
  const [ipAddress, setIpAddress] = useState('');
  const [servoConfig, setServoConfig] = useState<ServoConfig>({
    deviceName: 'Default Device',
    ipAddress: 'Default IP'
  });

  useEffect(() => {
    const initializeComponent = async () => {
      try {
        const deviceNameSetting = await db.settings.get('deviceName');
        const phoneIpSetting = await db.settings.get('phoneIpAddress');

        logger.log(`deviceNameSetting: ${JSON.stringify(deviceNameSetting)}`, 'INFO', ModelName);
        logger.log(`phoneIpSetting: ${JSON.stringify(phoneIpSetting)}`, 'INFO', ModelName);

        const deviceName = deviceNameSetting?.value || 'Not set';
        const ipAddress = phoneIpSetting?.value || 'Not set';

        setDeviceName(deviceName);
        setIpAddress(ipAddress);

        logger.log(`Device Name: ${deviceName}`, 'INFO', ModelName);
        logger.log(`IP Address: ${ipAddress}`, 'INFO', ModelName);

        const config: ServoConfig = {
          deviceName: deviceName,
          ipAddress: ipAddress
        };
        setServoConfig(config);

        const deviceCheck = await checkDeviceStatus(config);
        setDeviceStatus(deviceCheck ? 'Online' : 'Offline');
        logger.log(`Device Status: ${deviceStatus}`, 'INFO', ModelName);

        if (deviceCheck) {
          await initializeServo(config);
          logger.log(`initializeServo success`, 'INFO', ModelName);
        }

        //const networkCheck = await invoke('check_network_status');
        //setNetworkStatus(networkCheck ? 'Connected' : 'Disconnected');

        logger.log(`Network Status: ${networkStatus}`, 'INFO', ModelName);
        
      } catch (error) {
        console.error('Error initializing component:', error);
        logger.log(`Error initializing component: ${error}`, 'ERROR', ModelName);
        setNetworkStatus('Error');
        setDeviceStatus('Error');
      }
    };

    initializeComponent();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResponse('Processing...');
    try {
      const result = await generateResponse(prompt);
      setResponse(result.response);

      await generateSpeech(result.response);
      // TODO: Implement speech playback

      if (result.servoX !== undefined && result.servoY !== undefined && servoConfig) {
        await setServoPosition({ x: result.servoX, y: result.servoY }, servoConfig);
        setServoX(result.servoX);
        setServoY(result.servoY);
      }
    } catch (error) {
      console.error('Error processing request:', error);
      logger.log(`Error processing request: ${error}`, 'ERROR', ModelName);
      setResponse('An error occurred while processing your request.');
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
        <CardHeader>
          <CardTitle>Robot Interaction</CardTitle>
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
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SystemStatusCard
          networkStatus={networkStatus}
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