import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { getLocalStorage } from '../lib/storage';
import type { ThemePreference } from '../types';

export const AUTO_REFRESH_OPTIONS = [0, 10_000, 30_000, 60_000] as const;
export type AutoRefreshMs = (typeof AUTO_REFRESH_OPTIONS)[number];

export const DIFF_FONT_SIZES = [11, 12, 13, 14] as const;
export type DiffFontSize = (typeof DIFF_FONT_SIZES)[number];

export const TERMINAL_FONT_SIZES = [12, 13, 14] as const;
export type TerminalFontSize = (typeof TERMINAL_FONT_SIZES)[number];

export const LANGUAGES = ['uk', 'nl', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];

// Language lives in i18next, which already persists it; a copy here would
// drift.
interface SettingsState {
  theme: ThemePreference;
  autoRefreshMs: AutoRefreshMs;
  autoCheckUpdates: boolean;
  includePrereleases: boolean;
  skippedVersion: string | null;
  terminalShell: string | null;
  terminalFontSize: TerminalFontSize;
  diffFontSize: DiffFontSize;
  diffWrapLines: boolean;
  diffIgnoreWhitespace: boolean;
  setTheme: (theme: ThemePreference) => void;
  setAutoRefreshMs: (ms: AutoRefreshMs) => void;
  setAutoCheckUpdates: (enabled: boolean) => void;
  setIncludePrereleases: (enabled: boolean) => void;
  setSkippedVersion: (version: string | null) => void;
  setTerminalShell: (id: string | null) => void;
  setTerminalFontSize: (size: TerminalFontSize) => void;
  setDiffFontSize: (size: DiffFontSize) => void;
  setDiffWrapLines: (wrap: boolean) => void;
  setDiffIgnoreWhitespace: (ignore: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    set => ({
      theme: 'system',
      autoRefreshMs: 60_000,
      autoCheckUpdates: true,
      includePrereleases: false,
      skippedVersion: null,
      terminalShell: null,
      terminalFontSize: 13,
      diffFontSize: 12,
      diffWrapLines: false,
      diffIgnoreWhitespace: false,

      setTheme: theme => set({ theme }),
      setAutoRefreshMs: autoRefreshMs => set({ autoRefreshMs }),
      setAutoCheckUpdates: autoCheckUpdates => set({ autoCheckUpdates }),
      setIncludePrereleases: includePrereleases => set({ includePrereleases }),
      setSkippedVersion: skippedVersion => set({ skippedVersion }),
      setTerminalShell: terminalShell => set({ terminalShell }),
      setTerminalFontSize: terminalFontSize => set({ terminalFontSize }),
      setDiffFontSize: diffFontSize => set({ diffFontSize }),
      setDiffWrapLines: diffWrapLines => set({ diffWrapLines }),
      setDiffIgnoreWhitespace: diffIgnoreWhitespace => set({ diffIgnoreWhitespace }),
    }),
    {
      name: 'git-desktop-settings',
      storage: createJSONStorage(() => getLocalStorage()),
    },
  ),
);
