import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useLogStore } from '../../stores/log-store';
import { useUiStore } from '../../stores/ui-store';
import { formatEntry } from '../../lib/format-log';
import { useCopy } from '../../hooks/use-copy';
import { Button, CheckIcon, CopyIcon, IconButton, TextInput, TrashIcon, cn } from '../../shared/ui';
import { LogEntryRow } from './LogEntryRow';

/** Within this many pixels of the bottom counts as following the tail. */
const STICK_PX = 24;

function Chip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        'px-2 py-0.5 rounded text-xs transition-colors shrink-0',
        pressed ? 'bg-surface1 text-text' : 'text-subtext hover:bg-surface0 hover:text-text',
      )}
    >
      {children}
    </button>
  );
}

export function LogsView() {
  const { t } = useTranslation('logs');
  const { entries, hasMore, loadingMore, loadOlder, clear, focusId, setFocus } = useLogStore(
    useShallow(s => ({
      entries: s.entries,
      hasMore: s.hasMore,
      loadingMore: s.loadingMore,
      loadOlder: s.loadOlder,
      clear: s.clear,
      focusId: s.focusId,
      setFocus: s.setFocus,
    })),
  );
  const requestConfirm = useUiStore(s => s.requestConfirm);
  const [query, setQuery] = useState('');
  const [errorsOnly, setErrorsOnly] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const { copied: copiedAll, copy } = useCopy();
  const listRef = useRef<HTMLDivElement>(null);
  const following = useRef(true);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return entries.filter(e => {
      if (errorsOnly && e.status !== 'error') return false;
      if (!needle) return true;
      const haystack = [
        t(`op.${e.op}`),
        e.detail ?? '',
        e.error ?? '',
        ...e.commands.flatMap(c => [c.argv.join(' '), c.stdout, c.stderr]),
      ]
        .join('\n')
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [entries, query, errorsOnly, t]);

  // New output keeps the view pinned to the bottom, unless the user scrolled up
  // to read something.
  useLayoutEffect(() => {
    const el = listRef.current;
    if (el && following.current && !focusId) el.scrollTop = el.scrollHeight;
  }, [visible, focusId]);

  // "Show in logs" from a toast: open that entry and bring it into view.
  useEffect(() => {
    if (!focusId) return;
    setErrorsOnly(false);
    setQuery('');
    setExpanded(prev => new Set(prev).add(focusId));
    const id = requestAnimationFrame(() => {
      listRef.current
        ?.querySelector(`[data-entry-id="${CSS.escape(focusId)}"]`)
        ?.scrollIntoView({ block: 'nearest' });
      following.current = false;
    });
    return () => cancelAnimationFrame(id);
  }, [focusId]);

  const onScroll = () => {
    const el = listRef.current;
    if (!el) return;
    following.current = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_PX;
    if (following.current && focusId) setFocus(null);
  };

  const toggle = (id: string) =>
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const copyAll = () => copy(visible.map(e => formatEntry(e, t(`op.${e.op}`))).join('\n\n'));

  const confirmClear = async () => {
    const ok = await requestConfirm({
      title: t('settings.clearTitle'),
      message: t('settings.clearMessage'),
      confirmLabel: t('settings.clearConfirm'),
      danger: true,
    });
    if (ok) await clear().catch(() => {});
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-surface0 shrink-0">
        <TextInput
          variant="filter"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={t('filter')}
          aria-label={t('filter')}
          className="flex-1 min-w-0"
        />
        <Chip pressed={errorsOnly} onClick={() => setErrorsOnly(v => !v)}>
          {t('errorsOnly')}
        </Chip>
        <IconButton
          icon={copiedAll ? CheckIcon : CopyIcon}
          onClick={copyAll}
          disabled={visible.length === 0}
          aria-label={copiedAll ? t('copied') : t('copyAll')}
          title={copiedAll ? t('copied') : t('copyAll')}
        />
        <IconButton
          icon={TrashIcon}
          onClick={() => void confirmClear()}
          disabled={entries.length === 0}
          aria-label={t('clear')}
          title={t('clear')}
        />
      </div>

      <div ref={listRef} onScroll={onScroll} className="flex-1 overflow-y-auto min-h-0">
        {hasMore && (
          <div className="flex justify-center py-1.5">
            <Button
              variant="secondary"
              size="sm"
              disabled={loadingMore}
              onClick={() => void loadOlder().catch(() => {})}
            >
              {t('loadOlder')}
            </Button>
          </div>
        )}
        {visible.length === 0 ? (
          <p className="text-subtext text-xs px-3 py-4">
            {entries.length === 0 ? t('empty') : t('noMatches')}
          </p>
        ) : (
          <ul>
            {visible.map(entry => (
              <LogEntryRow
                key={entry.id}
                entry={entry}
                expanded={expanded.has(entry.id)}
                onToggle={() => toggle(entry.id)}
                highlighted={entry.id === focusId}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
