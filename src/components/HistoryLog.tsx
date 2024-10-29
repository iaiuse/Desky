import React, { useState, useEffect } from 'react';
import { db, IHistory } from '../lib/db';
import { Loader2 } from "lucide-react";

export const HistoryLog: React.FC = () => {
  const [history, setHistory] = useState<IHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        setLoading(true);
        const allHistory = await db.history.toArray();
        setHistory(allHistory);
      } catch (error) {
        console.error('加载历史记录失败:', error);
      } finally {
        setLoading(false);
      }
    };

    loadHistory();
  }, []);

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">历史记录</h1>
      {loading ? (
        <div className="flex justify-center items-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">加载中...</span>
        </div>
      ) : (
        <ul>
          {history.map((item) => (
            <li key={item.id} className="mb-2">
              <span className="font-semibold">项目ID: {item.projectId}</span>
              <span className="ml-2">{item.action}</span>
              <span className="ml-2 text-gray-500">{item.timestamp.toLocaleString()}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};