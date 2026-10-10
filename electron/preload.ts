import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type { LogEntry, UpdateProgress } from '../src/types';

const ALLOWED_CHANNELS = new Set<string>([
  'git:open-repo',
  'git:open-dialog',
  'git:get-log',
  'git:get-head-commit',
  'git:get-branches',
  'git:get-status',
  'git:stage-files',
  'git:unstage-files',
  'git:discard-changes',
  'git:commit',
  'git:fetch',
  'git:pull',
  'git:push',
  'git:push-set-upstream',
  'git:switch-remote-protocol',
  'git:create-branch',
  'git:checkout',
  'git:checkout-force',
  'git:merge',
  'git:rebase',
  'git:is-rebasing',
  'git:abort-rebase',
  'git:continue-rebase',
  'git:apply-patch',
  'git:delete-branch',
  'git:delete-remote-branch',
  'git:get-commit-diff',
  'git:get-file-diff',
  'git:get-working-diff',
  'git:get-staged-diff',
  'git:get-merge-conflicts',
  'git:abort-merge',
  'git:is-merging',
  'git:conclude-merge',
  'git:get-merge-message',
  'git:mark-resolved',
  'git:get-stash-list',
  'git:stash-save',
  'git:stash-apply',
  'git:stash-pop',
  'git:stash-drop',
  'git:get-stash-diff',
  'git:get-stash-top',
  'git:get-repo-path',
  'git:has-identity',
  'git:read-file',
  'git:write-file',
  'git:get-conflict-sides',
  'account:list',
  'account:providers',
  'account:auth-source',
  'account:sign-in',
  'account:sign-in-token',
  'account:open-token-help',
  'account:cancel-sign-in',
  'account:sign-out',
  'account:forget-system-credential',
  'app:get-version',
  'app:check-for-update',
  'app:download-update',
  'app:cancel-update-download',
  'app:install-update',
  'log:list',
  'log:stats',
  'log:clear',
  'log:get-retention',
  'log:set-retention',
  'log:open-folder',
  'repo:forget',
  'term:available',
  'term:shells',
  'term:create',
  'term:write',
  'term:resize',
  'term:kill',
  'term:list',
  'term:buffer',
  'term:open-link',
  'shell:open-external',
  'window:set-titlebar-overlay',
]);

/** A push from main as a renderer subscription; the returned function unsubscribes. */
function subscribe<Args extends unknown[]>(channel: string) {
  return (cb: (...args: Args) => void) => {
    const listener = (_e: IpcRendererEvent, ...args: unknown[]) => cb(...(args as Args));
    ipcRenderer.on(channel, listener);
    return () => {
      ipcRenderer.removeListener(channel, listener);
    };
  };
}

contextBridge.exposeInMainWorld('electronAPI', {
  invoke: (channel: string, ...args: unknown[]) => {
    if (!ALLOWED_CHANNELS.has(channel)) {
      throw new Error(`Blocked IPC channel: ${channel}`);
    }
    return ipcRenderer.invoke(channel, ...args);
  },
  onGitChanged: subscribe<[]>('repo:changed'),
  // Sign-in finishes in the main process, minutes after the renderer asked for
  // it and via a browser round trip — so the answer has to be pushed, not polled.
  onAccountChanged: subscribe<[]>('account:changed'),
  // Payload pushes: asking back for the byte count on every frame of a 140 MB
  // download, or for each log line, would be a round trip per repaint.
  onUpdateProgress: subscribe<[UpdateProgress]>('app:update-progress'),
  onLogEntry: subscribe<[LogEntry]>('log:entry'),
  // Terminal output is the hottest push there is; it arrives batched per frame.
  onTerminalData: subscribe<[id: string, data: string]>('term:data'),
  onTerminalExit: subscribe<[id: string, exitCode: number]>('term:exit'),
  platform: process.platform,
});
