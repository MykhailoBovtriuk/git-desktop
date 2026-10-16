// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

const { WelcomeScreen } = await import('../../../src/components/welcome/WelcomeScreen');
const { useUiStore } = await import('../../../src/stores/ui-store');
const { useRepoStore } = await import('../../../src/stores/repo-store');

beforeEach(() => {
  useRepoStore.setState({ recentRepos: [] });
  useUiStore.setState({ activeView: 'changes', previousView: 'changes' });
});

describe('WelcomeScreen', () => {
  it('offers Settings and Info as labelled buttons beside opening a repository', () => {
    render(<WelcomeScreen />);
    expect(screen.getByRole('button', { name: 'open' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'settings' }));
    expect(useUiStore.getState().activeView).toBe('settings');

    useUiStore.setState({ activeView: 'changes' });
    fireEvent.click(screen.getByRole('button', { name: 'info' }));
    expect(useUiStore.getState().activeView).toBe('about');
  });
});
