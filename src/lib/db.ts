import Dexie from 'dexie';


export interface ISetting {
  key: string;
  value: any;
}

export interface IHistory {
  id?: number;
  projectId: number;
  action: string;
  timestamp: Date;
}

class DeskyDB extends Dexie {
  settings: Dexie.Table<ISetting, string>;
  history: Dexie.Table<IHistory, number>;
  

  constructor() {
    super('DeskyDB');
    this.version(1).stores({
      settings: 'key, value',
      history: '++id, projectId, action, timestamp',
      
    });
    this.settings = this.table('settings');
    this.history = this.table('history');
    
  }
}

export const db = new DeskyDB();