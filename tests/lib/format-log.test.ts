import { describe, it, expect } from 'vitest';
import { cleanOutput, commandLine, formatDuration, formatEntry } from '../../src/lib/format-log';
import type { LogEntry } from '../../src/types';

describe('format-log', () => {
  it('quotes only arguments a shell would split', () => {
    expect(
      commandLine({ argv: ['git', 'commit', '-m', "it's done"], stdout: '', stderr: '' }),
    ).toBe(`$ git commit -m 'it'\\''s done'`);
    expect(commandLine({ argv: ['git', 'push', 'origin', 'dev'], stdout: '', stderr: '' })).toBe(
      '$ git push origin dev',
    );
  });

  it('keeps the last state of carriage-return progress lines', () => {
    expect(cleanOutput('Counting: 10%\rCounting: 100%\ndone\n\n')).toBe('Counting: 100%\ndone');
  });

  it('formats durations', () => {
    expect(formatDuration(undefined)).toBe('');
    expect(formatDuration(250)).toBe('250ms');
    expect(formatDuration(1234)).toBe('1.2s');
  });

  it('renders an entry like a terminal session', () => {
    const entry: LogEntry = {
      id: '1',
      ts: Date.now(),
      durationMs: 1200,
      repoPath: '/r',
      op: 'push',
      status: 'error',
      commands: [{ argv: ['git', 'push'], stdout: '', stderr: 'rejected\n' }],
      error: 'rejected',
    };
    const text = formatEntry(entry, 'Push');
    expect(text).toMatch(/^\[.+\] Push ✗ \(1\.2s\)\n\$ git push\nrejected$/);
  });
});
