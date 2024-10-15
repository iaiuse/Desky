import Dexie from 'dexie';

export interface IProject {
  id?: number;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  content: {
    script?: string;
    [key: string]: any;
  };
  scenes?: Scene[];
}

export interface IMidjourneyTask {
  id: string;
  projectId: number;
  sceneId: number;
  status: 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILURE';
  imageUrl: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Scene {
  id: number;
  text: string;
  description: string;
  mjPrompt: string; // 添加MJ提示词
  image: string | null;
  video: string | null; // 添加 video 属性
}

export interface ISetting {
  key: string;
  value: any;
}

export interface IPrompt {
  id?: number;
  type: 'script_split' | 'mj_generation';
  content: string;
}

export interface IHistory {
  id?: number;
  projectId: number;
  action: string;
  timestamp: Date;
}

export interface APISettings {
  chatgpt: { key: string; url: string };
  midjourney: { key: string; url: string };
  keli: { key: string; url: string };
  runway: { key: string; url: string };
}

class VideoCreationToolDB extends Dexie {
  projects: Dexie.Table<IProject, number>;
  settings: Dexie.Table<ISetting, string>;
  prompts: Dexie.Table<IPrompt, number>;
  history: Dexie.Table<IHistory, number>;
  midjourneyTasks: Dexie.Table<IMidjourneyTask, string>;


  constructor() {
    super('VideoCreationToolDB');
    this.version(1).stores({
      projects: '++id, name, createdAt, updatedAt',
      settings: 'key, value',
      prompts: '++id, type, content',
      history: '++id, projectId, action, timestamp',
      midjourneyTasks: 'id, projectId, sceneId, status, createdAt, updatedAt'
    });
    this.projects = this.table('projects');
    this.settings = this.table('settings');
    this.prompts = this.table('prompts');
    this.history = this.table('history');
    this.midjourneyTasks = this.table('midjourneyTasks');
  }
}

export const db = new VideoCreationToolDB();