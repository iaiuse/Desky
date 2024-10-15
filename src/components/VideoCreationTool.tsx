// src/components/VideoCreationTool.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { ScriptInput } from './ScriptInput';
import { SceneEditor } from './SceneEditor';
import { db, IProject, Scene } from '../lib/db';
import { LoadingOverlay } from './LoadingOverlay';
import { logger } from '../utils/logger'; // Import the logger
import { invoke } from '@tauri-apps/api/tauri'; // Import invoke

export const VideoCreationTool: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<IProject | null>(null);
  const [showSceneEditor, setShowSceneEditor] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('Initializing...');
  const [error, setError] = useState<string | null>(null);
  const ModelName = "VideoCreationTool";

  useEffect(() => {
    const loadProject = async () => {
      logger.log(`Loading project, projectId: ${projectId}`, 'INFO');
      if (!projectId) {
        const errorMessage = 'No project ID provided';
        logger.log(errorMessage, 'ERROR');
        setError(errorMessage);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setLoadingMessage('Loading project...');
      try {
        const numericProjectId = parseInt(projectId, 10);

        if (isNaN(numericProjectId)) {
          throw new Error('Invalid project ID');
        }

        const loadedProject = await db.projects.get(numericProjectId);

        logger.log(`Loaded project: ${JSON.stringify(loadedProject)}`, 'INFO');
        if (loadedProject) {
          logger.log(`Project content: ${JSON.stringify(loadedProject.content)}`, 'INFO');
          setProject(loadedProject);
        } else {
          const errorMessage = `Project with ID ${numericProjectId} not found`;
          logger.log(errorMessage, 'ERROR');
          setError(errorMessage);
        }
      } catch (error) {
        const errorMessage = `Error loading project: ${error instanceof Error ? error.message : String(error)}`;
        logger.log(errorMessage, 'ERROR');
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    loadProject();
  }, [projectId]);

  const handleScriptSubmit = useCallback(async (script: string) => {
    if (!project || !project.id || script.trim() === '') {
      const errorMessage = 'Invalid project or empty script';
      logger.log(errorMessage, 'WARN');
      alert(errorMessage);
      return;
    }

    try {
      setIsLoading(true);
      setLoadingMessage('Splitting script into scenes...');
      logger.log(`Splitting script for project ${project.id}. Script length: ${script.length}`, 'INFO', ModelName);

      // 从数据库获取 API Key 和 Base URL
      const apiKeySetting = await db.settings.get('chatgpt_key');
      const apiBaseSetting = await db.settings.get('chatgpt_url');
      logger.log(`key: ${apiBaseSetting}, base: ${apiBaseSetting}`, "INFO", ModelName);

      if (!apiKeySetting?.value || !apiBaseSetting?.value) {
        throw new Error('ChatGPT API settings not found in database');
      }

      // 使用 Tauri 的 invoke 方法调用 Rust 命令，传递参数
      const scenes: Scene[] = await invoke('split_script', {
        script,
        projectId: project.id,
        apiKey: apiKeySetting.value,
        apiBaseUrl: apiBaseSetting.value,
      });

      logger.log(`Script split into ${scenes.length} scenes, ${scenes}`, 'INFO', ModelName);

      const updatedProject: IProject = {
        ...project,
        content: { ...project.content, script },
        scenes,
        updatedAt: new Date(),
      };

      await db.projects.update(project.id, {
        content: updatedProject.content,
        scenes: updatedProject.scenes,
        updatedAt: updatedProject.updatedAt,
      });
      logger.log(`Project ${project.id} updated with new scenes. New content: ${JSON.stringify(updatedProject.content)}`, 'INFO', ModelName);

      setProject(updatedProject);
      setShowSceneEditor(true);
    } catch (error) {
      const errorMessage = `Error splitting script: ${error instanceof Error ? error.message : String(error)}`;
      logger.log(errorMessage, 'ERROR', ModelName);
      alert('Failed to split script. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [project]);


  if (isLoading) {
    return <LoadingOverlay isVisible={true} message={loadingMessage} />;
  }

  if (error) {
    return <div className="text-red-500">Error: {error}</div>;
  }

  if (!project) {
    return <div>No project data available.</div>;
  }

  if (showSceneEditor) {
    return <SceneEditor project={project} />;
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">{project.name}</h1>
      <ScriptInput
        initialScript={project.content.script || ''}
        onScriptSubmit={handleScriptSubmit}
        isLoading={isLoading}
      />
    </div>
  );
};
