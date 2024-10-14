import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/tauri';

const ConfigPanel: React.FC = () => {
  const [apiKey, setApiKey] = useState('');
  const [serialPort, setSerialPort] = useState('');

  const handleSaveConfig = async () => {
    try {
      // Save API key (in a real app, you'd want to store this securely)
      // For demo purposes, we're just logging it
      console.log('Saving API key:', apiKey);

      // Update serial port
      await invoke('set_serial_port', { port: serialPort });

      alert('Configuration saved successfully!');
    } catch (error) {
      console.error('Failed to save configuration:', error);
      alert('Failed to save configuration. Please try again.');
    }
  };

  return (
    <div className="bg-white p-4 rounded shadow">
      <h2 className="text-xl font-bold mb-4">Configuration</h2>
      <div className="mb-4">
        <label className="block mb-2">OpenAI API Key:</label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          className="w-full p-2 border rounded"
        />
      </div>
      <div className="mb-4">
        <label className="block mb-2">Serial Port:</label>
        <input
          type="text"
          value={serialPort}
          onChange={(e) => setSerialPort(e.target.value)}
          className="w-full p-2 border rounded"
        />
      </div>
      <button
        onClick={handleSaveConfig}
        className="bg-blue-500 text-white p-2 rounded hover:bg-blue-600"
      >
        Save Configuration
      </button>
    </div>
  );
};

export default ConfigPanel;