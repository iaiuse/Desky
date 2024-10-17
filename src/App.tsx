import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { MainLayout } from './components/layout/MainLayout';
import { SettingsPanel } from './components/SettingsPanel';
import { InteractionPage } from './pages/InteractionPage';
import { HelpPage } from './pages/Help';
import { LogPage } from './pages/Log';
import { RobotProvider } from './context/RobotContext';
import { db } from './lib/db';
import { Spinner } from './components/ui/spinner';
import { Toaster } from './components/ui/toaster';
import { useToast } from './hooks/useToast';

const App: React.FC = () => {
  const [isConfigured, setIsConfigured] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const checkConfiguration = async () => {
      try {
        const settings = await db.settings.toArray();
        const requiredSettings = ['apiUrl', 'apiKey', 'modelName', 'deviceName', 'phoneIpAddress', 'serialPort'];
        const isConfigured = requiredSettings.every(key => 
          settings.some(setting => setting.key === key && setting.value)
        );
        setIsConfigured(isConfigured);
      } catch (error) {
        console.error('Failed to check configuration:', error);
        setIsConfigured(false);
      } finally {
        setIsLoading(false);
      }
    };
    checkConfiguration();
  }, []);

  useEffect(() => {
    if (!isConfigured && !isLoading) {
      toast({
        message: "请在设置页面完成设置。",
        type: "warning",
        options: { duration: 5000 }
      });
    }
  }, [isConfigured, isLoading, toast]);

  if (isLoading) {
    return <div className="flex justify-center items-center h-screen"><Spinner /></div>;
  }

  const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
    if (!isConfigured) {
      return <Navigate to="/settings" replace />;
    }
    return <>{children}</>;
  };

  return (
    <RobotProvider>
      <Router>
        <MainLayout>
          <Routes>
            <Route 
              path="/" 
              element={
                <ProtectedRoute>
                  <InteractionPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/settings" 
              element={<SettingsPanel setIsConfigured={setIsConfigured} />} 
            />
            <Route path="/help" element={<HelpPage />} />
            <Route path="/log" element={<LogPage />} />
          </Routes>
          <Toaster />
        </MainLayout>
      </Router>
    </RobotProvider>
  );
}

export default App;