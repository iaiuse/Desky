import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { db } from '../lib/db';
import { useSerialPorts } from '../hooks/useSerialPorts';
import { RefreshCw } from 'lucide-react';
import { invoke } from '@tauri-apps/api';

interface Device {
  deviceId: string;
  screenSize: string;
  lastSeen: number;
}

interface SettingsPanelProps {
  setIsConfigured?: (value: boolean) => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ setIsConfigured }) => {
  const [settings, setSettings] = useState({
    apiUrl: '',
    apiKey: '',
    modelName: '',
    deviceName: '',
    systemPrompt: '',
    serialPort: '',
    wsEndpoint: '',
    tts_baseUrl: '',
    tts_apiKey: '',
    tts_modelName: '',
    tts_groupId: '',
    phoneSerialNumber: '',
  });

  const [devices, setDevices] = useState<Device[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [deviceError, setDeviceError] = useState<string | null>(null);

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


  useEffect(() => {
    if (settings.wsEndpoint) {
      handleRefreshDevices();
    }
  }, [settings.wsEndpoint]);

  const handleChange = (key: keyof typeof settings, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSerialPortChange = (value: string) => {
    setSettings(prev => ({
      ...prev,
      serialPort: value,
      deviceName: value
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

  async function refreshPorts(): Promise<void> {
    try {
      // Call Rust's get_serial_ports command
      const portsResult = await invoke('get_serial_ports');
      // Update the ports state through the useSerialPorts hook
      if (Array.isArray(portsResult)) {
        // The ports will automatically update through the useSerialPorts hook
        // No need to manually clear/update the dropdown since it's handled by the hook
      }
    } catch (error) {
      console.error('Failed to refresh ports:', error);
    }
  }

  const handleRefreshDevices = async () => {
    console.log('开始刷新设备列表...');
    setLoadingDevices(true);
    setDeviceError(null);
    try {
      const requestConfig = {
        targetUrl: `${settings.wsEndpoint}/api/device/list`,
        method: 'GET',
        body: [] as number[]
      };
      
      console.log('发送请求配置:', requestConfig);
      
      const response = await invoke('proxy_request', requestConfig);
      console.log('收到原始响应:', response);
      
      const data = JSON.parse(response as string);
      console.log('解析后的数据:', data);
      
      if (data.success) {
        console.log('成功获取设备列表:', data.devices);
        setDevices(data.devices);
      } else {
        console.error('API返回错误:', data.error);
        setDeviceError(data.error || '获取设备列表失败');
      }
    } catch (err) {
      console.error('请求过程出错:', err);
      setDeviceError('获取设备列表失败');
    } finally {
      console.log('设备列表刷新完成');
      setLoadingDevices(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">设置</h1>
      <Tabs defaultValue="api">
        <TabsList>
          <TabsTrigger value="api">API设置</TabsTrigger>
          <TabsTrigger value="device">设备设置</TabsTrigger>
          <TabsTrigger value="tts">TTS设置</TabsTrigger>
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
                  <div className="flex justify-between items-center mb-1">
                    <label className="block">串口</label>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => refreshPorts()}
                      disabled={loading}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
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
                  <label className="block mb-1">WebSocket 服务地址</label>
                  <Input
                    value={settings.wsEndpoint}
                    onChange={(e) => handleChange('wsEndpoint', e.target.value)}
                  />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block">手机设备</label>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleRefreshDevices}
                      disabled={loadingDevices}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Select
                      value={settings.phoneSerialNumber}
                      onValueChange={(value) => handleChange('phoneSerialNumber', value)}
                      disabled={loadingDevices}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="选择设备" />
                      </SelectTrigger>
                      <SelectContent>
                        {loadingDevices && <SelectItem value="loading">加载中...</SelectItem>}
                        {deviceError && <SelectItem value="error">错误: {deviceError}</SelectItem>}
                        {devices.map((device) => (
                          <SelectItem key={device.deviceId} value={device.deviceId}>
                            {device.deviceId} ({device.screenSize})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      value={settings.phoneSerialNumber}
                      onChange={(e) => handleChange('phoneSerialNumber', e.target.value)}
                      placeholder="或手动输入设备串号"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="tts">
          <Card>
            <CardHeader>TTS设置</CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="block mb-1">TTS Base URL</label>
                  <Input
                    value={settings.tts_baseUrl}
                    onChange={(e) => handleChange('tts_baseUrl', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block mb-1">TTS API Key</label>
                  <Input
                    type="password"
                    value={settings.tts_apiKey}
                    onChange={(e) => handleChange('tts_apiKey', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block mb-1">TTS 模型名称</label>
                  <Input
                    value={settings.tts_modelName}
                    onChange={(e) => handleChange('tts_modelName', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block mb-1">TTS Group ID</label>
                  <Input
                    value={settings.tts_groupId}
                    onChange={(e) => handleChange('tts_groupId', e.target.value)}
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