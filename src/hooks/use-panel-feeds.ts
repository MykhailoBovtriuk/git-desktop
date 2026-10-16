import { useEffect } from 'react';
import { logApi } from '../api/log-api';
import { terminalApi } from '../api/terminal-api';
import { useLogStore } from '../stores/log-store';
import { useRepoStore } from '../stores/repo-store';
import { useTerminalStore } from '../stores/terminal-store';
import { useUiStore } from '../stores/ui-store';

/**
 * Keeps the right panel's stores in step with the main process and the open
 * repository, whether or not the panel is on screen:
 * - the log follows the repository and every pushed entry;
 * - the terminal wakes the first time its tab opens (node-pty loads then, not
 *   at startup), then picks up the repository's live sessions and their exits.
 */
export function usePanelFeeds() {
  const repoPath = useRepoStore(s => s.repoPath);
  const terminalWanted = useUiStore(s => s.rightPanel === 'terminal');
  const terminalAvailable = useTerminalStore(s => s.available);

  useEffect(() => {
    if (!window.electronAPI?.onLogEntry) return;
    void useLogStore
      .getState()
      .load(repoPath)
      .catch(() => {});
  }, [repoPath]);

  useEffect(() => {
    if (!window.electronAPI?.onLogEntry) return;
    const offLog = logApi.onEntry(entry =>
      useLogStore.getState().upsert(entry, useUiStore.getState().rightPanel === 'logs'),
    );
    const offExit = terminalApi.onExit((id, exitCode) =>
      useTerminalStore.getState().markExited(id, exitCode),
    );
    return () => {
      offLog();
      offExit();
    };
  }, []);

  useEffect(() => {
    if (terminalWanted)
      void useTerminalStore
        .getState()
        .init()
        .catch(() => {});
  }, [terminalWanted]);

  useEffect(() => {
    if (!terminalAvailable || !repoPath) return;
    void useTerminalStore
      .getState()
      .restore(repoPath)
      .catch(() => {});
  }, [terminalAvailable, repoPath]);
}
