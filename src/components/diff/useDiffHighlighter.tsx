import { useEffect, useState } from 'react';
import { langForPath, DIFF_THEME } from './highlight-lang';
import type { HighlighterCore } from './highlighter';
import type { DiffLine } from '../../types';

// Syntax highlighting for diff lines. Resolves the language from the file
// extension, lazy-loads shiki only for files we have a grammar for, and returns
// a renderer that falls back to plain +/- coloured text until (or unless) the
// highlighter is ready.
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
      .catch(() => {
        // Highlighting is cosmetic — on any load failure the diff still renders
        // as plain text.
      });
    return () => {
      active = false;
    };
  }, [lang, highlighter]);

  // Per-line tokenization loses cross-line context (block comments, multi-line
  // strings) but keeps each line aligned with its +/- background.
  return function renderContent(line: DiffLine) {
    if (highlighter && lang) {
      try {
        const { tokens } = highlighter.codeToTokens(line.content, { lang, theme: DIFF_THEME });
        return (tokens[0] ?? []).map((tk, i) => (
          <span key={i} style={{ color: tk.color }}>
            {tk.content}
          </span>
        ));
      } catch {
        // Fall through to plain text.
      }
    }
    const cls =
      line.type === 'add' ? 'text-green' : line.type === 'remove' ? 'text-red' : 'text-text';
    return <span className={cls}>{line.content}</span>;
  };
}
