// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, o?: { shortcut?: string }) => `${k} ${o?.shortcut ?? ''}`.trim(),
  }),
}));

const { SidebarToggle } = await import('../../../src/components/layout/SidebarToggle');
const { useUiStore } = await import('../../../src/stores/ui-store');

const setPlatform = (platform: string) => {
  window.electronAPI = { platform } as typeof window.electronAPI;
};
const press = (init: KeyboardEventInit, target: EventTarget = window) =>
  act(() => {
    target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, ...init }));
  });

beforeEach(() => {
  setPlatform('darwin');
  useUiStore.setState({ sidebarOpen: true });
});

describe('SidebarToggle', () => {
  it('hides and shows the sidebar, saying which it will do', () => {
    render(<SidebarToggle />);
    const button = screen.getByRole('button', { name: 'hideSidebar ⌘B' });
    expect(button).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(button);
    expect(useUiStore.getState().sidebarOpen).toBe(false);
    expect(screen.getByRole('button', { name: 'showSidebar ⌘B' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('toggles with Cmd+B on macOS and Ctrl+B elsewhere, not with Shift', () => {
    const { unmount } = render(<SidebarToggle />);
    press({ key: 'b', metaKey: true });
    expect(useUiStore.getState().sidebarOpen).toBe(false);
    press({ key: 'b', metaKey: true, shiftKey: true });
    expect(useUiStore.getState().sidebarOpen).toBe(false);
    unmount();

    setPlatform('win32');
    render(<SidebarToggle />);
    expect(screen.getByRole('button', { name: 'showSidebar Ctrl+B' })).toBeInTheDocument();
    press({ key: 'b', ctrlKey: true });
    expect(useUiStore.getState().sidebarOpen).toBe(true);
  });

  it('leaves Ctrl+B to a shell typed into the terminal', () => {
    setPlatform('linux');
    render(<SidebarToggle />);
    const term = document.createElement('div');
    term.className = 'xterm';
    const input = document.createElement('textarea');
    term.appendChild(input);
    document.body.appendChild(term);

    press({ key: 'b', ctrlKey: true }, input);
    expect(useUiStore.getState().sidebarOpen).toBe(true);
    term.remove();
  });
});
