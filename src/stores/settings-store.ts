import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { getLocalStorage } from '../lib/storage';
import type { ThemePreference } from '../types';

/** 0 disables the fallback poll; the file watcher keeps working regardless. */
export const AUTO_REFRESH_OPTIONS = [0, 10_000, 30_000, 60_000] as const;
export type AutoRefreshMs = (typeof AUTO_REFRESH_OPTIONS)[number];

export const TERMINAL_FONT_SIZES = [12, 13, 14] as const;
export type TerminalFontSize = (typeof TERMINAL_FONT_SIZES)[number];

/** Order drives the Settings dropdown; 'en' is the default (see i18n/config.ts). */
export const LANGUAGES = ['uk', 'nl', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];

// Language lives in i18next, which already persists it; a copy here would
// drift.
interface SettingsState {
  theme: ThemePreference;
  autoRefreshMs: AutoRefreshMs;
  autoCheckUpdates: boolean;
  includePrereleases: boolean;
  /**
   * A version the user chose not to hear about again. Cleared by asking for a
   * check explicitly, which is what that button means.
   */
  skippedVersion: string | null;
  /** A shell id from the main process's list; null picks the system default. */
  terminalShell: string | null;
  terminalFontSize: TerminalFontSize;
  setTheme: (theme: ThemePreference) => void;
  setAutoRefreshMs: (ms: AutoRefreshMs) => void;
  setAutoCheckUpdates: (enabled: boolean) => void;
  setIncludePrereleases: (enabled: boolean) => void;
  setSkippedVersion: (version: string | null) => void;
  setTerminalShell: (id: string | null) => void;
  setTerminalFontSize: (size: TerminalFontSize) => void;
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

      setTheme: theme => set({ theme }),
      setAutoRefreshMs: autoRefreshMs => set({ autoRefreshMs }),
      setAutoCheckUpdates: autoCheckUpdates => set({ autoCheckUpdates }),
      setIncludePrereleases: includePrereleases => set({ includePrereleases }),
      setSkippedVersion: skippedVersion => set({ skippedVersion }),
      setTerminalShell: terminalShell => set({ terminalShell }),
      setTerminalFontSize: terminalFontSize => set({ terminalFontSize }),
    }),
    {
      name: 'git-desktop-settings',
      storage: createJSONStorage(() => getLocalStorage()),
    },
  ),
);
