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
   * Stable identity of this account: the host.
   *
   * `git credential` addresses a credential by protocol and host, so a second
   * account on the same host is one git cannot be told to prefer. One host,
   * one account — signing in again replaces it.
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

/**
 * How git authenticates to a remote. An ssh remote uses a key, so neither a
 * stored token nor a sign-in offer has anything to do there.
 */
export type RemoteProtocol = 'ssh' | 'https' | 'other';

/**
 * What actually authenticates this repository's remote — the question the UI
 * needs answered before it offers a sign-in nobody needs.
 *
 * `system` is the common case on a machine somebody has worked on for years:
 * the credential is in the OS store, put there by git or another tool, and this
 * app neither created it nor may remove it.
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
}

/**
 * A release worth offering, as the renderer needs it.
 *
 * `assetName` is null when nothing is built for this platform and
 * architecture — the UI then links to the release page instead of pretending
 * it can download something.
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

/**
 * `skipped` is a check that never reached the network: a dev run, where an
 * installer must not be launched over the real install anyway.
 */
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

export interface ElectronAPI {
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
  onGitChanged: (cb: () => void) => () => void;
  onAccountChanged: (cb: () => void) => () => void;
  // Unlike the two above, this one carries a payload: the renderer draws the
  // progress bar from it rather than asking back for the numbers.
  onUpdateProgress: (cb: (progress: UpdateProgress) => void) => () => void;
  platform: string;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
