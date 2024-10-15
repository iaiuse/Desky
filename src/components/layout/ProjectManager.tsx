import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { db, IProject } from '../../lib/db';

export const ProjectManager: React.FC = () => {
    const navigate = useNavigate();
    const [projects, setProjects] = useState<IProject[]>([]);
    const [newProjectName, setNewProjectName] = useState('');

    useEffect(() => {
        loadProjects();
    }, []);

    const loadProjects = async () => {
        const loadedProjects = await db.projects.toArray();
        setProjects(loadedProjects);
    };

    const handleCreateProject = async () => {
        if (newProjectName.trim() === '') return;
        const newProject: IProject = {
            name: newProjectName,
            createdAt: new Date(),
            updatedAt: new Date(),
            content: {}
        };
        try {
            const id = await db.projects.add(newProject);
            console.log(`Created new project with id: ${id}`);
            setNewProjectName('');
            loadProjects(); // Reload projects after adding new one
        } catch (error) {
            console.error('Error creating project:', error);
        }
    };

    const handleOpenProject = (projectId: number) => {
        navigate(`/project/${projectId}`);
    };

    const handleDeleteProject = async (projectId: number) => {
        try {
            await db.projects.delete(projectId);
            loadProjects(); // Reload projects after deletion
        } catch (error) {
            console.error('Error deleting project:', error);
        }
    };

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-2xl font-bold mb-4">Project Manager</h1>
            <Card className="mb-4">
                <CardHeader>
                    <CardTitle>Create New Project</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex space-x-2">
                        <Input
                            value={newProjectName}
                            onChange={(e) => setNewProjectName(e.target.value)}
                            placeholder="Enter project name"
                        />
                        <Button onClick={handleCreateProject}>Create</Button>
                    </div>
                </CardContent>
            </Card>
            <h2 className="text-xl font-bold mb-2">Your Projects</h2>
            {projects.map(project => (
                <Card key={project.id} className="mb-2">
                    <CardContent className="flex justify-between items-center">
                        <div>
                            <h3 className="font-bold">{project.name} - {project.id}</h3>
                            <p className="text-sm text-gray-500">
                                Last modified: {project.updatedAt.toLocaleString()}
                            </p>
                        </div>
                        <div>
                            <Button onClick={() => project.id && handleOpenProject(project.id)} className="mr-2">Open</Button>
                            <Button onClick={() => project.id && handleDeleteProject(project.id)} variant="destructive">Delete</Button>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
};