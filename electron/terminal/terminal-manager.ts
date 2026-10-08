import fs from 'fs';
import { randomUUID } from 'crypto';
import type { IPty } from 'node-pty';
import type { TerminalSession } from '../../src/types';
import type { PtyModule } from './pty-loader';
import { pickShell, terminalEnv, type ShellSpec } from './shell';

/** Scrollback kept per session, replayed when its tab comes back into view. */
export const BUFFER_CHARS = 200_000;
/** Output is batched for one frame: `yes` must not become an IPC per byte. */
const FLUSH_MS = 16;

export interface TerminalEvents {
  data: (id: string, data: string) => void;
  exit: (id: string, exitCode: number) => void;
}

interface Session extends TerminalSession {
  pty: IPty;
  buffer: string;
  pending: string;
  timer: ReturnType<typeof setTimeout> | null;
}

export class TerminalManager {
  private sessions = new Map<string, Session>();

  constructor(
    private readonly pty: PtyModule,
    private readonly shells: () => ShellSpec[],
    private readonly events: TerminalEvents,
  ) {}

  create(opts: {
    repoPath: string;
    shellId?: string | null;
    cols: number;
    rows: number;
  }): TerminalSession {
    if (!fs.existsSync(opts.repoPath)) throw new Error('The repository folder no longer exists');
    const shell = pickShell(this.shells(), opts.shellId);
    if (!shell) throw new Error('No shell found on this system');

    const pty = this.pty.spawn(shell.path, shell.args, {
      name: 'xterm-256color',
      cols: opts.cols,
      rows: opts.rows,
      cwd: opts.repoPath,
      env: terminalEnv(),
    });
    const session: Session = {
      id: randomUUID(),
      repoPath: opts.repoPath,
      shellId: shell.id,
      title: shell.label,
      pty,
      buffer: '',
      pending: '',
      timer: null,
    };
    this.sessions.set(session.id, session);

    pty.onData(data => {
      session.buffer = trimBuffer(session.buffer + data);
      session.pending += data;
      session.timer ??= setTimeout(() => this.flush(session), FLUSH_MS);
    });
    pty.onExit(({ exitCode }) => {
      this.flush(session);
      this.sessions.delete(session.id);
      this.events.exit(session.id, exitCode);
    });

    return describe(session);
  }

  write(id: string, data: string): void {
    this.get(id).pty.write(data);
  }

  resize(id: string, cols: number, rows: number): void {
    try {
      this.get(id).pty.resize(cols, rows);
    } catch {
      // A resize racing the process's exit is harmless.
    }
  }

  kill(id: string): void {
    const session = this.sessions.get(id);
    if (!session) return;
    try {
      session.pty.kill();
    } catch {}
  }

  /** A repository leaving the app takes its shells with it. */
  killRepo(repoPath: string): void {
    for (const session of this.sessions.values()) {
      if (session.repoPath === repoPath) this.kill(session.id);
    }
  }

  killAll(): void {
    for (const id of this.sessions.keys()) this.kill(id);
  }

  list(repoPath: string): TerminalSession[] {
    return [...this.sessions.values()].filter(s => s.repoPath === repoPath).map(describe);
  }

  buffer(id: string): string {
    return this.get(id).buffer;
  }

  private get(id: string): Session {
    const session = this.sessions.get(id);
    if (!session) throw new Error('No such terminal');
    return session;
  }

  private flush(session: Session): void {
    if (session.timer) clearTimeout(session.timer);
    session.timer = null;
    if (!session.pending) return;
    const data = session.pending;
    session.pending = '';
    this.events.data(session.id, data);
  }
}

function describe(s: Session): TerminalSession {
  return { id: s.id, repoPath: s.repoPath, shellId: s.shellId, title: s.title };
}

/** Cut at a line start where possible, so the replay does not open mid-escape. */
export function trimBuffer(buffer: string, max = BUFFER_CHARS): string {
  if (buffer.length <= max) return buffer;
  const cut = buffer.length - max;
  const newline = buffer.indexOf('\n', cut);
  return buffer.slice(newline >= 0 && newline - cut < 4096 ? newline + 1 : cut);
}
