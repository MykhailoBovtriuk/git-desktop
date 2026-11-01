import { invoke } from './invoke';
import type { LogEntry, LogRetention, LogStats, ReportableOp } from '../types';

export const logApi = {
  list: (repoPath: string | null, before?: number, limit?: number) =>
    invoke<LogEntry[]>('log:list', repoPath, before, limit),
  stats: (repoPath: string | null) => invoke<LogStats>('log:stats', repoPath),
  clear: (repoPath: string | null) => invoke<null>('log:clear', repoPath),
  getRetention: () => invoke<LogRetention>('log:get-retention'),
  setRetention: (retention: LogRetention) => invoke<null>('log:set-retention', retention),
  openFolder: (repoPath: string | null) => invoke<null>('log:open-folder', repoPath),
  // Never rejects: reporting a failure must not become one.
  report: (op: ReportableOp, message: string, stack?: string): Promise<string | null> =>
    invoke<string>('log:report', op, message, stack).catch(() => null),
  onEntry: (cb: (entry: LogEntry) => void): (() => void) => window.electronAPI.onLogEntry(cb),
};
