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
  | 'settings-account'
  | 'about';

// Views that take over the whole content area instead of living next to the
// sidebar. They remember where the user came from so "back" returns there.
export type OverlayView = Extract<ActiveView, 'settings' | 'settings-account' | 'about'>;

export type ThemePreference = 'dark' | 'light' | 'system';
export type ResolvedTheme = 'dark' | 'light';

export type IdentityScope = 'local' | 'global' | 'included' | 'none';

/**
 * Who this repository commits as, and which config file decided that. Resolved
 * by git itself, so it covers a local override, the global config and any file
 * pulled in by `includeIf` without the app modelling any of them.
 */
/** The identity a repository would use if its own override were removed. */
export interface InheritedIdentity {
  name: string | null;
  email: string | null;
  origin: string | null;
  scope: IdentityScope;
}

export interface EffectiveIdentity {
  name: string | null;
  email: string | null;
  origin: string | null;
  scope: IdentityScope;
  signingKey: string | null;
  signCommits: boolean;
  /** Only set while a repository-level override is in effect. */
  inherited: InheritedIdentity | null;
}

/** Read-only view of how this repository authenticates. Carries no secrets. */
export interface AuthStatus {
  remoteUrl: string | null;
  isHttps: boolean;
  credentialHelper: string | null;
  signingReady: boolean;
  sshSupportsKeychain: boolean;
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
