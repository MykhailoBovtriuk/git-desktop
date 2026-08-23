import { useEffect, useSyncExternalStore } from 'react';
import { useSettingsStore } from '../stores/settings-store';
import { appApi } from '../api/app-api';
import type { ResolvedTheme, ThemePreference } from '../types';

// Kept in sync with :root / :root[data-theme='light'] in styles/globals.css.
// The native titlebar strip on Windows/Linux is painted by the OS, so it needs
// the literal colours rather than a CSS variable.
const TITLEBAR: Record<ResolvedTheme, { color: string; symbolColor: string }> = {
  dark: { color: '#181825', symbolColor: '#cdd6f4' },
  light: { color: '#e6e9ef', symbolColor: '#4c4f69' },
};

const DARK_QUERY = '(prefers-color-scheme: dark)';

export function resolveTheme(preference: ThemePreference, prefersDark: boolean): ResolvedTheme {
  if (preference === 'system') return prefersDark ? 'dark' : 'light';
  return preference;
}

export function useTheme() {
  const theme = useSettingsStore(s => s.theme);

  useEffect(() => {
    const media = window.matchMedia?.(DARK_QUERY);

    const apply = () => {
      const resolved = resolveTheme(theme, media?.matches ?? true);
      document.documentElement.dataset.theme = resolved;
      const { color, symbolColor } = TITLEBAR[resolved];
      // Rejected on macOS by design (no overlay there) — nothing to report.
      appApi.setTitlebarOverlay(color, symbolColor).catch(() => {});
    };

    apply();
    if (theme !== 'system' || !media) return;
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);
}

function subscribeToSystemTheme(onChange: () => void): () => void {
  const media = window.matchMedia?.(DARK_QUERY);
  if (!media) return () => {};
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

/**
 * Reactive counterpart of the media query, for components that need the
 * resolved theme (not just the preference) to re-render — the diff highlighter
 * has to re-tokenize when 'system' flips.
 */
export function useSystemPrefersDark(): boolean {
  return useSyncExternalStore(
    subscribeToSystemTheme,
    () => window.matchMedia?.(DARK_QUERY).matches ?? true,
    () => true,
  );
}
