import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { db } from '../lib/db';
import { useSerialPorts } from '../hooks/useSerialPorts';

interface SettingsPanelProps {
  setIsConfigured?: (value: boolean) => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ setIsConfigured }) => {
  const [settings, setSettings] = useState({
    apiUrl: '',
    apiKey: '',
    modelName: '',
    deviceName: '',
    phoneIpAddress: '',
    systemPrompt: '',
    serialPort: ''
  });

  const { ports, loading, error } = useSerialPorts();

  useEffect(() => {
    const loadSettings = async () => {
      const storedSettings = await db.settings.toArray();
      const loadedSettings = storedSettings.reduce((acc, setting) => {
        acc[setting.key as keyof typeof settings] = setting.value;
        return acc;
      }, {} as typeof settings);
      setSettings(prevSettings => ({ ...prevSettings, ...loadedSettings }));
    };

    loadSettings();
  }, []);

  const handleChange = (key: keyof typeof settings, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSerialPortChange = (value: string) => {
    setSettings(prev => ({
      ...prev,
      serialPort: value,
      deviceName: value.split('/').pop() || value // Extract the last part of the path as device name
    }));
  };

  const saveSettings = async () => {
    const settingsToSave = Object.entries(settings).map(([key, value]) => ({
      key,
      value
    }));

    await db.settings.clear();
    await db.settings.bulkAdd(settingsToSave);

    if (setIsConfigured) {
      setIsConfigured(true);
    }
    alert('设置已保存');
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">设置</h1>
      <Tabs defaultValue="api">
        <TabsList>
          <TabsTrigger value="api">API设置</TabsTrigger>
          <TabsTrigger value="device">设备设置</TabsTrigger>
        </TabsList>
        <TabsContent value="api">
          <Card>
            <CardHeader>API设置</CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="block mb-1">API URL</label>
                  <Input
                    value={settings.apiUrl}
                    onChange={(e) => handleChange('apiUrl', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block mb-1">API Key</label>
                  <Input
                    type="password"
                    value={settings.apiKey}
                    onChange={(e) => handleChange('apiKey', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block mb-1">模型名称</label>
                  <Input
                    value={settings.modelName}
                    onChange={(e) => handleChange('modelName', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block mb-1">系统提示词</label>
                  <Textarea
                    value={settings.systemPrompt}
                    onChange={(e) => handleChange('systemPrompt', e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="device">
          <Card>
            <CardHeader>设备设置</CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="block mb-1">串口</label>
                  <Select
                    value={settings.serialPort}
                    onValueChange={handleSerialPortChange}
                    disabled={loading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择串口" />
                    </SelectTrigger>
                    <SelectContent>
                      {loading && <SelectItem value="loading">加载中...</SelectItem>}
                      {error && <SelectItem value="error">错误: {error}</SelectItem>}
                      {ports.map((port) => (
                        <SelectItem key={port} value={port}>
                          {port}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block mb-1">设备名称</label>
                  <Input
                    value={settings.deviceName}
                    onChange={(e) => handleChange('deviceName', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block mb-1">手机IP地址</label>
                  <Input
                    value={settings.phoneIpAddress}
                    onChange={(e) => handleChange('phoneIpAddress', e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <Button onClick={saveSettings} className="mt-4">保存所有设置</Button>
    </div>
  );
};