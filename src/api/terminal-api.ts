import { invoke } from './invoke';
import type { TerminalAvailability, TerminalSession, TerminalShell } from '../types';

type DataListener = (data: string) => void;
const dataListeners = new Map<string, Set<DataListener>>();
let dataUnsubscribe: (() => void) | null = null;

export const terminalApi = {
  available: () => invoke<TerminalAvailability>('term:available'),
  shells: () => invoke<TerminalShell[]>('term:shells'),
  create: (repoPath: string, shellId: string | null, cols: number, rows: number) =>
    invoke<TerminalSession>('term:create', repoPath, shellId, cols, rows),
  write: (id: string, data: string) => invoke<null>('term:write', id, data),
  resize: (id: string, cols: number, rows: number) => invoke<null>('term:resize', id, cols, rows),
  kill: (id: string) => invoke<null>('term:kill', id),
  list: (repoPath: string) => invoke<TerminalSession[]>('term:list', repoPath),
  /** Everything the session printed so far (trimmed), to replay into a fresh view. */
  buffer: (id: string) => invoke<string>('term:buffer', id),
  openLink: (url: string) => invoke<null>('term:open-link', url),
  /**
   * One session's output. A single IPC listener fans out by id: one per pane
   * would make every chunk walk every pane.
   */
  onSessionData: (id: string, listener: DataListener): (() => void) => {
    dataUnsubscribe ??= window.electronAPI.onTerminalData((sessionId, data) =>
      dataListeners.get(sessionId)?.forEach(fn => fn(data)),
    );
    let set = dataListeners.get(id);
    if (!set) dataListeners.set(id, (set = new Set()));
    set.add(listener);
    return () => {
      set.delete(listener);
      if (set.size === 0) dataListeners.delete(id);
    };
  },
  onExit: (cb: (id: string, exitCode: number) => void) => window.electronAPI.onTerminalExit(cb),
};
