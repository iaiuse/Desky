import React from 'react';
import { Switch } from '@/components/ui/switch';
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import CameraSelect from './CameraSelect';
import type { CameraDevice } from '@/types/camera';

interface CameraControlsProps {
  cameras: CameraDevice[];
  selectedCamera: string | null;
  isLoading: boolean;
  isCameraActive: boolean;
  onCameraSelect: (deviceId: string) => void;
  onToggleCamera: (active: boolean) => void;
  onRefresh: () => void;
  isLocked: boolean;
  onLockChange?: (locked: boolean) => void;
}

const CameraControls: React.FC<CameraControlsProps> = ({
  cameras,
  selectedCamera,
  isLoading,
  isCameraActive,
  onCameraSelect,
  onToggleCamera,
  onRefresh,
  isLocked,
  onLockChange
}) => {
  return (
    <div className="mb-4 flex items-center justify-between flex-wrap gap-4">
      <div className="flex items-center space-x-4">
        <CameraSelect
          cameras={cameras}
          selectedCamera={selectedCamera}
          isLoading={isLoading}
          isCameraActive={isCameraActive}
          onSelect={onCameraSelect}
        />

        <div className="flex items-center space-x-2">
          <Switch
            checked={isCameraActive}
            onCheckedChange={onToggleCamera}
            disabled={!selectedCamera || isLoading}
          />
          <span className="text-sm font-medium">
            {isCameraActive ? '关闭摄像头' : '开启摄像头'}
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            checked={isLocked}
            onCheckedChange={onLockChange}
            disabled={!isCameraActive}
          />
          <span className="text-sm font-medium">
            {isLocked ? '锁定位置' : '跟踪模式'}
          </span>
        </div>
      </div>

      <Button
        onClick={onRefresh}
        disabled={isLoading || isCameraActive}
        size="sm"
        variant="outline"
        className="flex items-center gap-2"
      >
        <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        刷新列表
      </Button>
    </div>
  );
};

export default CameraControls;