// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { TerminalSession } from '../../../src/types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));
const api = vi.hoisted(() => ({
  create: vi.fn(),
  kill: vi.fn().mockResolvedValue(null),
  list: vi.fn(),
}));
vi.mock('../../../src/api/terminal-api', () => ({ terminalApi: api }));
// xterm needs a real canvas; the pane is covered by the manual check.
vi.mock('../../../src/components/panel/TerminalPane', () => ({
  TerminalPane: ({ id, visible }: { id: string; visible: boolean }) => (
    <div data-testid={`pane-${id}`} data-visible={String(visible)} />
  ),
}));

const { TerminalView } = await import('../../../src/components/panel/TerminalView');
const { useTerminalStore } = await import('../../../src/stores/terminal-store');
const { useRepoStore } = await import('../../../src/stores/repo-store');
const { useSettingsStore } = await import('../../../src/stores/settings-store');

const session = (id: string, title = 'zsh'): TerminalSession => ({
  id,
  repoPath: '/repo',
  shellId: title,
  title,
});

beforeEach(() => {
  api.create.mockReset();
  useRepoStore.setState({ repoPath: '/repo' });
  useSettingsStore.setState({ terminalShell: null });
  useTerminalStore.setState({
    available: true,
    unavailableReason: null,
    shells: [
      { id: 'zsh', label: 'zsh' },
      { id: 'bash', label: 'bash' },
    ],
    sessions: {},
    active: {},
    exited: {},
    restored: { '/repo': true },
  });
});

describe('TerminalView', () => {
  it('opens a shell the first time the terminal is shown', async () => {
    api.create.mockResolvedValue(session('1'));
    render(<TerminalView visible />);
    await waitFor(() => expect(api.create).toHaveBeenCalledWith('/repo', null, 80, 24));
    expect(await screen.findByTestId('pane-1')).toHaveAttribute('data-visible', 'true');
  });

  it('shows tabs, switches between them and opens a chosen shell', async () => {
    useTerminalStore.setState({
      sessions: { '/repo': [session('1'), session('2', 'bash')] },
      active: { '/repo': '1' },
    });
    render(<TerminalView visible />);
    expect(api.create).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('tab', { name: 'bash' }));
    expect(screen.getByTestId('pane-2')).toHaveAttribute('data-visible', 'true');
    expect(screen.getByTestId('pane-1')).toHaveAttribute('data-visible', 'false');

    api.create.mockResolvedValue(session('3', 'bash'));
    fireEvent.click(screen.getByRole('button', { name: 'newWithShell' }));
    fireEvent.click(screen.getByRole('button', { name: 'bash' }));
    await waitFor(() => expect(api.create).toHaveBeenCalledWith('/repo', 'bash', 80, 24));
  });

  it('opens the shell menu over the terminal and closes it on Escape or an outside click', () => {
    useTerminalStore.setState({ sessions: { '/repo': [session('1')] }, active: { '/repo': '1' } });
    render(<TerminalView visible />);
    const toggle = screen.getByRole('button', { name: 'newWithShell' });

    fireEvent.click(toggle);
    // Portalled to <body>, outside the tab bar that would clip it.
    const item = screen.getByRole('button', { name: 'bash' });
    expect(item.closest('.fixed')?.parentElement).toBe(document.body);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('button', { name: 'bash' })).not.toBeInTheDocument();

    fireEvent.click(toggle);
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('button', { name: 'bash' })).not.toBeInTheDocument();
  });

  it('closing the last tab leaves an empty state instead of reopening', async () => {
    useTerminalStore.setState({ sessions: { '/repo': [session('1')] }, active: { '/repo': '1' } });
    render(<TerminalView visible />);
    fireEvent.click(screen.getByRole('button', { name: 'close' }));
    expect(await screen.findByText('empty')).toBeInTheDocument();
    expect(api.create).not.toHaveBeenCalled();
  });

  it('explains when the terminal cannot run here', () => {
    useTerminalStore.setState({ available: false, unavailableReason: 'node-pty missing' });
    render(<TerminalView visible />);
    expect(screen.getByText('unavailable')).toBeInTheDocument();
    expect(screen.getByText('node-pty missing')).toBeInTheDocument();
  });
});
