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

/**
 * Every hosting service the app knows how to sign in to. `token` is the
 * catch-all: an arbitrary self-hosted server cannot have an OAuth app
 * registered for it in advance, so it takes a personal access token instead.
 */
export type ProviderId =
  | 'github'
  | 'github-enterprise'
  | 'gitlab'
  | 'gitlab-self'
  | 'azure-devops'
  | 'bitbucket'
  | 'gitea'
  | 'token';

/**
 * A signed-in account, as the renderer sees it. Deliberately carries no token:
 * access and refresh tokens never leave the main process.
 */
export interface ProviderAccount {
  /**
   * Stable identity of this account, `host|login`.
   *
   * Accounts are keyed by this rather than by host because one host commonly
   * carries several: a personal and a work GitHub account differ only by who
   * signed in. Keying by host silently merged them.
   */
  id: string;
  providerId: ProviderId;
  /** Host of the remote this account authenticates. */
  host: string;
  /** Brand name for headings: "GitHub", "GitLab", "Azure DevOps". Never translated. */
  displayName: string;
  login: string;
  name: string | null;
  email: string;
  /** Fetched and inlined by the main process: the CSP forbids remote images. */
  avatarDataUrl: string | null;
}

/** A provider offered in the sign-in picker. */
export interface ProviderOption {
  id: ProviderId;
  displayName: string;
  /** False when this build carries no client id for it — the row is not offered. */
  configured: boolean;
  /** True for self-hosted variants, where the user supplies the server address. */
  needsHost: boolean;
  /**
   * True when this build has no client id for the provider, so the user has to
   * bring one from an app registered on their own instance. Distinct from
   * `needsHost`: Codeberg needs an address from nobody, but a company's own
   * Gitea needs both.
   */
  needsClientId: boolean;
  /** Where to create a token, for the manual path. */
  tokenHelpUrl: string | null;
}

export type SignInPhase =
  /** Several accounts already exist on this host — which one is this repo? */
  | 'pick-account'
  /** Nobody claims this host — which service does it run? */
  | 'choose'
  | 'browser'
  | 'waiting'
  | 'token'
  | 'error';

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
  onAccountChanged: (cb: () => void) => () => void;
  platform: string;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
