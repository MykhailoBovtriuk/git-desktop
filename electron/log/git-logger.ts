import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';
import type { SimpleGit } from 'simple-git';
import type { LogCommand, LogEntry, LogOp } from '../../src/types';
import { redact } from './redact';

/** Per stream: a `git log -p` slipped into an operation must not bloat the file. */
export const MAX_STREAM_CHARS = 64 * 1024;
const TRUNCATED = '\n…[truncated]';

type LogSink = (entry: LogEntry) => void;

const current = new AsyncLocalStorage<LogEntry>();
let sink: LogSink = () => {};

export function setLogSink(fn: LogSink): void {
  sink = fn;
}

function snapshot(entry: LogEntry): LogEntry {
  return { ...entry, commands: entry.commands.map(c => ({ ...c, argv: [...c.argv] })) };
}

function collect(
  stream: NodeJS.ReadableStream,
  command: LogCommand,
  key: 'stdout' | 'stderr',
): void {
  stream.on('data', (chunk: Buffer | string) => {
    if (command[key].length >= MAX_STREAM_CHARS) return;
    const next = command[key] + chunk.toString();
    command[key] =
      next.length > MAX_STREAM_CHARS ? next.slice(0, MAX_STREAM_CHARS) + TRUNCATED : next;
  });
}

/**
 * Routes a git instance's process output into the operation being logged, if
 * any. Background reads (status polling, diffs) run outside `logged` and are
 * ignored, which keeps the log down to what the user actually did.
 */
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

function finalize(entry: LogEntry): LogEntry {
  return {
    ...entry,
    detail: entry.detail === undefined ? undefined : redact(entry.detail),
    error: entry.error === undefined ? undefined : redact(entry.error),
    commands: entry.commands.map(c => ({
      argv: c.argv.map(redact),
      stdout: redact(c.stdout),
      stderr: redact(c.stderr),
    })),
  };
}

/** Runs `fn` as one entry in the log: announced as running, then settled. */
export async function logged<T>(
  op: LogOp,
  repoPath: string | null,
  detail: string | undefined,
  fn: () => Promise<T>,
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
  sink(finalize(snapshot(entry)));
  try {
    const result = await current.run(entry, fn);
    entry.status = 'success';
    return result;
  } catch (err: unknown) {
    entry.status = 'error';
    entry.error = err instanceof Error ? err.message : String(err);
    throw err;
  } finally {
    entry.durationMs = Date.now() - entry.ts;
    sink(finalize(snapshot(entry)));
  }
}
