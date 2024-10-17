import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';
import { logger } from '../utils/logger';

const ModelName = "ServoControl-Node";

export interface ServoPosition {
  x: number;
  y: number;
}

export interface ServoConfig {
  deviceName: string;
  ipAddress: string;
}

class ServoController {
  private static instance: ServoController;
  private port: SerialPort | null = null;
  private parser: ReadlineParser | null = null;

  private constructor() {}

  static getInstance(): ServoController {
    if (!ServoController.instance) {
      ServoController.instance = new ServoController();
    }
    return ServoController.instance;
  }

  async initialize(config: ServoConfig): Promise<void> {
    try {
      this.port = new SerialPort({ path: config.deviceName, baudRate: 9600 });
      this.parser = this.port.pipe(new ReadlineParser({ delimiter: '\n' }));
      
      return new Promise((resolve, reject) => {
        this.port!.on('open', () => {
          logger.log(`Serial port ${config.deviceName} opened successfully`, 'INFO', ModelName);
          resolve();
        });
        
        this.port!.on('error', (err) => {
          logger.log(`Error opening serial port ${config.deviceName}: ${err}`, 'ERROR', ModelName);
          reject(err);
        });

        this.parser!.on('data', (data) => {
          logger.log(`Received data from Arduino: ${data}`, 'INFO', ModelName);
        });
      });
    } catch (error) {
      logger.log(`Failed to initialize servo controller: ${error}`, 'ERROR', ModelName);
      throw error;
    }
  }

  async setPosition(position: ServoPosition): Promise<void> {
    if (!this.port) {
      throw new Error('Servo controller not initialized');
    }

    const command = `${position.x},${position.y}\n`;
    return new Promise((resolve, reject) => {
      this.port!.write(command, (err) => {
        if (err) {
          logger.log(`Error writing to serial port: ${err}`, 'ERROR', ModelName);
          reject(err);
        } else {
          logger.log(`Servo position set to x: ${position.x}, y: ${position.y}`, 'INFO', ModelName);
          resolve();
        }
      });
    });
  }

  async checkStatus(): Promise<boolean> {
    if (!this.port) {
      return false;
    }

    try {
      await this.setPosition({ x: 90, y: 90 });
      return true;
    } catch (error) {
      logger.log(`Device status check failed: ${error}`, 'ERROR', ModelName);
      return false;
    }
  }

  close(): void {
    if (this.port) {
      this.port.close((err) => {
        if (err) {
          logger.log(`Error closing serial port: ${err}`, 'ERROR', ModelName);
        } else {
          logger.log('Serial port closed', 'INFO', ModelName);
        }
      });
    }
  }
}

export async function setServoPosition(position: ServoPosition, config: ServoConfig): Promise<void> {
  try {
    logger.log(`Setting servo position for device ${config.deviceName}: X=${position.x}, Y=${position.y}`, 'INFO', ModelName);
    
    const controller = ServoController.getInstance();
    await controller.setPosition(position);
    
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
    const controller = ServoController.getInstance();
    await controller.initialize(config);
    await controller.setPosition({ x: 90, y: 90 });
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

export async function checkDeviceStatus(config: ServoConfig): Promise<boolean> {
  try {
    logger.log(`Checking device status for ${config.deviceName}`, 'INFO', ModelName);
    
    const controller = ServoController.getInstance();
    const status = await controller.checkStatus();
    
    logger.log(`Device status check result: ${status}`, 'INFO', ModelName);
    return status;
  } catch (error) {
    logger.log(`Failed to check device status: ${error}`, 'ERROR', ModelName);
    console.error('Failed to check device status:', error);
    throw error;
  }
}