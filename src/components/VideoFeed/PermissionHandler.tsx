import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Camera, AlertCircle } from "lucide-react";
import { permissionManager, type PermissionState } from '../../utils/permissionUtils';
import { logger } from '../../utils/logger';

const ModelName = 'PermissionHandler';

interface PermissionHandlerProps {
  onPermissionGranted: (stream: MediaStream) => void;
}

const PermissionHandler: React.FC<PermissionHandlerProps> = ({ onPermissionGranted }) => {
  const [permissionState, setPermissionState] = useState<PermissionState>('prompt');
  const [error, setError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const mountedRef = useRef(true);
  const currentStreamRef = useRef<MediaStream | null>(null);

  // Helper function to safely handle stream
  const handleStream = useCallback(async (stream: MediaStream) => {
    logger.log('Received new media stream', 'INFO', ModelName);
    
    if (!mountedRef.current) {
      logger.log('Component unmounted, cleaning up stream', 'INFO', ModelName);
      stream.getTracks().forEach(track => track.stop());
      return;
    }

    // Clean up previous stream if exists
    if (currentStreamRef.current) {
      logger.log('Cleaning up previous stream', 'INFO', ModelName);
      currentStreamRef.current.getTracks().forEach(track => track.stop());
    }

    currentStreamRef.current = stream;
    logger.log('Calling onPermissionGranted with stream', 'INFO', ModelName);
    onPermissionGranted(stream);
  }, [onPermissionGranted]);

  // Initialize permission checking
  useEffect(() => {
    logger.log('Initializing PermissionHandler', 'INFO', ModelName);
    
    const init = async () => {
      try {
        logger.log('Starting permission manager initialization', 'INFO', ModelName);
        await permissionManager.initialize();
        
        if (!mountedRef.current) return;
        
        const result = await permissionManager.checkPermission();
        logger.log(`Permission check result: ${result.state}`, 'INFO', ModelName);
        
        setPermissionState(result.state);
        setError(result.error || null);
        
        if (result.state === 'granted' && result.stream) {
          logger.log('Permission already granted, handling stream', 'INFO', ModelName);
          await handleStream(result.stream);
        }
      } catch (error) {
        if (!mountedRef.current) return;
        logger.log(`Initialization error: ${error}`, 'ERROR', ModelName);
        setError('初始化权限管理器失败');
      } finally {
        if (mountedRef.current) {
          setIsChecking(false);
        }
      }
    };

    init();

    // Set up permission change listener
    const removeListener = permissionManager.addListener(async (state) => {
      logger.log(`Permission state changed: ${state}`, 'INFO', ModelName);
      
      if (!mountedRef.current) return;
      
      setPermissionState(state);
      if (state === 'granted') {
        try {
          const result = await permissionManager.checkPermission();
          if (result.stream) {
            await handleStream(result.stream);
          }
        } catch (error) {
          logger.log(`Error getting stream after permission change: ${error}`, 'ERROR', ModelName);
        }
      }
    });

    // Cleanup on unmount
    return () => {
      logger.log('PermissionHandler unmounting', 'INFO', ModelName);
      mountedRef.current = false;
      removeListener();
      
      if (currentStreamRef.current) {
        logger.log('Cleaning up stream on unmount', 'INFO', ModelName);
        currentStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [handleStream]);

  const handleRequestPermission = async () => {
    logger.log('User initiated permission request', 'INFO', ModelName);
    setIsChecking(true);
    setError(null);
    
    try {
      const stream = await permissionManager.requestPermission();
      logger.log('Permission request successful', 'INFO', ModelName);
      
      if (mountedRef.current) {
        await handleStream(stream);
      }
    } catch (error) {
      if (mountedRef.current) {
        const errorMessage = error instanceof Error ? error.message : '请求权限失败';
        logger.log(`Permission request error: ${errorMessage}`, 'ERROR', ModelName);
        setError(errorMessage);
      }
    } finally {
      if (mountedRef.current) {
        setIsChecking(false);
      }
    }
  };

  if (isChecking) {
    return (
      <Alert>
        <Camera className="h-4 w-4" />
        <AlertTitle>正在检查摄像头权限</AlertTitle>
        <AlertDescription className="space-y-2">
          <p>请稍候...</p>
          <p className="text-sm text-muted-foreground">正在与摄像头建立连接</p>
        </AlertDescription>
      </Alert>
    );
  }

  if (permissionState === 'unsupported') {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>设备不支持</AlertTitle>
        <AlertDescription className="space-y-2">
          <p>您的浏览器不支持所需的摄像头API。</p>
          <p>请使用最新版本的Chrome、Firefox或Safari浏览器。</p>
        </AlertDescription>
      </Alert>
    );
  }

  if (permissionState === 'denied') {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>需要摄像头权限</AlertTitle>
        <AlertDescription className="space-y-4">
          <p>{error || '请在浏览器设置中允许使用摄像头，然后刷新页面。'}</p>
          <div className="flex items-center space-x-2">
            <Button onClick={handleRequestPermission} variant="outline" size="sm">
              重试
            </Button>
            <Button 
              onClick={() => window.location.reload()} 
              variant="outline" 
              size="sm"
            >
              刷新页面
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  if (permissionState === 'prompt') {
    return (
      <Alert>
        <Camera className="h-4 w-4" />
        <AlertTitle>需要摄像头权限</AlertTitle>
        <AlertDescription className="space-y-4">
          <p>此功能需要使用您的摄像头。</p>
          <p className="text-sm text-muted-foreground">
            授权后，您可以随时在浏览器设置中撤销权限。
          </p>
          <Button 
            onClick={handleRequestPermission} 
            variant="outline" 
            size="sm"
            className="w-full sm:w-auto"
          >
            允许使用摄像头
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return null;
};

export default PermissionHandler;