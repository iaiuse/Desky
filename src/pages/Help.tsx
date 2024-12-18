import React from 'react';
import { HelpAndSupport } from '../components/HelpAndSupport';

export const HelpPage: React.FC = () => {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-4">帮助与支持</h1>
      <HelpAndSupport />
    </div>
  );
};