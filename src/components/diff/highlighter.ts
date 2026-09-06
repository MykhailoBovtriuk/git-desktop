import { createHighlighterCore, type HighlighterCore } from 'shiki/core';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';

let instance: Promise<HighlighterCore> | null = null;

/**
 * Themes ship up front (a few KB) so the theme toggle never waits on imports;
 * the 13 grammars are ~80-180 KB each and load on demand — all of them up
 * front cost ~1 MB to open a .txt diff.
 */
function getCore(): Promise<HighlighterCore> {
  if (!instance) {
    instance = createHighlighterCore({
      themes: [
        import('@shikijs/themes/catppuccin-mocha'),
        import('@shikijs/themes/catppuccin-latte'),
      ],
      langs: [],
      engine: createJavaScriptRegexEngine(),
    });
  }
  return instance;
}

/** Literal import per grammar: Vite can only split what it can see. */
const LANG_LOADERS: Record<string, () => Promise<unknown>> = {
  typescript: () => import('@shikijs/langs/typescript'),
  tsx: () => import('@shikijs/langs/tsx'),
  javascript: () => import('@shikijs/langs/javascript'),
  jsx: () => import('@shikijs/langs/jsx'),
  json: () => import('@shikijs/langs/json'),
  css: () => import('@shikijs/langs/css'),
  html: () => import('@shikijs/langs/html'),
  python: () => import('@shikijs/langs/python'),
  go: () => import('@shikijs/langs/go'),
  rust: () => import('@shikijs/langs/rust'),
  markdown: () => import('@shikijs/langs/markdown'),
  yaml: () => import('@shikijs/langs/yaml'),
  shellscript: () => import('@shikijs/langs/shellscript'),
};

export async function getHighlighterFor(lang: string): Promise<HighlighterCore> {
  const highlighter = await getCore();
  if (!highlighter.getLoadedLanguages().includes(lang)) {
    const load = LANG_LOADERS[lang];
    if (load) {
      const mod = (await load()) as { default?: unknown };
      await highlighter.loadLanguage((mod.default ?? mod) as Parameters<
        HighlighterCore['loadLanguage']
      >[0]);
    }
  }
  return highlighter;
}

export type { HighlighterCore };
