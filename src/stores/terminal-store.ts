import { create } from 'zustand';
import { terminalApi } from '../api/terminal-api';
import type { TerminalSession, TerminalShell } from '../types';

interface TerminalState {
  available: boolean | null;
  unavailableReason: string | null;
  shells: TerminalShell[];
  sessions: Record<string, TerminalSession[]>;
  active: Record<string, string | null>;
  exited: Record<string, number>;
  restored: Record<string, boolean>;
  init: () => Promise<void>;
  restore: (repoPath: string) => Promise<void>;
  create: (repoPath: string, shellId: string | null) => Promise<TerminalSession>;
  restart: (repoPath: string, id: string, shellId: string | null) => Promise<void>;
  close: (repoPath: string, id: string) => void;
  setActive: (repoPath: string, id: string) => void;
  markExited: (id: string, exitCode: number) => void;
}

export const useTerminalStore = create<TerminalState>()((set, get) => ({
  available: null,
  unavailableReason: null,
  shells: [],
  sessions: {},
  active: {},
  exited: {},
  restored: {},

  init: async () => {
    if (get().available !== null) return;
    const result = await terminalApi.available();
    const shells = result.ok ? await terminalApi.shells() : [];
    set({ available: result.ok, unavailableReason: result.reason ?? null, shells });
  },

  restore: async repoPath => {
    const live = await terminalApi.list(repoPath);
    set(s => {
      const known = new Set((s.sessions[repoPath] ?? []).map(t => t.id));
      const merged = [...(s.sessions[repoPath] ?? []), ...live.filter(t => !known.has(t.id))];
      return {
        sessions: { ...s.sessions, [repoPath]: merged },
        active: { ...s.active, [repoPath]: s.active[repoPath] ?? merged[0]?.id ?? null },
        restored: { ...s.restored, [repoPath]: true },
      };
    });
  },

  create: async (repoPath, shellId) => {
    const session = await terminalApi.create(repoPath, shellId, 80, 24);
    set(s => ({
      sessions: { ...s.sessions, [repoPath]: [...(s.sessions[repoPath] ?? []), session] },
      active: { ...s.active, [repoPath]: session.id },
    }));
    return session;
  },

  restart: async (repoPath, id, shellId) => {
    const session = await terminalApi.create(repoPath, shellId, 80, 24);
    set(s => {
      const { [id]: _gone, ...exited } = s.exited;
      return {
        exited,
        sessions: {
          ...s.sessions,
          [repoPath]: (s.sessions[repoPath] ?? []).map(t => (t.id === id ? session : t)),
        },
        active: { ...s.active, [repoPath]: session.id },
      };
    });
  },

  close: (repoPath, id) => {
    if (!(id in get().exited)) void terminalApi.kill(id).catch(() => {});
    set(s => {
      const list = (s.sessions[repoPath] ?? []).filter(t => t.id !== id);
      const { [id]: _gone, ...exited } = s.exited;
      const wasActive = s.active[repoPath] === id;
      return {
        exited,
        sessions: { ...s.sessions, [repoPath]: list },
        active: {
          ...s.active,
          [repoPath]: wasActive ? (list[list.length - 1]?.id ?? null) : s.active[repoPath],
        },
      };
    });
  },

  setActive: (repoPath, id) => set(s => ({ active: { ...s.active, [repoPath]: id } })),

  markExited: (id, exitCode) => set(s => ({ exited: { ...s.exited, [id]: exitCode } })),
}));
