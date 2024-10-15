import React from 'react';
import { VideoCreationTool } from '../VideoCreationTool';

export const Workspace: React.FC = () => {
  return (
    <div className="flex-grow p-6 bg-white shadow-lg rounded-lg m-4 overflow-auto">
      <VideoCreationTool />
    </div>
  );
};