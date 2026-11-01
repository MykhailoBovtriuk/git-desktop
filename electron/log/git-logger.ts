import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';
import type { SimpleGit } from 'simple-git';
import {
  logCategory,
  type LogCommand,
  type LogEntry,
  type LogOp,
  type LogStatus,
} from '../../src/types';
import { classifyGitError } from '../../src/lib/git-error-mapper';
import { describeError } from '../../src/lib/error-message';
import { redact } from './redact';

const MAX_STREAM_CHARS = 64 * 1024;
const TRUNCATED = '\n…[truncated]';
const FOLD_WINDOW_MS = 10 * 60 * 1000;
const FOLD_KEYS_CAP = 200;

type LogSink = (entry: LogEntry) => void;

const current = new AsyncLocalStorage<LogEntry>();
let sink: LogSink = () => {};
const lastProblem = new Map<string, LogEntry>();
const errorLogIds = new WeakMap<object, string>();

export function setLogSink(fn: LogSink): void {
  sink = fn;
  lastProblem.clear();
}

export function logIdOf(err: unknown): string | undefined {
  return typeof err === 'object' && err !== null ? errorLogIds.get(err) : undefined;
}

function snapshot(entry: LogEntry): LogEntry {
  return { ...entry, commands: entry.commands.map(c => ({ ...c, argv: [...c.argv] })) };
}

function clip(text: string): string {
  return text.length > MAX_STREAM_CHARS ? text.slice(0, MAX_STREAM_CHARS) + TRUNCATED : text;
}

function collect(
  stream: NodeJS.ReadableStream,
  command: LogCommand,
  key: 'stdout' | 'stderr',
): void {
  stream.on('data', (chunk: Buffer | string) => {
    if (command[key].length >= MAX_STREAM_CHARS) return;
    command[key] = clip(command[key] + chunk.toString());
  });
}

export function attachOutputLogger(git: SimpleGit): SimpleGit {
  return git.outputHandler((_bin, stdout, stderr, args) => {
    const entry = current.getStore();
    if (!entry) return;
    const command: LogCommand = { argv: ['git', ...args], stdout: '', stderr: '' };
    entry.commands.push(command);
    collect(stdout, command, 'stdout');
    collect(stderr, command, 'stderr');
  });
}

export function recordCommand(argv: string[], stdout: string, stderr: string): void {
  const entry = current.getStore();
  if (!entry) return;
  entry.commands.push({ argv: [...argv], stdout: clip(stdout), stderr: clip(stderr) });
}

export function markCurrent(patch: { status: 'warning'; error: string }): void {
  const entry = current.getStore();
  if (!entry) return;
  entry.status = patch.status;
  entry.error = patch.error;
}

function finalize(entry: LogEntry): LogEntry {
  const error = entry.error === undefined ? undefined : redact(entry.error);
  // Git's own wording is what the classifier knows; elsewhere it would guess.
  const kind =
    entry.status === 'error' && error && logCategory(entry.op) === 'git'
      ? classifyGitError(error).kind
      : undefined;
  return {
    ...entry,
    detail: entry.detail === undefined ? undefined : redact(entry.detail),
    error,
    ...(kind && kind !== 'unknown' ? { errorKind: kind } : {}),
    commands: entry.commands.map(c => ({
      argv: c.argv.map(redact),
      stdout: redact(c.stdout),
      stderr: redact(c.stderr),
    })),
  };
}

// Repeats of one problem (polling hits it every few seconds) fold into the
// previous entry. Only entries that never sent a `running` state may fold, or
// that state would hang in the panel forever.
function emit(entry: LogEntry, foldable: boolean): string {
  const out = finalize(snapshot(entry));
  if (foldable && (out.status === 'error' || out.status === 'warning')) {
    const key = [out.repoPath, out.op, out.detail, out.status, out.error].join('\0');
    const prev = lastProblem.get(key);
    if (prev && out.ts - (prev.lastTs ?? prev.ts) < FOLD_WINDOW_MS) {
      const folded: LogEntry = {
        ...prev,
        count: (prev.count ?? 1) + 1,
        lastTs: out.ts,
        durationMs: out.durationMs,
        commands: out.commands,
      };
      lastProblem.set(key, folded);
      sink(folded);
      return folded.id;
    }
    if (lastProblem.size >= FOLD_KEYS_CAP) lastProblem.clear();
    lastProblem.set(key, out);
  }
  sink(out);
  return out.id;
}

export interface LoggedOptions {
  quiet?: boolean;
  expected?: (err: unknown) => boolean;
}

export async function logged<T>(
  op: LogOp,
  repoPath: string | null,
  detail: string | undefined,
  fn: () => Promise<T>,
  { quiet = false, expected }: LoggedOptions = {},
): Promise<T> {
  const entry: LogEntry = {
    id: randomUUID(),
    ts: Date.now(),
    repoPath,
    op,
    detail,
    status: 'running',
    commands: [],
  };
  if (!quiet) sink(finalize(snapshot(entry)));
  let failure: unknown = undefined;
  try {
    const result = await current.run(entry, fn);
    if (entry.status === 'running') entry.status = 'success';
    return result;
  } catch (err: unknown) {
    entry.status = expected?.(err) ? 'info' : 'error';
    entry.error = describeError(err);
    failure = err;
    throw err;
  } finally {
    entry.durationMs = Date.now() - entry.ts;
    if (!quiet || (entry.status !== 'success' && entry.status !== 'info')) {
      const id = emit(entry, quiet);
      if (typeof failure === 'object' && failure !== null) errorLogIds.set(failure, id);
    }
  }
}

export interface LogEvent {
  op: LogOp;
  repoPath: string | null;
  status: Exclude<LogStatus, 'running'>;
  detail?: string;
  error?: unknown;
}

export function logEvent(event: LogEvent): string {
  const entry: LogEntry = {
    id: randomUUID(),
    ts: Date.now(),
    repoPath: event.repoPath,
    op: event.op,
    detail: event.detail,
    status: event.status,
    commands: [],
    ...(event.error === undefined ? {} : { error: describeError(event.error) }),
  };
  return emit(entry, true);
}
