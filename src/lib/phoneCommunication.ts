import { invoke } from '@tauri-apps/api/core';
import { logger } from '../utils/logger';

const ModelName = "PhoneCommunication";

export interface mobilePhoneConfig {
  ipAddress: string;
  port: number;
}

export interface CommunicationData {
  kaomoji: string;
  audioBuffer: ArrayBuffer;
}

export async function sendToMobilePhone(data: CommunicationData, config: mobilePhoneConfig): Promise<void> {
  try {
    logger.log(`Sending data to Phone at ${config.ipAddress}:${config.port}`, 'INFO', ModelName);
    
    await invoke('send_to_mobile_phone', { 
      ipAddress: config.ipAddress,
      port: config.port,
      kaomoji: data.kaomoji,
      audioBuffer: Array.from(new Uint8Array(data.audioBuffer))
    });
    
    logger.log(`Data sent successfully to Phone`, 'INFO', ModelName);
  } catch (error) {
    logger.log(`Failed to send data to Phone: ${error}`, 'ERROR', ModelName);
    console.error('Failed to send data to Phone:', error);
    throw error;
  }
}

export async function checkMobilePhoneStatus(config: mobilePhoneConfig): Promise<boolean> {
  try {
    logger.log(`Checking Phone status at ${config.ipAddress}:${config.port}`, 'INFO', ModelName);
    
    const status = await invoke('check_mobile_phone_status', { 
      ipAddress: config.ipAddress,
      port: config.port
    });
    
    logger.log(`Phone status check result: ${status}`, 'INFO', ModelName);
    return status as boolean;
  } catch (error) {
    logger.log(`Failed to check Phone status: ${error}`, 'ERROR', ModelName);
    console.error('Failed to check Phone status:', error);
    return false;
  }
}

export async function initializeConnection(config: mobilePhoneConfig): Promise<void> {
  try {
    logger.log(`Initializing connection to Phone at ${config.ipAddress}:${config.port}`, 'INFO', ModelName);
    
    await invoke('initialize_mobile_phone_connection', { 
      ipAddress: config.ipAddress,
      port: config.port
    });
    
    logger.log('Phone connection initialized successfully', 'INFO', ModelName);
  } catch (error) {
    logger.log(`Failed to initialize Phone connection: ${error}`, 'ERROR', ModelName);
    console.error('Failed to initialize Phone connection:', error);
    throw error;
  }
}