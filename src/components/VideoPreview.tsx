import React from 'react';
import { Button } from "./ui/button";

interface Scene {
  id: number;
  image: string | null;
}

interface VideoPreviewProps {
  scenes: Scene[];
  onGenerateVideo: () => void;
}

export const VideoPreview: React.FC<VideoPreviewProps> = ({ scenes, onGenerateVideo }) => {
  return (
    <div className="space-y-4">
      <div className="flex space-x-2 overflow-x-auto">
        {scenes.map((scene) => (
          <div key={scene.id} className="w-32 h-32 bg-gray-200 flex-shrink-0">
            {scene.image && <img src={scene.image} alt={`Scene ${scene.id}`} className="w-full h-full object-cover" />}
          </div>
        ))}
      </div>
      <Button onClick={onGenerateVideo}>Generate Video</Button>
    </div>
  );
};