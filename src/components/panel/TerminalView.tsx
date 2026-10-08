import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useTerminalStore } from '../../stores/terminal-store';
import { useRepoStore } from '../../stores/repo-store';
import { useSettingsStore } from '../../stores/settings-store';
import { useUiStore } from '../../stores/ui-store';
import { errorMessage } from '../../lib/error-message';
import { useDismiss } from '../../hooks/use-dismiss';
import {
  AddIcon,
  Button,
  ChevronDownIcon,
  ContextMenu,
  DiscardIcon,
  IconButton,
  MenuItem,
  cn,
} from '../../shared/ui';
import { TerminalPane } from './TerminalPane';

const EMPTY: never[] = [];

export function TerminalView({ visible }: { visible: boolean }) {
  const { t } = useTranslation('terminal');
  const repoPath = useRepoStore(s => s.repoPath);
  const defaultShell = useSettingsStore(s => s.terminalShell);
  const addToast = useUiStore(s => s.addToast);
  const {
    available,
    unavailableReason,
    shells,
    sessions,
    activeId,
    exited,
    restored,
    create,
    restart,
    close,
    setActive,
  } = useTerminalStore(
    useShallow(s => ({
      available: s.available,
      unavailableReason: s.unavailableReason,
      shells: s.shells,
      sessions: repoPath ? (s.sessions[repoPath] ?? EMPTY) : EMPTY,
      activeId: repoPath ? (s.active[repoPath] ?? null) : null,
      exited: s.exited,
      restored: repoPath ? !!s.restored[repoPath] : false,
      create: s.create,
      restart: s.restart,
      close: s.close,
      setActive: s.setActive,
    })),
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLDivElement>(null);
  // The first visit to a repository's terminal opens a shell; closing the last
  // tab afterwards leaves it closed.
  const autoOpened = useRef(new Set<string>());

  const open = async (shellId: string | null) => {
    if (!repoPath) return;
    setMenuOpen(false);
    try {
      await create(repoPath, shellId);
    } catch (err) {
      addToast({ variant: 'error', title: t('createFailed'), message: errorMessage(err) });
    }
  };

  // The menu is portalled; ContextMenu stops its own mousedowns, so a click on
  // an item is not an outside click.
  useDismiss(menuButtonRef, menuOpen, () => setMenuOpen(false));

  useEffect(() => {
    if (!visible || !available || !repoPath || !restored) return;
    if (autoOpened.current.has(repoPath)) return;
    autoOpened.current.add(repoPath);
    if (sessions.length === 0) void open(defaultShell);
    // Runs once per repository; `open` and `sessions` are read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, available, repoPath, restored]);

  if (available === false) {
    return (
      <div className="p-4 text-xs text-subtext space-y-2">
        <p className="text-text">{t('unavailable')}</p>
        {unavailableReason && <p className="font-mono break-words">{unavailableReason}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-0.5 px-1 h-8 border-b border-surface0 shrink-0 overflow-x-auto">
        {sessions.map(session => {
          const active = session.id === activeId;
          return (
            <div
              key={session.id}
              className={cn(
                'group flex items-center gap-1 pl-2 pr-0.5 h-6 rounded text-xs shrink-0',
                active ? 'bg-surface1 text-text' : 'text-subtext hover:bg-surface0',
              )}
            >
              <button
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => repoPath && setActive(repoPath, session.id)}
                className={cn(session.id in exited && 'line-through opacity-70')}
              >
                {session.title}
              </button>
              <IconButton
                icon={DiscardIcon}
                size="sm"
                onClick={() => repoPath && close(repoPath, session.id)}
                aria-label={t('close')}
                title={t('close')}
                className="opacity-60 group-hover:opacity-100"
              />
            </div>
          );
        })}
        <div className="relative flex items-center shrink-0">
          <IconButton
            icon={AddIcon}
            size="sm"
            onClick={() => void open(defaultShell)}
            aria-label={t('newTerminal')}
            title={t('newTerminal')}
          />
          {shells.length > 1 && (
            <div ref={menuButtonRef} className="inline-flex">
              <IconButton
                icon={ChevronDownIcon}
                size="sm"
                onClick={() => setMenuOpen(v => !v)}
                aria-label={t('newWithShell')}
                title={t('newWithShell')}
                aria-expanded={menuOpen}
              />
            </div>
          )}
          <ContextMenu
            open={menuOpen}
            anchorRef={menuButtonRef}
            anchor="below"
            height={shells.length * 28 + 8}
          >
            {shells.map(shell => (
              <MenuItem key={shell.id} onClick={() => void open(shell.id)}>
                {shell.label}
              </MenuItem>
            ))}
          </ContextMenu>
        </div>
      </div>

      {sessions.length === 0 ? (
        <div className="p-4 text-xs text-subtext flex flex-col items-start gap-2">
          <p>{t('empty')}</p>
          {available && (
            <Button size="sm" variant="surface" onClick={() => void open(defaultShell)}>
              {t('newTerminal')}
            </Button>
          )}
        </div>
      ) : (
        sessions.map(session => (
          <TerminalPane
            key={session.id}
            id={session.id}
            visible={visible && session.id === activeId}
            exitCode={exited[session.id]}
            onRestart={() =>
              repoPath &&
              void restart(repoPath, session.id, session.shellId).catch(err =>
                addToast({
                  variant: 'error',
                  title: t('createFailed'),
                  message: errorMessage(err),
                }),
              )
            }
          />
        ))
      )}
    </div>
  );
}
