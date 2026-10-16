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

export type OverlayView = Extract<ActiveView, 'settings' | 'about'>;

export type ThemePreference = 'dark' | 'light' | 'system';
export type ResolvedTheme = 'dark' | 'light';

export type ProviderId =
  | 'github'
  | 'github-enterprise'
  | 'gitlab'
  | 'gitlab-self'
  | 'azure-devops'
  | 'azure-devops-server'
  | 'bitbucket'
  | 'bitbucket-server'
  | 'gitea'
  | 'token';

/**
 * A signed-in account as the renderer sees it; tokens never leave the main
 * process.
 */
export interface ProviderAccount {
  id: string;
  repoPath: string;
  providerId: ProviderId;
  host: string;
  displayName: string;
  login: string;
  name: string | null;
  email: string;
  /** Fetched and inlined by the main process: the CSP forbids remote images. */
  avatarDataUrl: string | null;
}

export type AccountGroup = 'github' | 'github-enterprise' | 'gitlab' | 'gitlab-self' | 'other';

export interface ProviderOption {
  id: ProviderId;
  displayName: string;
  group: AccountGroup;
  defaultHost: string | null;
  configured: boolean;
  needsHost: boolean;
  needsClientId: boolean;
  tokenHelpUrl: string | null;
}

export type ServerProbe = 'ok' | 'mismatch' | 'unreachable';

export interface CredentialHelperEntry {
  url: string | null;
  helper: string;
  scope: 'system' | 'global' | 'local';
  cli: 'gh' | 'glab' | 'gcm' | null;
}

export type RemoteProtocol = 'ssh' | 'https' | 'other';

export type AuthSource = 'account' | 'ssh' | 'system' | 'none';

export type SignInPhase =
  'choose' | 'endpoint' | 'existing' | 'browser' | 'waiting' | 'token' | 'error';

export type ToastVariant = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  variant: ToastVariant;
  title: string;
  message: string;
  action?: { label: string; onClick: () => void };
  details?: { label: string; onClick: () => void };
}

export interface UpdateInfo {
  version: string;
  tag: string;
  notes: string;
  publishedAt: string | null;
  releaseUrl: string;
  assetName: string | null;
  assetSize: number;
  prerelease: boolean;
}

export type UpdateStatus = 'up-to-date' | 'available' | 'skipped';

export interface UpdateCheckResult {
  status: UpdateStatus;
  currentVersion: string;
  latest: UpdateInfo | null;
  current: UpdateInfo | null;
  canInstall: boolean;
  checkedAt: number;
}

export interface UpdateProgress {
  version: string;
  receivedBytes: number;
  totalBytes: number;
  percent: number;
  bytesPerSecond: number;
}

export interface DownloadedUpdate {
  version: string;
  filePath: string;
}

export type UpdatePhase = 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error';

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
  detail?: string;
  status: LogStatus;
  commands: LogCommand[];
  error?: string;
}

export const LOG_RETENTIONS = ['session', 'day', 'week', 'month', 'forever'] as const;
export type LogRetention = (typeof LOG_RETENTIONS)[number];

export interface LogStats {
  bytes: number;
  entries: number;
}

export interface GitIdentity {
  name: string;
  email: string;
}

export interface GitIdentities {
  global: GitIdentity;
  local: GitIdentity | null;
}

export interface TerminalShell {
  id: string;
  label: string;
}

export interface TerminalSession {
  id: string;
  repoPath: string;
  shellId: string;
  title: string;
}

export interface TerminalAvailability {
  ok: boolean;
  reason?: string;
}

export interface ElectronAPI {
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
  onGitChanged: (cb: () => void) => () => void;
  onAccountChanged: (cb: () => void) => () => void;
  onUpdateProgress: (cb: (progress: UpdateProgress) => void) => () => void;
  onLogEntry: (cb: (entry: LogEntry) => void) => () => void;
  onTerminalData: (cb: (id: string, data: string) => void) => () => void;
  onTerminalExit: (cb: (id: string, exitCode: number) => void) => () => void;
  platform: string;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
