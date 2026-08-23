import { useEffect, useState } from 'react';
import { langForPath, diffTheme } from './highlight-lang';
import { useSettingsStore } from '../../stores/settings-store';
import { resolveTheme, useSystemPrefersDark } from '../../hooks/use-theme';
import type { HighlighterCore } from './highlighter';
import type { DiffLine } from '../../types';

export function useDiffHighlighter(selectedFile: string | null) {
  const lang = selectedFile ? langForPath(selectedFile) : null;
  const [highlighter, setHighlighter] = useState<HighlighterCore | null>(null);
  const preference = useSettingsStore(s => s.theme);
  const prefersDark = useSystemPrefersDark();
  const theme = diffTheme(resolveTheme(preference, prefersDark));

  useEffect(() => {
    if (!lang || highlighter) return;
    let active = true;
    import('./highlighter')
      .then(m => m.getHighlighter())
      .then(h => {
        if (active) setHighlighter(h);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [lang, highlighter]);

  return function renderContent(line: DiffLine) {
    if (highlighter && lang) {
      try {
        const { tokens } = highlighter.codeToTokens(line.content, { lang, theme });
        return (tokens[0] ?? []).map((tk, i) => (
          <span key={i} style={{ color: tk.color }}>
            {tk.content}
          </span>
        ));
      } catch {}
    }
    const cls =
      line.type === 'add' ? 'text-green' : line.type === 'remove' ? 'text-red' : 'text-text';
    return <span className={cls}>{line.content}</span>;
  };
}
