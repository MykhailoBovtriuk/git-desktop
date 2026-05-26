import type { Commit, Branch, GitStatus, AheadBehind } from '../types';

type StatusResult = GitStatus & { ahead: number; behind: number };

async function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  const result = await window.electronAPI.invoke(channel, ...args);
  if (result && typeof result === 'object' && 'error' in result) {
    throw new Error((result as { error: string }).error);
  }
  return (result as { data: T }).data;
}

export const gitApi = {
  openRepo: (path: string) => invoke<null>('git:open-repo', path),
  openDialog: () => invoke<string | null>('git:open-dialog'),
  getLog: (limit: number, offset: number) => invoke<Commit[]>('git:get-log', limit, offset),
  getBranches: () => invoke<Branch[]>('git:get-branches'),
  getStatus: () => invoke<StatusResult>('git:get-status'),
  stageFiles: (paths: string[]) => invoke<null>('git:stage-files', paths),
  unstageFiles: (paths: string[]) => invoke<null>('git:unstage-files', paths),
  discardChanges: (paths: string[]) => invoke<null>('git:discard-changes', paths),
  commit: (message: string) => invoke<string>('git:commit', message),
  fetch: () => invoke<null>('git:fetch'),
  pull: () => invoke<string>('git:pull'),
  push: () => invoke<null>('git:push'),
  checkout: (branch: string) => invoke<null>('git:checkout', branch),
  merge: (branch: string) => invoke<{ success: boolean; conflicts: string[] }>('git:merge', branch),
  rebase: (branch: string) => invoke<null>('git:rebase', branch),
  deleteBranch: (branch: string) => invoke<null>('git:delete-branch', branch),
  getCommitDiff: (hash: string) => invoke<{ path: string; status: string }[]>('git:get-commit-diff', hash),
  getFileDiff: (hash: string, filePath: string) => invoke<string>('git:get-file-diff', hash, filePath),
  getWorkingDiff: (filePath: string) => invoke<string>('git:get-working-diff', filePath),
  getStagedDiff: (filePath: string) => invoke<string>('git:get-staged-diff', filePath),
  getAheadBehind: () => invoke<AheadBehind>('git:get-ahead-behind'),
  getMergeConflicts: () => invoke<string[]>('git:get-merge-conflicts'),
  abortMerge: () => invoke<null>('git:abort-merge'),
  markResolved: (filePath: string) => invoke<null>('git:mark-resolved', filePath),
  getRepoPath: () => invoke<string | null>('git:get-repo-path'),
  readFile: (p: string) => invoke<string>('git:read-file', p),
  writeFile: (p: string, c: string) => invoke<null>('git:write-file', p, c),
  getConflictSides: (p: string) =>
    invoke<{ ours: string; theirs: string; base: string }>('git:get-conflict-sides', p),
};
