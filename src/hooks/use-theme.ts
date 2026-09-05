import { useEffect, useSyncExternalStore } from 'react';
import { useSettingsStore } from '../stores/settings-store';
import { appApi } from '../api/app-api';
import type { ResolvedTheme, ThemePreference } from '../types';

// The OS paints the native titlebar strip, so it needs literal colours; they
// come from the CSS variables at apply time and this is only the fallback.
const TITLEBAR_FALLBACK: Record<ResolvedTheme, { color: string; symbolColor: string }> = {
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
      // Order matters: the dataset switch is what changes the CSS variables
      // read next.
      document.documentElement.dataset.theme = resolved;
      const styles = getComputedStyle(document.documentElement);
      const color =
        styles.getPropertyValue('--gd-mantle').trim() || TITLEBAR_FALLBACK[resolved].color;
      const symbolColor =
        styles.getPropertyValue('--gd-text').trim() || TITLEBAR_FALLBACK[resolved].symbolColor;
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
