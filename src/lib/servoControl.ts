import { invoke } from '@tauri-apps/api/tauri';
import { logger } from '../utils/logger';

const ModelName = "ServoControl";

export interface ServoPosition {
  x: number;
  y: number;
}

export interface ServoConfig {
  deviceName: string;
  ipAddress: string;
}

export async function setServoPosition(position: ServoPosition, config: ServoConfig): Promise<void> {
  try {
    logger.log(`Setting servo position for device ${config.deviceName}: X=${position.x}, Y=${position.y}`, 'INFO', ModelName);
    
    await invoke('set_servo_position', { 
      deviceName: config.deviceName,
      ipAddress: config.ipAddress,
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
  const servoX = Math.round((facePosition.x / canvasSize.width) * 180);
  const servoY = Math.round((facePosition.y / canvasSize.height) * 180);

  logger.log(`Calculated servo position: X=${servoX}, Y=${servoY} from face position: X=${facePosition.x}, Y=${facePosition.y}`, 'INFO', ModelName);

  return { x: servoX, y: servoY };
}

export async function initializeServo(config: ServoConfig): Promise<void> {
  try {
    logger.log(`Initializing servo for device ${config.deviceName} to center position (90, 90)`, 'INFO', ModelName);
    // Set initial position to center (90, 90)
    await setServoPosition({ x: 90, y: 90 }, config);
    logger.log('Servo initialized successfully', 'INFO', ModelName);
  } catch (error) {
    logger.log(`Failed to initialize servo: ${error}`, 'ERROR', ModelName);
    console.error('Failed to initialize servo:', error);
    throw error;
  }
}

export async function moveServoToFace(facePosition: { x: number, y: number }, canvasSize: { width: number, height: number }, config: ServoConfig): Promise<void> {
  logger.log(`Moving servo to face position: X=${facePosition.x}, Y=${facePosition.y}`, 'INFO', ModelName);
  const servoPosition = calculateServoPosition(facePosition, canvasSize);
  try {
    await setServoPosition(servoPosition, config);
    logger.log(`Servo moved to face successfully`, 'INFO', ModelName);
  } catch (error) {
    logger.log(`Failed to move servo to face: ${error}`, 'ERROR', ModelName);
    throw error;
  }
}