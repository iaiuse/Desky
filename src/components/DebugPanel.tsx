import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { setServoPosition, ServoConfig } from '../lib/servoControl';
import { logger } from '../utils/logger';

const ModelName = 'DebugPanel';

interface DebugPanelProps {
  onServoControl: (axis: 'X' | 'Y', value: number) => void;
  servoConfig: ServoConfig;
}

const TestVideoFeed: React.FC = () => {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startCamera = async () => {
    try {
      setError(null);
      logger.log('Requesting camera access', 'INFO', ModelName);
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsActive(true);
        logger.log('Camera started successfully', 'INFO', ModelName);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start camera');
      setIsActive(false);
      logger.log(`Camera error: ${err}`, 'ERROR', ModelName);
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
      setIsActive(false);
      logger.log('Camera stopped', 'INFO', ModelName);
    }
  };

  // 在组件卸载时清理
  React.useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button 
          onClick={() => isActive ? stopCamera() : startCamera()}
          variant={isActive ? "destructive" : "default"}
        >
          {isActive ? '停止摄像头' : '启动摄像头'}
        </Button>
      </div>

      <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-contain"
          playsInline
          autoPlay
          muted
        />
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 text-white p-4">
            {error}
          </div>
        )}
      </div>
    </div>
  );
};

export const DebugPanel: React.FC<DebugPanelProps> = ({ onServoControl, servoConfig }) => {
  const [testPrompt, setTestPrompt] = useState('');
  const [testResponse, setTestResponse] = useState('');

  const handleTestPrompt = async () => {
    setTestResponse('This is a test response from the LLM API.');
  };

  const handleServoControl = async (axis: 'X' | 'Y', value: number) => {
    onServoControl(axis, value);
    try {
      await setServoPosition(
        { x: axis === 'X' ? value : 90, y: axis === 'Y' ? value : 90 },
        servoConfig
      );
    } catch (error) {
      console.error('Failed to set servo position:', error);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Debug Panel</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Debug Panel</DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="servo">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="servo">舵机控制</TabsTrigger>
            <TabsTrigger value="camera">摄像头测试</TabsTrigger>
            <TabsTrigger value="llm">LLM 测试</TabsTrigger>
          </TabsList>

          <TabsContent value="servo" className="space-y-4">
            <div>
              <p>Device Name: {servoConfig.deviceName}</p>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Button onClick={() => handleServoControl('X', 0)}>Left</Button>
              <Button onClick={() => handleServoControl('X', 90)}>Center</Button>
              <Button onClick={() => handleServoControl('X', 180)}>Right</Button>
              <Button onClick={() => handleServoControl('Y', 90)}>Reset Y</Button>
            </div>
          </TabsContent>

          <TabsContent value="camera">
            <TestVideoFeed />
          </TabsContent>

          <TabsContent value="llm" className="space-y-4">
            <Textarea
              value={testPrompt}
              onChange={(e) => setTestPrompt(e.target.value)}
              placeholder="Enter test prompt for LLM API"
            />
            <Button onClick={handleTestPrompt}>Send Test Prompt</Button>
            {testResponse && (
              <div>
                <h4>Test Response:</h4>
                <p>{testResponse}</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};