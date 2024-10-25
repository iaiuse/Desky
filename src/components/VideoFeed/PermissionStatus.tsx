import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Camera } from "lucide-react";
import PermissionHandler from './PermissionHandler';

interface PermissionStatusProps {
  status: 'checking' | 'granted' | 'denied' | 'prompt';
  onPermissionGranted: () => void;
}

const PermissionStatus: React.FC<PermissionStatusProps> = ({
  status,
  onPermissionGranted
}) => {
  if (status === 'checking') {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <Camera className="mx-auto mb-2 animate-pulse" size={48} />
            <p>正在检查摄像头权限...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (status !== 'granted') {
    return (
      <Card>
        <CardContent className="p-6">
          <PermissionHandler onPermissionGranted={onPermissionGranted} />
        </CardContent>
      </Card>
    );
  }

  return null;
};

export default PermissionStatus;