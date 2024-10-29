// src/components/LogViewer/tsx
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { logger } from '../utils/logger';

export const LogViewer: React.FC = () => {
  const [logs, setLogs] = useState<string[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  useEffect(() => {
    loadLogs();
    const interval = setInterval(loadLogs, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    filterLogs();
  }, [logs, searchTerm, startDate, endDate]);

  const loadLogs = async () => {
    const logContent = await logger.getLogs();
    const logLines = logContent.split('\n').filter(line => line.trim() !== '');
    setLogs(logLines); // No need to reformat, backend handles formatting
  };


  const filterLogs = () => {
    let filtered = logs;

    if (searchTerm) {
      filtered = filtered.filter(log => log.toLowerCase().includes(searchTerm.toLowerCase()));
    }

    if (startDate) {
      const startDateTime = new Date(startDate);
      filtered = filtered.filter(log => {
        const logDate = new Date(log.split(']')[0].slice(1));
        return !isNaN(logDate.getTime()) && logDate >= startDateTime;
      });
    }

    if (endDate) {
      const endDateTime = new Date(endDate);
      endDateTime.setHours(23, 59, 59, 999);
      filtered = filtered.filter(log => {
        const logDate = new Date(log.split(']')[0].slice(1));
        return !isNaN(logDate.getTime()) && logDate <= endDateTime;
      });
    }

    setFilteredLogs(filtered);
  };

  const handleClearLogs = async () => {
    await logger.clearLogs();
    setLogs([]);
    setFilteredLogs([]);
  };

  const generateDateOptions = () => {
    const options = [];
    const currentDate = new Date();
    for (let i = 0; i < 30; i++) {
      const date = new Date(currentDate);
      date.setDate(currentDate.getDate() - i);
      const dateString = date.toISOString().split('T')[0];
      options.push(
        <SelectItem key={dateString} value={dateString}>
          {dateString}
        </SelectItem>
      );
    }
    return options;
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">应用日志</h2>
      <div className="flex flex-wrap gap-2 mb-4">
        <Input
          type="text"
          placeholder="搜索日志..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full sm:w-64"
        />
        <Select onValueChange={setStartDate}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="开始日期" />
          </SelectTrigger>
          <SelectContent>
            {generateDateOptions()}
          </SelectContent>
        </Select>
        <Select onValueChange={setEndDate}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="结束日期" />
          </SelectTrigger>
          <SelectContent>
            {generateDateOptions()}
          </SelectContent>
        </Select>
        <Button onClick={handleClearLogs} className="w-full sm:w-auto">清除日志</Button>
      </div>
      <pre className="bg-gray-100 p-2 rounded h-64 overflow-auto">
        {filteredLogs.join('\n')}
      </pre>
    </div>
  );
};