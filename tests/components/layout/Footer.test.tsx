// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Footer } from '../../../src/components/layout/Footer';
import { useRepoStore } from '../../../src/stores/repo-store';
import { useUiStore } from '../../../src/stores/ui-store';
import { useAccountStore } from '../../../src/stores/account-store';
import type { ProviderAccount } from '../../../src/types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));
vi.mock('../../../src/stores/repo-store', () => ({ useRepoStore: vi.fn() }));
vi.mock('../../../src/stores/ui-store', () => ({ useUiStore: vi.fn() }));
vi.mock('../../../src/stores/account-store', () => ({ useAccountStore: vi.fn() }));

const ACCOUNT: ProviderAccount = {
  id: 'github.com|octocat',
  providerId: 'github',
  host: 'github.com',
  displayName: 'GitHub',
  login: 'MykhailoBovtriuk',
  name: 'Mykhailo Bovtriuk',
  email: 'mykhailo@example.com',
  avatarDataUrl: null,
};

function setup({
  account = ACCOUNT as ProviderAccount | null,
  remoteHost = 'github.com' as string | null,
} = {}) {
  const openOverlayView = vi.fn();
  const openSignIn = vi.fn();
  // Selector-aware: Footer and AppMenuButtons both select from the ui store.
  const repoState = {
    currentBranch: 'feature/login',
    remoteHost,
    repoPath: '/tmp/repo',
    // HEAD's own hash — deliberately not commits[0], which getLog sorts
    // across every branch and so can belong to somebody else's branch.
    headCommit: 'a1b2c3d',
    aheadBehind: { ahead: 0, behind: 0 },
    fetch: vi.fn(),
    pull: vi.fn(),
    push: vi.fn(),
    publishBranch: vi.fn(),
  };
  const uiState = { addToast: vi.fn(), openOverlayView };
  const changeAccountForRepo = vi.fn();
  const accountState = {
    current: account,
    accountFor: () => account,
    openSignIn,
    changeAccountForRepo,
  };
  vi.mocked(useRepoStore).mockImplementation(((sel: any) => sel(repoState)) as any);
  vi.mocked(useUiStore).mockImplementation(((sel: any) => sel(uiState)) as any);
  vi.mocked(useAccountStore).mockImplementation(((sel: any) => sel(accountState)) as any);
  return { openOverlayView, openSignIn, changeAccountForRepo };
}

describe('Footer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the account the repository authenticates as', () => {
    setup();
    render(<Footer />);
    expect(screen.getByText('@MykhailoBovtriuk')).toBeTruthy();
  });

  // The branch lives in the titlebar, with the switcher next to it.
  it('does not repeat the branch name', () => {
    setup();
    render(<Footer />);
    expect(screen.queryByText('feature/login')).toBeNull();
  });

  // A binding made silently — the usual case, with one account — has to stay
  // changeable, or it is wrong forever once a second account turns up.
  it('reopens the account choice for this repository when clicked', () => {
    const { changeAccountForRepo } = setup();
    render(<Footer />);
    fireEvent.click(screen.getByText('@MykhailoBovtriuk'));
    expect(changeAccountForRepo).toHaveBeenCalledWith('/tmp/repo', 'github.com');
  });

  // A remote with nobody signed in is the state where the next push fails, so
  // the way out belongs here rather than only in the failure toast.
  it('offers sign-in when a remote has no account', () => {
    const { openSignIn } = setup({ account: null });
    render(<Footer />);
    fireEvent.click(screen.getByText('signIn'));
    expect(openSignIn).toHaveBeenCalledWith('github.com');
  });

  it('says nothing about accounts for a repository with no remote', () => {
    setup({ account: null, remoteHost: null });
    render(<Footer />);
    expect(screen.queryByText('signIn')).toBeNull();
    expect(screen.getByText('a1b2c3d')).toBeTruthy();
  });
});
