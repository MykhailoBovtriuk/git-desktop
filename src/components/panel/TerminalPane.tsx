import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { SearchAddon } from '@xterm/addon-search';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import { terminalApi } from '../../api/terminal-api';
import { useSettingsStore } from '../../stores/settings-store';
import { useUiStore } from '../../stores/ui-store';
import { TextInput } from '../../shared/ui';
import { isMac } from '../../lib/keyboard';
import { readTerminalTheme } from './terminal-theme';

interface TerminalPaneProps {
  id: string;
  visible: boolean;
  exitCode: number | undefined;
  onRestart: () => void;
}

const FONT = 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace';

export function TerminalPane({ id, visible, exitCode, onRestart }: TerminalPaneProps) {
  const { t } = useTranslation('terminal');
  const fontSize = useSettingsStore(s => s.terminalFontSize);
  const hostRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const searchRef = useRef<SearchAddon | null>(null);
  // Read inside xterm callbacks, which are bound once at mount.
  const exitRef = useRef(exitCode);
  const restartRef = useRef(onRestart);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    exitRef.current = exitCode;
    restartRef.current = onRestart;
  });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const term = new Terminal({
      fontFamily: FONT,
      fontSize: useSettingsStore.getState().terminalFontSize,
      theme: readTerminalTheme(),
      cursorBlink: true,
      scrollback: 5000,
      allowProposedApi: true,
      macOptionIsMeta: true,
    });
    const fit = new FitAddon();
    const search = new SearchAddon();
    term.loadAddon(fit);
    term.loadAddon(search);
    // A link in program output can point anywhere; ask before leaving the app.
    term.loadAddon(
      new WebLinksAddon((_event, uri) => {
        void useUiStore
          .getState()
          .requestConfirm({
            title: t('openLinkTitle'),
            message: t('openLinkMessage', { url: uri }),
            confirmLabel: t('openLinkConfirm'),
          })
          .then(ok => ok && terminalApi.openLink(uri))
          .catch(() => {});
      }),
    );
    term.open(host);
    termRef.current = term;
    fitRef.current = fit;
    searchRef.current = search;

    term.attachCustomKeyEventHandler(e => {
      if (e.type !== 'keydown') return true;
      const mod = isMac() ? e.metaKey : e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'f') {
        setSearching(true);
        return false;
      }
      // Ctrl+C stays an interrupt on Windows and Linux; copy and paste take
      // Shift, as in every terminal there. macOS's Cmd+C/V go through the menu.
      if (!isMac() && e.ctrlKey && e.shiftKey && e.code === 'KeyC') {
        const selection = term.getSelection();
        if (selection) void navigator.clipboard?.writeText(selection);
        return false;
      }
      if (!isMac() && e.ctrlKey && e.shiftKey && e.code === 'KeyV') {
        void navigator.clipboard?.readText().then(text => term.paste(text));
        return false;
      }
      return true;
    });

    term.onData(data => {
      if (exitRef.current !== undefined) {
        if (data === '\r') restartRef.current();
        return;
      }
      void terminalApi.write(id, data).catch(() => {});
    });

    // Output that lands while the scrollback is on its way is already part of
    // it (same IPC pipe, in order), so it is dropped, not written twice.
    let replayed = false;
    const offData = terminalApi.onSessionData(id, data => {
      if (replayed) term.write(data);
    });
    void terminalApi
      .buffer(id)
      .then(buffer => term.write(buffer))
      .catch(() => {})
      .finally(() => {
        replayed = true;
      });

    const resize = () => {
      if (!host.clientWidth || !host.clientHeight) return;
      const before = { cols: term.cols, rows: term.rows };
      try {
        fit.fit();
      } catch {
        return;
      }
      if (term.cols !== before.cols || term.rows !== before.rows) {
        void terminalApi.resize(id, term.cols, term.rows).catch(() => {});
      }
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();
    // Fresh sessions start at 80×24; tell the shell the real size at once.
    void terminalApi.resize(id, term.cols, term.rows).catch(() => {});

    const themeObserver = new MutationObserver(() => {
      term.options.theme = readTerminalTheme();
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    return () => {
      observer.disconnect();
      themeObserver.disconnect();
      offData();
      term.dispose();
      termRef.current = null;
    };
    // `t` changes with the language; the terminal is not rebuilt for that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    term.options.fontSize = fontSize;
    try {
      fitRef.current?.fit();
    } catch {}
  }, [fontSize]);

  useEffect(() => {
    if (exitCode === undefined) return;
    termRef.current?.write(`\r\n\x1b[2m${t('exited', { code: exitCode })}\x1b[0m\r\n`);
    // Only the transition matters; a language switch must not print it again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exitCode]);

  useEffect(() => {
    if (visible) termRef.current?.focus();
  }, [visible]);

  const find = (backwards = false) => {
    if (!query) return;
    if (backwards) searchRef.current?.findPrevious(query);
    else searchRef.current?.findNext(query);
  };

  return (
    <div className={visible ? 'flex flex-col flex-1 min-h-0' : 'hidden'}>
      {searching && (
        <div className="flex items-center gap-1 px-2 py-1 border-b border-surface0 shrink-0">
          <TextInput
            variant="filter"
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t('find')}
            aria-label={t('find')}
            className="flex-1 min-w-0"
            onKeyDown={e => {
              if (e.key === 'Enter') find(e.shiftKey);
              if (e.key === 'Escape') {
                e.stopPropagation();
                setSearching(false);
                searchRef.current?.clearDecorations();
                termRef.current?.focus();
              }
            }}
          />
        </div>
      )}
      <div
        ref={hostRef}
        className="flex-1 min-h-0 px-2 py-1"
        style={{ background: 'var(--gd-base)' }}
      />
    </div>
  );
}
