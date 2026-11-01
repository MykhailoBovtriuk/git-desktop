import type { GitErrorKind } from './lib/git-error-mapper';

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

export type IpcResult<T> = { data: T } | { error: string; logId?: string };

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
  needsClientSecret: boolean;
}

export type ServerProbe = 'ok' | 'mismatch' | 'unreachable';

export interface CredentialHelperEntry {
  url: string | null;
  helper: string;
  scope: 'system' | 'global' | 'local';
  cli: 'gh' | 'glab' | 'gcm' | null;
}

export type RemoteProtocol = 'ssh' | 'https' | 'other';
export type SwitchableProtocol = Exclude<RemoteProtocol, 'other'>;

export interface AccountsSnapshot {
  accounts: ProviderAccount[];
  persistent: boolean;
  error: string | null;
  errorLogId?: string | null;
}

export interface ProvidersForHost {
  host: string | null;
  providerId: ProviderId | null;
  options: ProviderOption[];
}

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

type UpdateStatus = 'up-to-date' | 'available' | 'skipped';

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

export type LogCategory = 'git' | 'auth' | 'update' | 'app';

// Every operation names its category here, so a new one cannot be left out.
// Derived on read, never stored: entries written before categories existed read the same.
const LOG_OP_CATEGORY = {
  commit: 'git',
  stage: 'git',
  unstage: 'git',
  discard: 'git',
  fetch: 'git',
  pull: 'git',
  push: 'git',
  publish: 'git',
  'remote-protocol': 'git',
  'branch-create': 'git',
  'branch-delete': 'git',
  'remote-branch-delete': 'git',
  checkout: 'git',
  merge: 'git',
  'merge-abort': 'git',
  'merge-conclude': 'git',
  resolve: 'git',
  rebase: 'git',
  'rebase-abort': 'git',
  'rebase-continue': 'git',
  'stash-save': 'git',
  'stash-apply': 'git',
  'stash-pop': 'git',
  'stash-drop': 'git',
  'open-repo': 'git',
  refresh: 'git',
  'read-file': 'git',
  'write-file': 'git',
  'identity-set': 'git',
  'identity-auto': 'git',
  'legacy-cleanup': 'git',
  watcher: 'git',
  'sign-in-browser': 'auth',
  'sign-in-callback': 'auth',
  'sign-in-token': 'auth',
  'sign-out': 'auth',
  'token-refresh': 'auth',
  'token-revoke': 'auth',
  'credential-store': 'auth',
  'credential-forget': 'auth',
  'probe-server': 'auth',
  'accounts-load': 'auth',
  'account-profile': 'auth',
  'update-check': 'update',
  'update-download': 'update',
  'update-install': 'update',
  'terminal-load': 'app',
  'terminal-create': 'app',
  'terminal-io': 'app',
  'repo-forget': 'app',
  'app-crash': 'app',
  'app-unhandled': 'app',
  'renderer-gone': 'app',
  'asset-load': 'app',
  'ui-crash': 'app',
  'ui-unhandled': 'app',
  'ui-action': 'app',
} as const satisfies Record<string, LogCategory>;

export type LogOp = keyof typeof LOG_OP_CATEGORY;

export const LOG_CATEGORIES: readonly LogCategory[] = ['git', 'auth', 'update', 'app'];

export const logCategory = (op: LogOp): LogCategory => LOG_OP_CATEGORY[op] ?? 'git';

export const REPORTABLE_OPS = ['ui-crash', 'ui-unhandled'] as const;
export type ReportableOp = (typeof REPORTABLE_OPS)[number];

export type LogStatus = 'running' | 'success' | 'info' | 'warning' | 'error';

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
  errorKind?: GitErrorKind;
  count?: number;
  lastTs?: number;
}

export const LOG_RETENTIONS = ['session', 'day', 'week', 'month', 'forever'] as const;
export type LogRetention = (typeof LOG_RETENTIONS)[number];

export interface LogStats {
  bytes: number;
  entries: number;
  app: { bytes: number; entries: number };
  writeErrors: number;
  lastWriteError: string | null;
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
