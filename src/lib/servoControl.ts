import { invoke } from '@tauri-apps/api/tauri';

export interface ServoPosition {
  x: number;
  y: number;
}

export async function setServoPosition(position: ServoPosition): Promise<void> {
  try {
    await invoke('set_servo_position', { x: position.x, y: position.y });
  } catch (error) {
    console.error('Failed to set servo position:', error);
    throw error;
  }
}

export function calculateServoPosition(facePosition: { x: number, y: number }, canvasSize: { width: number, height: number }): ServoPosition {
  // Convert face position to servo angles
  // Assuming servo range is 0-180 degrees
  const servoX = Math.round((facePosition.x / canvasSize.width) * 180);
  const servoY = Math.round((facePosition.y / canvasSize.height) * 180);

  return { x: servoX, y: servoY };
}

export async function initializeServo(): Promise<void> {
  try {
    // Set initial position to center (90, 90)
    await setServoPosition({ x: 90, y: 90 });
  } catch (error) {
    console.error('Failed to initialize servo:', error);
    throw error;
  }
}

export async function moveServoToFace(facePosition: { x: number, y: number }, canvasSize: { width: number, height: number }): Promise<void> {
  const servoPosition = calculateServoPosition(facePosition, canvasSize);
  await setServoPosition(servoPosition);
}