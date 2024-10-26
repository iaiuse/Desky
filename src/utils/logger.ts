import { invoke } from '@tauri-apps/api';

type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

class Logger {
  

  async log(message: string, level: LogLevel = 'INFO', module: string = 'default') {  // Added module parameter
    try {
      await invoke('log_message', { message, level, module }); // Pass module to Rust
      console.log(`[${level}] ${module}: ${message}`);
    } catch (error) {
      console.error('Failed to log message to backend:', error);
    }
  }

  async getLogs(): Promise<string> {
    try {
      return await invoke('get_logs');
    } catch (error) {
      console.error('Failed to get logs from backend:', error);
      return 'Failed to retrieve logs';
    }
  }

  async clearLogs(): Promise<void> {
    try {
      await invoke('clear_logs');
    } catch (error) {
      console.error('Failed to clear logs:', error);
    }
  }
}

export const logger = new Logger();