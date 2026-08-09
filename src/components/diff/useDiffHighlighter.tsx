import { useEffect, useState } from 'react';
import { langForPath, DIFF_THEME } from './highlight-lang';
import type { HighlighterCore } from './highlighter';
import type { DiffLine } from '../../types';

export function useDiffHighlighter(selectedFile: string | null) {
  const lang = selectedFile ? langForPath(selectedFile) : null;
  const [highlighter, setHighlighter] = useState<HighlighterCore | null>(null);

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
        const { tokens } = highlighter.codeToTokens(line.content, { lang, theme: DIFF_THEME });
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
