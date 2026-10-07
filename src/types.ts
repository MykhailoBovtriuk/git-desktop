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
  /** Tracking branch, e.g. "origin/main"; null until the branch is published. */
  upstream: string | null;
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
 * Every hosting service the app can sign in to; `token` is the catch-all
 * personal access token.
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
 * A signed-in account as the renderer sees it; tokens never leave the main
 * process.
 */
export interface ProviderAccount {
  /**
   * The host: `git credential` addresses by host, so there is one account per
   * host.
   */
  id: string;
  providerId: ProviderId;
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
   * True when the user must bring their own client id. Distinct from
   * `needsHost`: Codeberg needs neither address nor id.
   */
  needsClientId: boolean;
  /** Where to create a token, for the manual path. */
  tokenHelpUrl: string | null;
}

/**
 * How git authenticates to a remote; ssh uses a key, so a token is irrelevant.
 */
export type RemoteProtocol = 'ssh' | 'https' | 'other';

/**
 * What authenticates this repository's remote. `system` is a credential in the
 * OS store that the app did not create and may not remove.
 */
export type AuthSource = 'account' | 'ssh' | 'system' | 'none';

export type SignInPhase =
  /** Nobody claims this host — which service does it run? */
  'choose' | 'browser' | 'waiting' | 'token' | 'error';

export type ToastVariant = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  variant: ToastVariant;
  title: string;
  message: string;
  action?: { label: string; onClick: () => void };
  /** A quieter link than `action`: it does not keep the toast on screen. */
  details?: { label: string; onClick: () => void };
}

/**
 * A release worth offering. `assetName` is null when nothing is built for this
 * platform; the UI links to the release page.
 */
export interface UpdateInfo {
  /** Without the leading v: '1.2.0'. */
  version: string;
  /** As tagged: 'v1.2.0'. */
  tag: string;
  notes: string;
  publishedAt: string | null;
  releaseUrl: string;
  assetName: string | null;
  /** Bytes, 0 when the release did not say. */
  assetSize: number;
  prerelease: boolean;
}

/** `skipped`: a dev run, where the check never reaches the network. */
export type UpdateStatus = 'up-to-date' | 'available' | 'skipped';

export interface UpdateCheckResult {
  status: UpdateStatus;
  currentVersion: string;
  latest: UpdateInfo | null;
  /** The release matching the running version, for reinstalling it. */
  current: UpdateInfo | null;
  /** False in a dev run: downloading and installing are refused. */
  canInstall: boolean;
  checkedAt: number;
}

export interface UpdateProgress {
  version: string;
  receivedBytes: number;
  /** 0 when the server sent no Content-Length. */
  totalBytes: number;
  percent: number;
  bytesPerSecond: number;
}

export interface DownloadedUpdate {
  version: string;
  filePath: string;
}

export type UpdatePhase =
  /** Nothing asked for yet, or the last answer was "up to date". */
  'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error';

/** A user-visible git operation; the logs panel names entries after it. */
export type LogOp =
  | 'commit'
  | 'stage'
  | 'unstage'
  | 'discard'
  | 'fetch'
  | 'pull'
  | 'push'
  | 'publish'
  | 'remote-protocol'
  | 'branch-create'
  | 'branch-delete'
  | 'remote-branch-delete'
  | 'checkout'
  | 'merge'
  | 'merge-abort'
  | 'merge-conclude'
  | 'resolve'
  | 'rebase'
  | 'rebase-abort'
  | 'rebase-continue'
  | 'stash-save'
  | 'stash-apply'
  | 'stash-pop'
  | 'stash-drop';

export type LogStatus = 'running' | 'success' | 'error';

/** One git process run on behalf of a logged operation, as a terminal would show it. */
export interface LogCommand {
  argv: string[];
  stdout: string;
  stderr: string;
}

export interface LogEntry {
  id: string;
  ts: number;
  durationMs?: number;
  repoPath: string | null;
  op: LogOp;
  /** What the operation was about: a branch, the commit subject, a stash message. */
  detail?: string;
  status: LogStatus;
  commands: LogCommand[];
  error?: string;
}

/** How long finished entries stay on disk; 'session' never writes them. */
export const LOG_RETENTIONS = ['session', 'day', 'week', 'month', 'forever'] as const;
export type LogRetention = (typeof LOG_RETENTIONS)[number];

export interface LogStats {
  bytes: number;
  entries: number;
}

export interface ElectronAPI {
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
  onGitChanged: (cb: () => void) => () => void;
  onAccountChanged: (cb: () => void) => () => void;
  // Unlike the two above, this one carries a payload: the renderer draws the
  // progress bar from it rather than asking back for the numbers.
  onUpdateProgress: (cb: (progress: UpdateProgress) => void) => () => void;
  onLogEntry: (cb: (entry: LogEntry) => void) => () => void;
  platform: string;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
