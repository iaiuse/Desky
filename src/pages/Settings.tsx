import React from 'react';
import { SettingsPanel } from '../components/SettingsPanel';

export const Settings: React.FC = () => {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-4">设置</h1>
      <SettingsPanel />
    </div>
  );
};