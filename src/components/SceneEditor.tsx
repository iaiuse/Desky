import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Textarea } from "./ui/textarea";
import { Button } from "./ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Badge } from "./ui/badge";
import { IProject, Scene } from '../lib/db';
import { ImageGenerator } from './ImageGenerator';
import { db } from '../lib/db';
import { logger } from '../utils/logger';

interface SceneEditorProps {
  project: IProject;
}

export const SceneEditor: React.FC<SceneEditorProps> = ({ project }) => {
  const [scenes, setScenes] = useState<Scene[]>(project.scenes || []);
  const [filter, setFilter] = useState<'all' | 'image' | 'video'>('all');

  useEffect(() => {
    setScenes(project.scenes || []);
  }, [project]);

  const handleSceneUpdate = async (updatedScene: Scene) => {
    if (typeof project.id !== 'number') {
      logger.log('Invalid project ID', 'ERROR');
      return;
    }

    const updatedScenes = scenes.map(scene => scene.id === updatedScene.id ? updatedScene : scene);
    setScenes(updatedScenes);
    
    try {
      await db.projects.update(project.id, { scenes: updatedScenes });
      logger.log(`Updated scenes for project ${project.id}`, 'INFO');
    } catch (error) {
      logger.log(`Failed to update scenes for project ${project.id}: ${error}`, 'ERROR');
    }
  };

  const handleGenerateAllImages = async () => {
    // Implement logic to generate images for all scenes
    console.log('Generating images for all scenes');
  };

  const filteredScenes = scenes.filter(scene => {
    if (filter === 'all') return true;
    if (filter === 'image') return scene.image;
    if (filter === 'video') return scene.video;
    return true;
  });

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">{project.name} - Scene Editor</h1>
        <div className="flex space-x-2">
          <Select value={filter} onValueChange={(value: 'all' | 'image' | 'video') => setFilter(value)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter scenes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Scenes</SelectItem>
              <SelectItem value="image">With Images</SelectItem>
              <SelectItem value="video">With Videos</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleGenerateAllImages}>Generate All Images</Button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
        {filteredScenes.map((scene) => (
          <Card key={scene.id}>
            <CardHeader>
              <CardTitle className="flex justify-between items-center">
                Scene {scene.id}
                <div>
                  {scene.image && <Badge variant="secondary" className="mr-2">Image</Badge>}
                  {scene.video && <Badge variant="secondary">Video</Badge>}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={scene.text}
                onChange={(e) => handleSceneUpdate({ ...scene, text: e.target.value })}
                placeholder="Scene text"
                className="mb-2"
              />
              <Textarea
                value={scene.mjPrompt}
                onChange={(e) => handleSceneUpdate({ ...scene, mjPrompt: e.target.value })}
                placeholder="Midjourney prompt"
                className="mb-2"
              />
              <ImageGenerator
                prompt={scene.mjPrompt}
                projectId={project.id!}
                sceneId={scene.id}
                onImageSelect={(imageUrl) => handleSceneUpdate({ ...scene, image: imageUrl })}
              />
              <Button onClick={() => console.log('Generate video for scene', scene.id)} className="mt-2">Generate Video</Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};