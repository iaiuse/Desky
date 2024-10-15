import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

interface SystemStatusProps {
  networkStatus: string;
  deviceStatus: string;
  deviceId: string;
  ipAddress: string;
}

export const SystemStatusCard: React.FC<SystemStatusProps> = ({
  networkStatus,
  deviceStatus,
  deviceId,
  ipAddress
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>System Status</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <Alert>
            <AlertTitle className="flex justify-between items-center">
              <span className="font-bold">Network</span>
              <span className="text-sm">{deviceId || 'N/A'}</span>
            </AlertTitle>
            <AlertDescription className="flex justify-between items-center mt-1">
              <span>Status:</span>
              <span>{networkStatus}</span>
            </AlertDescription>
          </Alert>
          <Alert>
            <AlertTitle className="flex justify-between items-center">
              <span className="font-bold">Device</span>
              <span className="text-sm">{ipAddress || 'N/A'}</span>
            </AlertTitle>
            <AlertDescription className="flex justify-between items-center mt-1">
              <span>Status:</span>
              <span>{deviceStatus}</span>
            </AlertDescription>
          </Alert>
        </div>
      </CardContent>
    </Card>
  );
};