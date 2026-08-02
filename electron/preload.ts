import { contextBridge, ipcRenderer } from 'electron';

// Allowlist of IPC channels the renderer may invoke. This reduces the attack
// surface of the generic `invoke` bridge — it does NOT replace argument
// validation in the main process, which remains the source of truth.
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
  'git:read-file',
  'git:write-file',
  'git:get-conflict-sides',
]);

contextBridge.exposeInMainWorld('electronAPI', {
  invoke: (channel: string, ...args: unknown[]) => {
    if (!ALLOWED_CHANNELS.has(channel)) {
      throw new Error(`Blocked IPC channel: ${channel}`);
    }
    return ipcRenderer.invoke(channel, ...args);
  },
  // One-way main→renderer event: the main process pushes on any .git change of
  // the open repo. Kept separate from the invoke allowlist since it's an event
  // subscription, not a request. Returns an unsubscribe function. The wrapper
  // listener drops the IpcRendererEvent so the renderer callback stays argless.
  onGitChanged: (cb: () => void) => {
    const listener = () => cb();
    ipcRenderer.on('repo:changed', listener);
    return () => ipcRenderer.removeListener('repo:changed', listener);
  },
  platform: process.platform,
});
