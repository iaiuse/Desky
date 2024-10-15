import React, { useState, useEffect } from 'react';
import { Button } from "./ui/button";
import { Card, CardContent, CardFooter } from "./ui/card";
import { Progress } from "./ui/progress";
import { useMidjourney, MidjourneyTask } from "../hooks/useMidjourney";
import { db, IMidjourneyTask } from '../lib/db';
import { invoke } from '@tauri-apps/api/tauri';
import { logger } from '../utils/logger';

const ModelName = 'ImageGenerator';

interface ImageGeneratorProps {
  prompt: string;
  projectId: number;
  sceneId: number;
  onImageSelect: (imageUrl: string) => void;
}

export const ImageGenerator: React.FC<ImageGeneratorProps> = ({ prompt, projectId, sceneId, onImageSelect }) => {
  const [taskInfo, setTaskInfo] = useState<{ taskId: string; channelId: string; instanceId: string } | null>(null);
  const [taskStatus, setTaskStatus] = useState<'IDLE' | 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILURE'>('IDLE');
  const [images, setImages] = useState<string[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const { generateImages, checkTaskStatus,  error: midjourneyError } = useMidjourney();
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (taskInfo && (taskStatus === 'PENDING' || taskStatus === 'PROCESSING')) {
      interval = setInterval(async () => {
        try {
          const task = await checkTaskStatus(taskInfo.taskId);
          setTaskStatus(task.status);
          if (task.status === 'SUCCESS' && task.imageUrl) {
            setImages(task.imageUrl);
            clearInterval(interval);
            logger.log(`Successfully generated images for task ${taskInfo.taskId}`, 'INFO', ModelName);
            await saveTaskResult(taskInfo.taskId, task);
          } else if (task.status === 'FAILURE') {
            setError('Image generation failed. Please try again.');
            clearInterval(interval);
            logger.log(`Image generation failed for task ${taskInfo.taskId}`, 'ERROR', ModelName);
          } else if (task.status === 'PROCESSING') {
            setProgress((prevProgress) => Math.min(prevProgress + 10, 90));
          }
        } catch (err) {
          console.error('Error checking task status:', err);
          setError('Error checking task status. Please try again.');
          clearInterval(interval);
          logger.log(`Error checking task status for task ${taskInfo.taskId}: ${err}`, 'ERROR', ModelName);
        }
      }, 5000); // Check every 5 seconds
    }
    return () => clearInterval(interval);
  }, [taskInfo, taskStatus, checkTaskStatus]);

  const handleGenerateImages = async () => {
    try {
      setTaskStatus('PENDING');
      setProgress(0);
      setError(null);
      const info = await generateImages(prompt);
      setTaskInfo(info);
      logger.log(`Started image generation task ${info.taskId}`, 'INFO', ModelName);
      await saveTaskResult(info.taskId, { id: info.taskId, status: 'PENDING', imageUrl: [] });
    } catch (err) {
      console.error('Error generating images:', err);
      setError('Error starting image generation. Please try again.');
      setTaskStatus('IDLE');
      logger.log(`Error generating images: ${err}`, 'ERROR', ModelName);
    }
  };

  const saveTaskResult = async (taskId: string, task: MidjourneyTask) => {
    try {
      const taskToSave: IMidjourneyTask = {
        id: taskId,
        projectId,
        sceneId,
        status: task.status,
        imageUrl: task.imageUrl || [],
        createdAt: new Date(),
        updatedAt: new Date()
      };
      await db.midjourneyTasks.put(taskToSave);
    } catch (err) {
      console.error('Error saving task result:', err);
      logger.log(`Error saving task result: ${err}`, 'ERROR', ModelName);
    }
  };

  const handleSelectImage = async (imageUrl: string) => {
    setSelectedImage(imageUrl);
    try {
      const fileName = `${projectId}_${sceneId}_${Date.now()}.png`;
      const filePath = `projects/${projectId}/scenes/${sceneId}/${fileName}`;
      
      await invoke('save_image', { url: imageUrl, filePath });
      logger.log(`Saved image to ${filePath}`, 'INFO', ModelName);
  
      await db.projects.where({ id: projectId }).modify(project => {
        if (project.scenes) {
          project.scenes = project.scenes.map(scene => 
            scene.id === sceneId ? { ...scene, image: filePath } : scene
          );
        }
      });
      logger.log(`Updated scene ${sceneId} with new image path`, 'INFO', ModelName);
  
      onImageSelect(filePath);
    } catch (err) {
      console.error('Error saving image:', err);
      setError('Error saving image. Please try again.');
      logger.log(`Error saving image: ${err}`, 'ERROR', ModelName);
    }
  };

  const handleVariation = async (imageUrl: string, type: 'v' | 'u') => {
    try {
      setTaskStatus('PENDING');
      setProgress(0);
      setError(null);
      const info = await generateImages(`${type}1 ${imageUrl}`);
      setTaskInfo(info);
      logger.log(`Started ${type === 'v' ? 'variation' : 'upscale'} task ${info.taskId}`, 'INFO', ModelName);
      await saveTaskResult(info.taskId, { id: info.taskId, status: 'PENDING', imageUrl: [] });
    } catch (err) {
      console.error(`Error generating ${type === 'v' ? 'variation' : 'upscaled'} image:`, err);
      setError(`Error generating ${type === 'v' ? 'variation' : 'upscaled'} image. Please try again.`);
      setTaskStatus('IDLE');
      logger.log(`Error generating ${type === 'v' ? 'variation' : 'upscaled'} image: ${err}`, 'ERROR', ModelName);
    }
  };

  const renderContent = () => {
    switch (taskStatus) {
      case 'IDLE':
        return null;
      case 'PENDING':
      case 'PROCESSING':
        return (
          <div>
            <Progress value={progress} className="w-full mb-2" />
            <p>{taskStatus === 'PENDING' ? 'Preparing to generate images...' : 'Generating images...'}</p>
          </div>
        );
      case 'SUCCESS':
        return (
          <div className="grid grid-cols-2 gap-2 mt-4">
            {images.map((img, index) => (
              <div key={index} className="relative">
                <img src={img} alt={`Generated image ${index + 1}`} className="w-full h-auto" />
                <div className="absolute top-0 right-0 space-x-1">
                  <Button size="sm" onClick={() => handleVariation(img, 'v')}>V1</Button>
                  <Button size="sm" onClick={() => handleVariation(img, 'u')}>U1</Button>
                </div>
                <Button onClick={() => handleSelectImage(img)} className="mt-2 w-full">Select</Button>
              </div>
            ))}
          </div>
        );
      case 'FAILURE':
        return (
          <p className="text-red-500 mt-2">{error}</p>
        );
    }
  };

  return (
    <Card>
      <CardContent>
        {renderContent()}
        {midjourneyError && <div className="text-red-500 mt-2">Midjourney Error: {midjourneyError}</div>}
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button 
          onClick={handleGenerateImages} 
          disabled={taskStatus === 'PENDING' || taskStatus === 'PROCESSING'}
        >
          {taskStatus === 'SUCCESS' ? 'Regenerate Images' : 'Generate Images'}
        </Button>
        <Button 
          disabled={!selectedImage || taskStatus === 'PENDING' || taskStatus === 'PROCESSING'} 
          onClick={() => logger.log('Generate Video button clicked', 'INFO', ModelName)}
        >
          Generate Video
        </Button>
      </CardFooter>
    </Card>
  );
};