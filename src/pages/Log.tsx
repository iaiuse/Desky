import React from 'react';
import { HistoryLog } from '../components/HistoryLog';
import { LogViewer } from '../components/LogViewer';

export const LogPage: React.FC = () => {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-4">Activity Log</h1>
      <HistoryLog />
      <LogViewer />
    </div>
  );
};