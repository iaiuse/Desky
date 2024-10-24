import React, {  useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { logger } from '../utils/logger';

const ModelName = 'TestVideoFeed';

export const TestVideoFeed: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startCamera = async () => {
    try {
      setError(null);
      logger.log('Requesting camera access', 'INFO', ModelName);
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 }
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

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <Switch 
            checked={isActive}
            onCheckedChange={(checked) => {
              if (checked) {
                startCamera();
              } else {
                stopCamera();
              }
            }}
          />
          <span>{isActive ? '关闭摄像头' : '开启摄像头'}</span>
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
      </CardContent>
    </Card>
  );
};