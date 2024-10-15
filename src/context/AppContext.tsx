import React, { createContext, useContext, useState, useEffect } from 'react';
import { db, IProject } from '../lib/db';

interface AppContextType {
  currentProject: IProject | null;
  setCurrentProject: (project: IProject | null) => void;
  workflowState: string;
  setWorkflowState: (state: string) => void;
  userSettings: any;
  setUserSettings: (settings: any) => void;
  apiStatus: { gpt: boolean; midjourney: boolean; jianying: boolean };
  setApiStatus: (status: { gpt: boolean; midjourney: boolean; jianying: boolean }) => void;
}

// 定义一个新的接口来表示用户设置对象的结构
interface UserSettings {
  [key: string]: any;  // 这允许任何字符串键和任何类型的值
}

export const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentProject, setCurrentProject] = useState<IProject | null>(null);
  const [workflowState, setWorkflowState] = useState<string>('input');
  const [userSettings, setUserSettings] = useState<any>({});
  const [apiStatus, setApiStatus] = useState({ gpt: false, midjourney: false, jianying: false });

  useEffect(() => {
    const loadSettings = async () => {
      const settings = await db.settings.toArray();
      const loadedSettings = settings.reduce<UserSettings>((acc, setting) => {
        acc[setting.key] = setting.value;
        return acc;
      }, {} as UserSettings);  // 明确指定初始值的类型
      setUserSettings(loadedSettings);
    };
  
    loadSettings();
  }, []);

  return (
    <AppContext.Provider value={{
      currentProject, setCurrentProject,
      workflowState, setWorkflowState,
      userSettings, setUserSettings,
      apiStatus, setApiStatus
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};