import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Camera } from "lucide-react";
import { getCameraTypeLabel, getCameraIconStyle, getPlaceholderText } from '@/utils/videoUtils';
import type { CameraDevice } from '@/types/camera';

interface CameraSelectProps {
  cameras: CameraDevice[];
  selectedCamera: string | null;
  isLoading: boolean;
  isCameraActive: boolean;
  onSelect: (deviceId: string) => void;
}

const CameraSelect: React.FC<CameraSelectProps> = ({
  cameras,
  selectedCamera,
  isLoading,
  isCameraActive,
  onSelect
}) => {
  return (
    <div className="w-64">
      <Select
        value={selectedCamera || ''}
        onValueChange={onSelect}
        disabled={isLoading || isCameraActive}
      >
        <SelectTrigger>
          <SelectValue placeholder={getPlaceholderText(isLoading, cameras.length)} />
        </SelectTrigger>
        <SelectContent>
          {cameras.map((camera) => (
            <SelectItem key={camera.deviceId} value={camera.deviceId}>
              <div className="flex items-center gap-2">
                <Camera className={getCameraIconStyle(camera.type)} />
                <div className="flex flex-col">
                  <span className="font-medium">{getCameraTypeLabel(camera.type)}</span>
                  <span className="text-xs text-gray-500">{camera.label}</span>
                </div>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default CameraSelect;