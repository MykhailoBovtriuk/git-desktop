export interface Commit {
  hash: string;
  abbreviatedHash: string;
  message: string;
  author: string;
  date: string;
  parents: string[];
  refs: string[];
}

export interface Branch {
  name: string;
  current: boolean;
  remote: boolean;
  tracking?: string;
}

export interface FileStatus {
  path: string;
  status: 'A' | 'M' | 'D' | 'R' | 'C' | 'U' | 'N';
  staged: boolean;
}

export interface GitStatus {
  staged: FileStatus[];
  unstaged: FileStatus[];
}

export interface AheadBehind {
  ahead: number;
  behind: number;
}

export interface MergeState {
  sourceBranch: string;
  targetBranch: string;
  conflictingFiles: string[];
}

export interface StashEntry {
  index: number;
  message: string;
  branch: string | null;
  date: string;
}

export interface DiffHunk {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: DiffLine[];
}

export interface DiffLine {
  type: 'add' | 'remove' | 'context';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export interface FileDiff {
  path: string;
  status: FileStatus['status'];
  hunks: DiffHunk[];
  additions: number;
  deletions: number;
}

export interface IpcError {
  error: string;
  code: string;
}

export type IpcResult<T> = { data: T } | IpcError;

export type ActiveView =
  | 'changes'
  | 'diff'
  | 'history'
  | 'graph'
  | 'merge-editor'
  | 'stash'
  | 'stash-create'
  | 'settings'
  | 'about';

// Views that take over the whole content area instead of living next to the
// sidebar. They remember where the user came from so "back" returns there.
export type OverlayView = Extract<ActiveView, 'settings' | 'about'>;

export type ThemePreference = 'dark' | 'light' | 'system';
export type ResolvedTheme = 'dark' | 'light';

/** A git identity the app can apply to a repository's local config. */
export interface GitProfile {
  id: string;
  label: string;
  name: string;
  email: string;
  sshKeyPath?: string;
  signCommits?: boolean;
}

/** What a repository's local config currently says, as read back from git. */
export interface GitIdentity {
  name: string | null;
  email: string | null;
  sshKeyPath: string | null;
  signingKey: string | null;
  signCommits: boolean;
}

export type ToastVariant = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  variant: ToastVariant;
  title: string;
  message: string;
  action?: { label: string; onClick: () => void };
}

export interface ElectronAPI {
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
  onGitChanged: (cb: () => void) => () => void;
  platform: string;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
