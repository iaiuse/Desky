import { invoke } from '@tauri-apps/api/tauri';
import { db } from './db';
import { logger } from '../utils/logger';

const ModelName = "ServoControl";

export interface ServoPosition {
  x: number;
  y: number;
}

export async function setServoPosition(position: ServoPosition): Promise<void> {
  try {
    const deviceName = await db.settings.get('deviceName');
    logger.log(`Setting servo position for device ${deviceName?.value}: X=${position.x}, Y=${position.y}`, 'INFO', ModelName);
    
    await invoke('set_servo_position', { 
      deviceName: deviceName?.value,
      x: position.x, 
      y: position.y 
    });
    
    logger.log(`Servo position set successfully`, 'INFO', ModelName);
  } catch (error) {
    logger.log(`Failed to set servo position: ${error}`, 'ERROR', ModelName);
    console.error('Failed to set servo position:', error);
    throw error;
  }
}

export function calculateServoPosition(facePosition: { x: number, y: number }, canvasSize: { width: number, height: number }): ServoPosition {
  // Convert face position to servo angles
  // Assuming servo range is 0-180 degrees
  const servoX = Math.round((facePosition.x / canvasSize.width) * 180);
  const servoY = Math.round((facePosition.y / canvasSize.height) * 180);

  logger.log(`Calculated servo position: X=${servoX}, Y=${servoY} from face position: X=${facePosition.x}, Y=${facePosition.y}`, 'DEBUG', ModelName);

  return { x: servoX, y: servoY };
}

export async function initializeServo(): Promise<void> {
  try {
    logger.log('Initializing servo to center position (90, 90)', 'INFO', ModelName);
    // Set initial position to center (90, 90)
    await setServoPosition({ x: 90, y: 90 });
    logger.log('Servo initialized successfully', 'INFO', ModelName);
  } catch (error) {
    logger.log(`Failed to initialize servo: ${error}`, 'ERROR', ModelName);
    console.error('Failed to initialize servo:', error);
    throw error;
  }
}

export async function moveServoToFace(facePosition: { x: number, y: number }, canvasSize: { width: number, height: number }): Promise<void> {
  logger.log(`Moving servo to face position: X=${facePosition.x}, Y=${facePosition.y}`, 'INFO', ModelName);
  const servoPosition = calculateServoPosition(facePosition, canvasSize);
  try {
    await setServoPosition(servoPosition);
    logger.log(`Servo moved to face successfully`, 'INFO', ModelName);
  } catch (error) {
    logger.log(`Failed to move servo to face: ${error}`, 'ERROR', ModelName);
    throw error;
  }
}