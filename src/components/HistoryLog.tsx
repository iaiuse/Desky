import React, { useState, useEffect } from 'react';
import { db, IHistory } from '../lib/db';

export const HistoryLog: React.FC = () => {
  const [history, setHistory] = useState<IHistory[]>([]);

  useEffect(() => {
    const loadHistory = async () => {
      const allHistory = await db.history.toArray();
      setHistory(allHistory);
    };

    loadHistory();
  }, []);

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">History & Logs</h1>
      <ul>
        {history.map((item) => (
          <li key={item.id} className="mb-2">
            <span className="font-semibold">Project ID: {item.projectId}</span>
            <span className="ml-2">{item.action}</span>
            <span className="ml-2 text-gray-500">{item.timestamp.toLocaleString()}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};