import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { MainLayout } from './components/layout/MainLayout';
import { SettingsPanel } from './components/SettingsPanel';
import { InteractionPage } from './pages/InteractionPage';
import { HelpPage } from './pages/Help';
import { LogPage } from './pages/Log';
import { RobotProvider } from './context/RobotContext';

const App: React.FC = () => {
  const [isConfigured, setIsConfigured] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkConfiguration = async () => {
      try {
        // Implement actual configuration check logic here
        const response = await fetch('/api/config');
        const config = await response.json();
        setIsConfigured(config.isComplete);
      } catch (error) {
        console.error('Failed to check configuration:', error);
        // Handle error appropriately
      } finally {
        setIsLoading(false);
      }
    };
    checkConfiguration();
  }, []);

  if (isLoading) {
    return <div>Loading...</div>; // Or a more sophisticated loading component
  }

  return (
    <RobotProvider>
      <Router>
        <MainLayout>
          <Routes>
            <Route 
              path="/" 
              element={isConfigured ? <InteractionPage /> : <Navigate to="/settings" />} 
            />
            <Route 
              path="/settings" 
              element={<SettingsPanel setIsConfigured={setIsConfigured} />} 
            />
            <Route path="/help" element={<HelpPage />} />
            <Route path="/log" element={<LogPage />} />
          </Routes>
        </MainLayout>
      </Router>
    </RobotProvider>
  );
}

export default App;