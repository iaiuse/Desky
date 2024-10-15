import React, { createContext, useContext, useState } from 'react';

interface RobotContextType {
  robotStatus: {
    network: string;
    device: string;
    servoX: number;
    servoY: number;
  };
  setRobotStatus: (status: Partial<RobotContextType['robotStatus']>) => void;
  apiStatus: { 
    llm: boolean; 
    videoProcessing: boolean; 
    servoControl: boolean;
  };
  setApiStatus: (status: Partial<RobotContextType['apiStatus']>) => void;
  userSettings: {
    videoEnabled: boolean;
  };
  setUserSettings: (settings: Partial<RobotContextType['userSettings']>) => void;
}

const defaultRobotStatus = {
  network: 'Disconnected',
  device: 'Offline',
  servoX: 90,
  servoY: 90,
};

const defaultApiStatus = { 
  llm: false, 
  videoProcessing: false, 
  servoControl: false 
};

const defaultUserSettings = {
  videoEnabled: true,
};

export const RobotContext = createContext<RobotContextType | undefined>(undefined);

export const RobotProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [robotStatus, setRobotStatus] = useState(defaultRobotStatus);
  const [apiStatus, setApiStatus] = useState(defaultApiStatus);
  const [userSettings, setUserSettings] = useState(defaultUserSettings);

  const updateRobotStatus = (status: Partial<RobotContextType['robotStatus']>) => {
    setRobotStatus(prevStatus => ({ ...prevStatus, ...status }));
  };

  const updateApiStatus = (status: Partial<RobotContextType['apiStatus']>) => {
    setApiStatus(prevStatus => ({ ...prevStatus, ...status }));
  };

  const updateUserSettings = (settings: Partial<RobotContextType['userSettings']>) => {
    setUserSettings(prevSettings => ({ ...prevSettings, ...settings }));
  };

  return (
    <RobotContext.Provider value={{
      robotStatus, 
      setRobotStatus: updateRobotStatus,
      apiStatus, 
      setApiStatus: updateApiStatus,
      userSettings,
      setUserSettings: updateUserSettings
    }}>
      {children}
    </RobotContext.Provider>
  );
};

export const useRobotContext = () => {
  const context = useContext(RobotContext);
  if (context === undefined) {
    throw new Error('useRobotContext must be used within a RobotProvider');
  }
  return context;
};