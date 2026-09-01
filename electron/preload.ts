import { contextBridge, ipcRenderer } from 'electron';

const ALLOWED_CHANNELS = new Set<string>([
  'git:open-repo',
  'git:open-dialog',
  'git:get-log',
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
  'account:for-repo',
  'account:bind',
  'account:unbind',
  'account:sign-in',
  'account:sign-in-token',
  'account:open-token-help',
  'account:cancel-sign-in',
  'account:sign-out',
  'app:get-version',
  'shell:open-external',
  'window:set-titlebar-overlay',
]);

contextBridge.exposeInMainWorld('electronAPI', {
  invoke: (channel: string, ...args: unknown[]) => {
    if (!ALLOWED_CHANNELS.has(channel)) {
      throw new Error(`Blocked IPC channel: ${channel}`);
    }
    return ipcRenderer.invoke(channel, ...args);
  },
  onGitChanged: (cb: () => void) => {
    const listener = () => cb();
    ipcRenderer.on('repo:changed', listener);
    return () => ipcRenderer.removeListener('repo:changed', listener);
  },
  // Sign-in finishes in the main process, minutes after the renderer asked for
  // it and via a browser round trip — so the answer has to be pushed, not polled.
  onAccountChanged: (cb: () => void) => {
    const listener = () => cb();
    ipcRenderer.on('account:changed', listener);
    return () => ipcRenderer.removeListener('account:changed', listener);
  },
  platform: process.platform,
});
