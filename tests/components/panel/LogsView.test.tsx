// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import type { LogEntry } from '../../../src/types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) => (o?.count !== undefined ? `${k}:${o.count}` : k),
  }),
}));
vi.mock('../../../src/api/log-api', () => ({
  logApi: { list: vi.fn(), clear: vi.fn().mockResolvedValue(null) },
}));

const { LogsView } = await import('../../../src/components/panel/LogsView');
const { PanelButtons } = await import('../../../src/components/layout/PanelButtons');
const { useLogStore } = await import('../../../src/stores/log-store');
const { useUiStore } = await import('../../../src/stores/ui-store');

const push: LogEntry = {
  id: 'p',
  ts: Date.now(),
  durationMs: 900,
  repoPath: '/repo',
  op: 'push',
  status: 'success',
  commands: [{ argv: ['git', 'push'], stdout: '', stderr: 'Everything up-to-date\n' }],
};
const failed: LogEntry = {
  id: 'f',
  ts: Date.now() + 1,
  repoPath: '/repo',
  op: 'pull',
  status: 'error',
  commands: [],
  error: 'fatal: no remote',
};

beforeEach(() => {
  window.electronAPI = { platform: 'darwin' } as typeof window.electronAPI;
  Element.prototype.scrollIntoView = vi.fn();
  useUiStore.setState({ rightPanel: null, activeView: 'changes' });
  useLogStore.setState({
    repoPath: '/repo',
    entries: [push, failed],
    hasMore: false,
    unreadErrors: 0,
    focusId: null,
  });
});

describe('LogsView', () => {
  it('lists entries and expands one to its git output', () => {
    render(<LogsView />);
    expect(screen.getByText('op.push')).toBeInTheDocument();
    expect(screen.getByText('op.pull')).toBeInTheDocument();

    fireEvent.click(screen.getByText('op.push'));
    expect(screen.getByText('$ git push')).toBeInTheDocument();
    expect(screen.getByText('Everything up-to-date')).toBeInTheDocument();
  });

  it('filters to errors', () => {
    render(<LogsView />);
    fireEvent.click(screen.getByText('errorsOnly'));
    expect(screen.queryByText('op.push')).not.toBeInTheDocument();
    expect(screen.getByText('op.pull')).toBeInTheDocument();
  });

  it('searches inside git output', () => {
    render(<LogsView />);
    fireEvent.change(screen.getByLabelText('filter'), { target: { value: 'up-to-date' } });
    expect(screen.getByText('op.push')).toBeInTheDocument();
    expect(screen.queryByText('op.pull')).not.toBeInTheDocument();
  });

  it('opens the focused entry', async () => {
    useLogStore.setState({ focusId: 'f' });
    render(<LogsView />);
    expect(await screen.findByText('fatal: no remote')).toBeInTheDocument();
  });

  it('shows the empty state', () => {
    useLogStore.setState({ entries: [] });
    render(<LogsView />);
    expect(screen.getByText('empty')).toBeInTheDocument();
  });
});

describe('PanelButtons', () => {
  it('leaves Ctrl+J to the terminal on Windows and Linux', () => {
    window.electronAPI = { platform: 'win32' } as typeof window.electronAPI;
    render(<PanelButtons />);
    const term = document.createElement('div');
    term.className = 'xterm';
    const input = document.createElement('textarea');
    term.appendChild(input);
    document.body.appendChild(term);
    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', ctrlKey: true, bubbles: true }));
    });
    expect(useUiStore.getState().rightPanel).toBeNull();
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', ctrlKey: true }));
    });
    expect(useUiStore.getState().rightPanel).toBe('logs');
    term.remove();
  });

  it('over Settings, leaves the page and shows the panel instead of toggling it', () => {
    useUiStore.setState({
      activeView: 'settings',
      previousView: 'history',
      rightPanel: 'logs',
    });
    render(<PanelButtons />);
    const logs = screen.getAllByRole('button', { name: /toggle/ })[0];
    // Hidden under the page, so not shown as on.
    expect(logs).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(logs);
    expect(useUiStore.getState().activeView).toBe('history');
    expect(useUiStore.getState().rightPanel).toBe('logs');
  });

  it('toggles the logs panel by click and by shortcut, and marks unread errors', () => {
    useLogStore.setState({ unreadErrors: 2 });
    render(<PanelButtons />);
    const button = screen.getAllByRole('button', { name: /toggle/ })[0];
    expect(button.getAttribute('aria-label')).toContain('unread:2');

    fireEvent.click(button);
    expect(useUiStore.getState().rightPanel).toBe('logs');
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', metaKey: true }));
    });
    expect(useUiStore.getState().rightPanel).toBeNull();
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { code: 'Backquote', key: '`', ctrlKey: true }),
      );
    });
    expect(useUiStore.getState().rightPanel).toBe('terminal');
  });
});
