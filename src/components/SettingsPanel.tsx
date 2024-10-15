import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { db, APISettings } from '../lib/db';

interface Preferences {
  theme: string;
  language: string;
  mjMode: string;
  model: string;
}

export const SettingsPanel: React.FC = () => {
  const [apiSettings, setApiSettings] = useState<APISettings>({
    chatgpt: { key: '', url: '' },
    midjourney: { key: '', url: '' },
    keli: { key: '', url: '' },
    runway: { key: '', url: '' },
  });
  const [prompts, setPrompts] = useState({ scriptSplit: '', mjGeneration: '' });
  const [preferences, setPreferences] = useState<Preferences>({ 
    theme: 'light', 
    language: 'en',
    mjMode: 'fast',
    model: 'gpt-3.5-turbo'
  });

  useEffect(() => {
    const loadSettings = async () => {
      const settings = await db.settings.toArray();
      const loadedPrompts = await db.prompts.toArray();

      const loadedApiSettings: APISettings = {
        chatgpt: { key: '', url: '' },
        midjourney: { key: '', url: '' },
        keli: { key: '', url: '' },
        runway: { key: '', url: '' },
      };

      settings.forEach(setting => {
        const [service, type] = setting.key.split('_');
        if (loadedApiSettings[service as keyof APISettings]) {
          loadedApiSettings[service as keyof APISettings][type as 'key' | 'url'] = setting.value;
        }
      });

      setApiSettings(loadedApiSettings);

      setPrompts({
        scriptSplit: loadedPrompts.find(p => p.type === 'script_split')?.content || '',
        mjGeneration: loadedPrompts.find(p => p.type === 'mj_generation')?.content || '',
      });

      setPreferences({
        theme: settings.find(s => s.key === 'pref_theme')?.value || 'light',
        language: settings.find(s => s.key === 'pref_language')?.value || 'en',
        mjMode: settings.find(s => s.key === 'pref_mjMode')?.value || 'fast',
        model: settings.find(s => s.key === 'pref_model')?.value || 'gpt-3.5-turbo',
      });
    };

    loadSettings();
  }, []);

  const saveSettings = async () => {
    const settingsToSave = Object.entries(apiSettings).flatMap(([service, settings]) => [
      { key: `${service}_key`, value: settings.key },
      { key: `${service}_url`, value: settings.url },
    ]);

    await db.settings.bulkPut([
      ...settingsToSave,
      { key: 'pref_theme', value: preferences.theme },
      { key: 'pref_language', value: preferences.language },
      { key: 'pref_mjMode', value: preferences.mjMode },
      { key: 'pref_model', value: preferences.model },
    ]);

    await db.prompts.clear();
    await db.prompts.bulkAdd([
      { type: 'script_split', content: prompts.scriptSplit },
      { type: 'mj_generation', content: prompts.mjGeneration },
    ]);

    alert('Settings saved successfully!');
  };

  const renderApiSettings = (service: keyof APISettings, label: string) => (
    <div className="border p-4 rounded-md mb-4">
      <h3 className="font-bold mb-2">{label} Settings</h3>
      <div className="space-y-2">
        <label htmlFor={`${service}-api-key`}>API Key</label>
        <Input
          id={`${service}-api-key`}
          type="password"
          value={apiSettings[service].key}
          onChange={(e) => setApiSettings({...apiSettings, [service]: {...apiSettings[service], key: e.target.value}})}
        />
        <label htmlFor={`${service}-api-url`}>API URL</label>
        <Input
          id={`${service}-api-url`}
          type="text"
          value={apiSettings[service].url}
          onChange={(e) => setApiSettings({...apiSettings, [service]: {...apiSettings[service], url: e.target.value}})}
        />
      </div>
    </div>
  );

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Settings</h1>
      <Tabs defaultValue="api">
        <TabsList>
          <TabsTrigger value="api">API Management</TabsTrigger>
          <TabsTrigger value="prompts">Prompt Management</TabsTrigger>
          <TabsTrigger value="preferences">User Preferences</TabsTrigger>
        </TabsList>
        <TabsContent value="api">
          <div className="space-y-4">
            {renderApiSettings('chatgpt', 'ChatGPT')}
            {renderApiSettings('midjourney', 'Midjourney')}
            {renderApiSettings('keli', 'Keli')}
            {renderApiSettings('runway', 'Runway')}
          </div>
        </TabsContent>
        <TabsContent value="prompts">
          <div className="space-y-4">
            <div>
              <label htmlFor="script-split-prompt">Script Split Prompt</label>
              <Textarea
                id="script-split-prompt"
                value={prompts.scriptSplit}
                onChange={(e) => setPrompts({...prompts, scriptSplit: e.target.value})}
                className="min-h-[200px]"
              />
            </div>
            <div>
              <label htmlFor="mj-generation-prompt">Midjourney Generation Prompt</label>
              <Textarea
                id="mj-generation-prompt"
                value={prompts.mjGeneration}
                onChange={(e) => setPrompts({...prompts, mjGeneration: e.target.value})}
                className="min-h-[200px]"
              />
            </div>
          </div>
        </TabsContent>
        <TabsContent value="preferences">
          <div className="space-y-4">
            <div>
              <label htmlFor="theme-select">Theme</label>
              <Select
                value={preferences.theme}
                onValueChange={(value: string) => setPreferences({...preferences, theme: value})}
              >
                <SelectTrigger id="theme-select">
                  <SelectValue placeholder="Select theme" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label htmlFor="language-select">Language</label>
              <Select
                value={preferences.language}
                onValueChange={(value: string) => setPreferences({...preferences, language: value})}
              >
                <SelectTrigger id="language-select">
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="zh">中文</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label htmlFor="mj-mode-select">Midjourney Mode</label>
              <Select
                value={preferences.mjMode}
                onValueChange={(value: string) => setPreferences({...preferences, mjMode: value})}
              >
                <SelectTrigger id="mj-mode-select">
                  <SelectValue placeholder="Select Midjourney mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fast">Fast</SelectItem>
                  <SelectItem value="relax">Relax</SelectItem>
                  <SelectItem value="turbo">Turbo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
              <label htmlFor="model-select">AI Model</label>
              <Select
                value={preferences.model}
                onValueChange={(value: string) => setPreferences({...preferences, model: value})}
              >
                <SelectTrigger id="model-select">
                  <SelectValue placeholder="Select AI model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                  <SelectItem value="gpt-4-turbo-preview">GPT-4 Turbo Preview</SelectItem>
                </SelectContent>
              </Select>
            </div>
        </TabsContent>
      </Tabs>
      <Button onClick={saveSettings} className="mt-4">Save All Settings</Button>
    </div>
  );
};