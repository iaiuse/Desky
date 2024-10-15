import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { invoke } from '@tauri-apps/api/tauri';

interface DebugPanelProps {
  onServoControl: (axis: 'X' | 'Y', value: number) => void;
}

export const DebugPanel: React.FC<DebugPanelProps> = ({ onServoControl }) => {
  const [testPrompt, setTestPrompt] = useState('');
  const [testResponse, setTestResponse] = useState('');

  const handleTestPrompt = async () => {
    // Implement your LLM API call here
    setTestResponse('This is a test response from the LLM API.');
  };

  const handleServoControl = async (axis: 'X' | 'Y', value: number) => {
    onServoControl(axis, value);
    try {
      await invoke('set_servo_position', { x: axis === 'X' ? value : null, y: axis === 'Y' ? value : null });
    } catch (error) {
      console.error('Failed to set servo position:', error);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Open Debug Panel</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Debug Panel</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Button onClick={() => handleServoControl('X', 0)}>Left</Button>
            <Button onClick={() => handleServoControl('X', 90)}>Center</Button>
            <Button onClick={() => handleServoControl('X', 180)}>Right</Button>
            <Button onClick={() => handleServoControl('Y', 90)}>Reset Y</Button>
          </div>
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
        </div>
      </DialogContent>
    </Dialog>
  );
};