import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/tauri';

const ServoControls: React.FC = () => {
  const [servoX, setServoX] = useState(90);
  const [servoY, setServoY] = useState(90);

  const handleServoChange = async (axis: 'X' | 'Y', value: number) => {
    if (axis === 'X') {
      setServoX(value);
    } else {
      setServoY(value);
    }
    
    try {
      await invoke('set_servo_position', { x: servoX, y: servoY });
    } catch (error) {
      console.error('Failed to set servo position:', error);
    }
  };

  return (
    <div>
      <div>
        <label>Servo X: {servoX}</label>
        <input
          type="range"
          min="0"
          max="180"
          value={servoX}
          onChange={(e) => handleServoChange('X', parseInt(e.target.value))}
        />
      </div>
      <div>
        <label>Servo Y: {servoY}</label>
        <input
          type="range"
          min="0"
          max="180"
          value={servoY}
          onChange={(e) => handleServoChange('Y', parseInt(e.target.value))}
        />
      </div>
    </div>
  );
};

export default ServoControls;