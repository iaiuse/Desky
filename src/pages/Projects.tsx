import React from 'react';
import { ProjectManager } from '../components/layout/ProjectManager';

export const Projects: React.FC = () => {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-4">Your Projects</h1>
      <ProjectManager />
    </div>
  );
};