import React from 'react';
import { InteractionInterface } from '@/components/InteractionInterface';

export const InteractionPage: React.FC = () => {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-4">Desky - 你的桌面伴侣</h1>
      <InteractionInterface />
    </div>
  );
};