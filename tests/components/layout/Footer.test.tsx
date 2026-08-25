// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Footer } from '../../../src/components/layout/Footer';
import { useRepoStore } from '../../../src/stores/repo-store';
import { useUiStore } from '../../../src/stores/ui-store';
import type { EffectiveIdentity } from '../../../src/types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));
vi.mock('../../../src/stores/repo-store', () => ({ useRepoStore: vi.fn() }));
vi.mock('../../../src/stores/ui-store', () => ({ useUiStore: vi.fn() }));

const IDENTITY: EffectiveIdentity = {
  name: 'Mykhailo',
  email: 'mykhailo@example.com',
  origin: '/home/me/.gitconfig',
  scope: 'global',
  signingKey: null,
  signCommits: false,
  inherited: null,
};

function setup(identity: EffectiveIdentity | null = IDENTITY) {
  const openOverlayView = vi.fn();
  // Selector-aware: Footer and AppMenuButtons both select from the ui store.
  const repoState = {
    currentBranch: 'feature/login',
    identity,
    commits: [{ abbreviatedHash: 'a1b2c3d' }],
    aheadBehind: { ahead: 0, behind: 0 },
    fetch: vi.fn(),
    pull: vi.fn(),
    push: vi.fn(),
    publishBranch: vi.fn(),
  };
  const uiState = { addToast: vi.fn(), openOverlayView };
  vi.mocked(useRepoStore).mockImplementation(((sel: any) => sel(repoState)) as any);
  vi.mocked(useUiStore).mockImplementation(((sel: any) => sel(uiState)) as any);
  return { openOverlayView };
}

describe('Footer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the identity commits are made with', () => {
    setup();
    render(<Footer />);
    expect(screen.getByText('Mykhailo')).toBeTruthy();
    expect(screen.getByText('<mykhailo@example.com>')).toBeTruthy();
  });

  // The branch lives in the titlebar, with the switcher next to it.
  it('does not repeat the branch name', () => {
    setup();
    render(<Footer />);
    expect(screen.queryByText('feature/login')).toBeNull();
  });

  it('opens the account screen when the identity is clicked', () => {
    const { openOverlayView } = setup();
    render(<Footer />);
    fireEvent.click(screen.getByText('Mykhailo'));
    expect(openOverlayView).toHaveBeenCalledWith('settings-account');
  });

  it('warns when git has no identity to commit with', () => {
    setup({ ...IDENTITY, name: null, email: null, origin: null, scope: 'none' });
    render(<Footer />);
    expect(screen.getByText('identity.missing')).toBeTruthy();
  });

  it('renders nothing about the identity until it is loaded', () => {
    setup(null);
    render(<Footer />);
    expect(screen.queryByText('identity.missing')).toBeNull();
    expect(screen.getByText('a1b2c3d')).toBeTruthy();
  });
});
