import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { getLocalStorage } from '../lib/storage';
import type { GitProfile, ThemePreference } from '../types';

/** 0 disables the fallback poll; the file watcher keeps working regardless. */
export const AUTO_REFRESH_OPTIONS = [0, 10_000, 30_000, 60_000] as const;
export type AutoRefreshMs = (typeof AUTO_REFRESH_OPTIONS)[number];

export const LANGUAGES = ['en', 'uk'] as const;
export type Language = (typeof LANGUAGES)[number];

// Language deliberately lives in i18next, not here: its LanguageDetector
// already persists the choice and owns the browser-locale fallback, so a copy
// in this store would be a second source of truth that can drift.
interface SettingsState {
  theme: ThemePreference;
  autoRefreshMs: AutoRefreshMs;
  profiles: GitProfile[];
  setTheme: (theme: ThemePreference) => void;
  setAutoRefreshMs: (ms: AutoRefreshMs) => void;
  saveProfile: (profile: GitProfile) => void;
  deleteProfile: (id: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    set => ({
      theme: 'system',
      autoRefreshMs: 60_000,
      profiles: [],

      setTheme: theme => set({ theme }),
      setAutoRefreshMs: autoRefreshMs => set({ autoRefreshMs }),

      saveProfile: profile =>
        set(s => {
          const index = s.profiles.findIndex(p => p.id === profile.id);
          if (index < 0) return { profiles: [...s.profiles, profile] };
          const profiles = [...s.profiles];
          profiles[index] = profile;
          return { profiles };
        }),

      deleteProfile: id => set(s => ({ profiles: s.profiles.filter(p => p.id !== id) })),
    }),
    {
      name: 'git-desktop-settings',
      storage: createJSONStorage(() => getLocalStorage()),
    },
  ),
);
