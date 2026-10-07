import { invoke } from './invoke';
import type { LogEntry, LogRetention, LogStats } from '../types';

export const logApi = {
  list: (repoPath: string, before?: number, limit?: number) =>
    invoke<LogEntry[]>('log:list', repoPath, before, limit),
  stats: (repoPath: string) => invoke<LogStats>('log:stats', repoPath),
  clear: (repoPath: string) => invoke<null>('log:clear', repoPath),
  getRetention: () => invoke<LogRetention>('log:get-retention'),
  setRetention: (retention: LogRetention) => invoke<null>('log:set-retention', retention),
  openFolder: (repoPath: string) => invoke<null>('log:open-folder', repoPath),
  /** Running entries arrive too, then again once settled, under the same id. */
  onEntry: (cb: (entry: LogEntry) => void): (() => void) => window.electronAPI.onLogEntry(cb),
};
