// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { resolvedLanguage: 'en' } }),
}));
vi.mock('../../../src/components/settings/GeneralSection', () => ({
  GeneralSection: () => <p>general page</p>,
}));
vi.mock('../../../src/components/settings/AccountsSection', () => ({
  AccountsSection: () => <p>accounts page</p>,
}));
vi.mock('../../../src/components/settings/GitIdentitySection', () => ({
  GitIdentitySection: () => <p>git page</p>,
}));
vi.mock('../../../src/components/settings/DiffSection', () => ({
  DiffSection: () => <p>diff page</p>,
}));
vi.mock('../../../src/components/settings/TerminalSection', () => ({
  TerminalSection: () => <p>terminal page</p>,
}));
vi.mock('../../../src/components/settings/LogsSection', () => ({
  LogsSection: () => <p>logs page</p>,
}));
vi.mock('../../../src/components/settings/UpdateSection', () => ({
  UpdateSection: () => <p>updates page</p>,
}));

const { SettingsView } = await import('../../../src/components/settings/SettingsView');
const { useUiStore } = await import('../../../src/stores/ui-store');
const { useRepoStore } = await import('../../../src/stores/repo-store');

beforeEach(() => {
  useUiStore.setState({
    activeView: 'changes',
    previousView: 'changes',
    settingsCategory: 'general',
  });
  useRepoStore.setState({ repoPath: '/repo' });
});

const menu = () => screen.getByRole('navigation', { name: 'title' });

describe('SettingsView', () => {
  it('lists the seven categories and opens on General', () => {
    render(<SettingsView />);
    const items = menu().querySelectorAll('button');
    expect([...items].map(b => b.textContent)).toEqual([
      'categories.general',
      'categories.accounts',
      'categories.git',
      'categories.diff',
      'categories.terminal',
      'categories.logs',
      'categories.updates',
    ]);
    expect(screen.getByText('general page')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'categories.general' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('switches the page from the menu and names it in the breadcrumbs', () => {
    render(<SettingsView />);
    fireEvent.click(screen.getByRole('button', { name: 'categories.terminal' }));
    expect(screen.getByText('terminal page')).toBeInTheDocument();
    expect(screen.queryByText('general page')).not.toBeInTheDocument();

    const crumbs = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(crumbs).toHaveTextContent('categories.terminal');
    fireEvent.click(screen.getByRole('button', { name: 'title' }));
    expect(screen.getByText('general page')).toBeInTheDocument();
  });

  it('opens straight on a category asked for from elsewhere', () => {
    useUiStore.getState().openSettings('git');
    render(<SettingsView />);
    expect(useUiStore.getState().activeView).toBe('settings');
    expect(screen.getByText('git page')).toBeInTheDocument();
  });

  it('walks the menu with the arrow keys, wrapping around', () => {
    render(<SettingsView />);
    fireEvent.keyDown(menu(), { key: 'ArrowDown' });
    expect(screen.getByText('accounts page')).toBeInTheDocument();
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'categories.accounts' }),
    );
    fireEvent.keyDown(menu(), { key: 'ArrowUp' });
    fireEvent.keyDown(menu(), { key: 'ArrowUp' });
    expect(screen.getByText('updates page')).toBeInTheDocument();
  });

  it('drops the back link with a repository open, keeps it on the welcome path', () => {
    const { unmount } = render(<SettingsView />);
    expect(screen.queryByText(/back/)).toBeNull();
    unmount();

    useRepoStore.setState({ repoPath: null });
    useUiStore.getState().openSettings();
    render(<SettingsView />);
    fireEvent.click(screen.getByText(/back/));
    expect(useUiStore.getState().activeView).toBe('changes');
  });

  it('closes on Esc, but not while typing or under a dialog', () => {
    useUiStore.getState().openSettings();
    render(<SettingsView />);

    const input = document.createElement('input');
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(useUiStore.getState().activeView).toBe('settings');
    input.remove();

    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    document.body.appendChild(dialog);
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(useUiStore.getState().activeView).toBe('settings');
    dialog.remove();

    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(useUiStore.getState().activeView).toBe('changes');
  });
});
