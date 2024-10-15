import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';

export const Home: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-4">Welcome to Video Creation Tool</h1>
      <p className="mb-4">Get started by creating a new project or viewing your existing projects.</p>
      <div className="space-x-4">
        <Button onClick={() => navigate('/projects')}>View Projects</Button>
        <Button onClick={() => navigate('/project/new')}>Create New Project</Button>
      </div>
    </div>
  );
};