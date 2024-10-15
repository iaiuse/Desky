import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { SettingsPanel } from '../SettingsPanel';

export const MainLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [showSettings] = useState(false);

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      <div className="flex flex-col flex-grow">
        <div className="flex flex-grow">
          <main className="flex-grow">{children}</main>
          {showSettings && <SettingsPanel  />}
        </div>
      </div>
    </div>
  );
};