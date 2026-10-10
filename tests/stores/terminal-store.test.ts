import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { TerminalSession } from '../../src/types';

const api = vi.hoisted(() => ({
  available: vi.fn(),
  shells: vi.fn(),
  list: vi.fn(),
  create: vi.fn(),
  kill: vi.fn(),
}));
vi.mock('../../src/api/terminal-api', () => ({ terminalApi: api }));

const { useTerminalStore } = await import('../../src/stores/terminal-store');

const session = (id: string, repoPath = '/a'): TerminalSession => ({
  id,
  repoPath,
  shellId: 'zsh',
  title: 'zsh',
});

beforeEach(() => {
  Object.values(api).forEach(fn => fn.mockReset());
  api.kill.mockResolvedValue(null);
  useTerminalStore.setState({
    available: null,
    unavailableReason: null,
    shells: [],
    sessions: {},
    active: {},
    exited: {},
    restored: {},
  });
});

describe('terminal store', () => {
  it('asks once whether the terminal works, and for the shells when it does', async () => {
    api.available.mockResolvedValue({ ok: true });
    api.shells.mockResolvedValue([{ id: 'zsh', label: 'zsh' }]);
    await useTerminalStore.getState().init();
    await useTerminalStore.getState().init();
    expect(api.available).toHaveBeenCalledTimes(1);
    expect(useTerminalStore.getState()).toMatchObject({ available: true, shells: [{ id: 'zsh' }] });
  });

  it('keeps the reason when node-pty is missing', async () => {
    api.available.mockResolvedValue({ ok: false, reason: 'no binary' });
    await useTerminalStore.getState().init();
    expect(useTerminalStore.getState()).toMatchObject({
      available: false,
      unavailableReason: 'no binary',
    });
    expect(api.shells).not.toHaveBeenCalled();
  });

  it('keeps sessions per repository and activates a new one', async () => {
    api.create.mockResolvedValueOnce(session('1')).mockResolvedValueOnce(session('2', '/b'));
    await useTerminalStore.getState().create('/a', null);
    await useTerminalStore.getState().create('/b', 'bash');
    const s = useTerminalStore.getState();
    expect(s.sessions['/a'].map(t => t.id)).toEqual(['1']);
    expect(s.sessions['/b'].map(t => t.id)).toEqual(['2']);
    expect(s.active).toEqual({ '/a': '1', '/b': '2' });
    expect(api.create).toHaveBeenLastCalledWith('/b', 'bash', 80, 24);
  });

  it('restores live sessions from the main process after a reload', async () => {
    api.list.mockResolvedValue([session('x'), session('y')]);
    await useTerminalStore.getState().restore('/a');
    const s = useTerminalStore.getState();
    expect(s.sessions['/a'].map(t => t.id)).toEqual(['x', 'y']);
    expect(s.active['/a']).toBe('x');
    expect(s.restored['/a']).toBe(true);
  });

  it('closing kills a running process and moves to the last tab', () => {
    useTerminalStore.setState({
      sessions: { '/a': [session('1'), session('2'), session('3')] },
      active: { '/a': '2' },
    });
    useTerminalStore.getState().close('/a', '2');
    expect(api.kill).toHaveBeenCalledWith('2');
    const s = useTerminalStore.getState();
    expect(s.sessions['/a'].map(t => t.id)).toEqual(['1', '3']);
    expect(s.active['/a']).toBe('3');
  });

  it('closing an exited tab does not kill anything', () => {
    useTerminalStore.setState({ sessions: { '/a': [session('1')] }, exited: { '1': 0 } });
    useTerminalStore.getState().close('/a', '1');
    expect(api.kill).not.toHaveBeenCalled();
    expect(useTerminalStore.getState().exited).toEqual({});
  });

  it('restarts an exited session in the same tab position', async () => {
    useTerminalStore.setState({
      sessions: { '/a': [session('1'), session('2')] },
      exited: { '1': 1 },
    });
    api.create.mockResolvedValue(session('new'));
    await useTerminalStore.getState().restart('/a', '1', 'zsh');
    const s = useTerminalStore.getState();
    expect(s.sessions['/a'].map(t => t.id)).toEqual(['new', '2']);
    expect(s.exited).toEqual({});
    expect(s.active['/a']).toBe('new');
  });
});
