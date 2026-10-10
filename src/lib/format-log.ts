import type { LogCommand, LogEntry } from '../types';

/** Quotes an argument only when a shell would split it, so the line pastes back. */
function shellArg(arg: string): string {
  return /^[\w@%+=:,./-]+$/.test(arg) ? arg : `'${arg.replace(/'/g, `'\\''`)}'`;
}

export function commandLine(command: LogCommand): string {
  return '$ ' + command.argv.map(shellArg).join(' ');
}

/**
 * Git redraws progress with carriage returns; only the last state of each line
 * is worth reading back.
 */
export function cleanOutput(text: string): string {
  return text
    .split('\n')
    .map(line => {
      const parts = line.split('\r').filter(Boolean);
      return parts.length ? parts[parts.length - 1] : '';
    })
    .join('\n')
    .replace(/\n+$/, '');
}

export function formatTime(ts: number, now = Date.now()): string {
  const d = new Date(ts);
  const time = d.toLocaleTimeString(undefined, { hour12: false });
  return new Date(now).toDateString() === d.toDateString()
    ? time
    : `${d.toLocaleDateString()} ${time}`;
}

export function formatDuration(ms: number | undefined): string {
  if (ms === undefined) return '';
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

const MARK = { running: '…', success: '✓', error: '✗' } as const;

/** Plain text in the shape of a terminal session, for the clipboard. */
export function formatEntry(entry: LogEntry, title: string): string {
  const head = [
    `[${formatTime(entry.ts)}]`,
    title,
    MARK[entry.status],
    entry.durationMs !== undefined ? `(${formatDuration(entry.durationMs)})` : '',
  ]
    .filter(Boolean)
    .join(' ');
  const lines = [head];
  for (const command of entry.commands) {
    lines.push(commandLine(command));
    const out = [cleanOutput(command.stdout), cleanOutput(command.stderr)].filter(Boolean);
    lines.push(...out);
  }
  if (entry.error && !entry.commands.some(c => c.stderr.includes(entry.error!.trim()))) {
    lines.push(entry.error.trim());
  }
  return lines.join('\n');
}
