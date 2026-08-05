import { createHighlighterCore, type HighlighterCore } from 'shiki/core';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';

// This module is imported dynamically (see DiffViewer) so shiki and all bundled
// grammars land in a lazy chunk that only loads when a highlightable diff is
// shown.
//
// The JS RegExp engine is deliberate: the app's production CSP is
// `script-src 'self'` without `wasm-unsafe-eval`, which would block shiki's
// default oniguruma-WASM engine. The JS engine is pure JS. Grammars and the
// theme are bundled (dynamic imports → chunks served over app://), never
// fetched from a CDN, satisfying `default-src 'self'`.

let instance: Promise<HighlighterCore> | null = null;

export function getHighlighter(): Promise<HighlighterCore> {
  if (!instance) {
    instance = createHighlighterCore({
      themes: [import('@shikijs/themes/catppuccin-mocha')],
      langs: [
        import('@shikijs/langs/typescript'),
        import('@shikijs/langs/tsx'),
        import('@shikijs/langs/javascript'),
        import('@shikijs/langs/jsx'),
        import('@shikijs/langs/json'),
        import('@shikijs/langs/css'),
        import('@shikijs/langs/html'),
        import('@shikijs/langs/python'),
        import('@shikijs/langs/go'),
        import('@shikijs/langs/rust'),
        import('@shikijs/langs/markdown'),
        import('@shikijs/langs/yaml'),
        import('@shikijs/langs/shellscript'),
      ],
      engine: createJavaScriptRegexEngine(),
    });
  }
  return instance;
}

export type { HighlighterCore };
