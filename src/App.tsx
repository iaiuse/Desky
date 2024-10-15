import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { MainLayout } from './components/layout/MainLayout';
import { ProjectManager } from './components/layout/ProjectManager';
import { VideoCreationTool } from './components/VideoCreationTool';
import { SettingsPanel } from './components/SettingsPanel';
import { HelpPage } from './pages/Help';
import { LogPage } from './pages/Log';

function App() {
  return (
    <Router>
      <MainLayout>
        <Routes>
          <Route path="/" element={<ProjectManager />} />
          <Route path="/projects" element={<ProjectManager />} />
          <Route path="/project/:projectId" element={<VideoCreationTool />} />
          <Route path="/settings" element={<SettingsPanel />} />
          <Route path="/help" element={<HelpPage />} />
            <Route path="/log" element={<LogPage />} />
        </Routes>
      </MainLayout>
    </Router>
  );
}

export default App;