import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Slider } from '@/components/ui/slider';
import { invoke } from '@tauri-apps/api/tauri';
import { DebugPanel } from './DebugPanel';
import VideoFeed from './VideoFeed';

export const InteractionInterface: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [networkStatus, setNetworkStatus] = useState('Checking...');
  const [deviceStatus, setDeviceStatus] = useState('Checking...');
  const [servoX, setServoX] = useState(90);
  const [servoY, setServoY] = useState(90);

  useEffect(() => {
    // Implement actual status checks here
    setTimeout(() => setNetworkStatus('Connected'), 1000);
    setTimeout(() => setDeviceStatus('Online'), 1500);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResponse('Processing...');
    // Implement actual API call to language model here
    setTimeout(() => setResponse('This is a simulated response from the robot.'), 1000);
  };

  const handleServoControl = async (axis: 'X' | 'Y', value: number) => {
    if (axis === 'X') setServoX(value);
    else setServoY(value);
    
    try {
      await invoke('set_servo_position', { x: servoX, y: servoY });
    } catch (error) {
      console.error('Failed to set servo position:', error);
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
        <Card>
          <CardHeader>
            <CardTitle>System Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Alert>
                <AlertTitle>Network Status</AlertTitle>
                <AlertDescription>{networkStatus}</AlertDescription>
              </Alert>
              <Alert>
                <AlertTitle>Device Status</AlertTitle>
                <AlertDescription>{deviceStatus}</AlertDescription>
              </Alert>
            </div>
          </CardContent>
        </Card>

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

      <Card>
        <CardHeader>
          <CardTitle>Video Feed</CardTitle>
        </CardHeader>
        <CardContent>
          <VideoFeed />
        </CardContent>
      </Card>

      <DebugPanel onServoControl={handleServoControl} />
    </div>
  );
};