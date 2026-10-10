// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Footer } from '../../../src/components/layout/Footer';
import { useRepoStore } from '../../../src/stores/repo-store';
import { useUiStore } from '../../../src/stores/ui-store';
import { useAccountStore } from '../../../src/stores/account-store';
import type { AheadBehind, AuthSource, ProviderAccount, RemoteProtocol } from '../../../src/types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));
vi.mock('../../../src/stores/repo-store', () => ({ useRepoStore: vi.fn() }));
vi.mock('../../../src/stores/ui-store', () => ({
  useUiStore: vi.fn(),
  isOverlayView: (view: string) => view === 'settings' || view === 'about',
}));
vi.mock('../../../src/stores/account-store', () => ({ useAccountStore: vi.fn() }));

const ACCOUNT: ProviderAccount = {
  id: 'github.com',
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
  remoteProtocol = 'https' as RemoteProtocol | null,
  authSource = 'none' as AuthSource | null,
  aheadBehind = { ahead: 0, behind: 0, upstream: 'origin/feature/login' } as AheadBehind,
} = {}) {
  const openConnection = vi.fn();
  // Selector-aware: Footer and PanelButtons both select from the ui store.
  const repoState = {
    currentBranch: 'feature/login',
    remoteHost,
    remoteProtocol,
    repoPath: '/tmp/repo',
    // HEAD's own hash — deliberately not commits[0], which getLog sorts
    // across every branch and so can belong to somebody else's branch.
    headCommit: 'a1b2c3d',
    aheadBehind,
    fetch: vi.fn(),
    pull: vi.fn().mockResolvedValue('Updated'),
    push: vi.fn().mockResolvedValue(undefined),
    publishBranch: vi.fn(),
  };
  const uiState = {
    addToast: vi.fn(),
    openOverlayView: vi.fn(),
    openConnection,
    sidebarOpen: true,
    toggleSidebar: vi.fn(),
  };
  const accountState = { current: account, accountFor: () => account, authSource };
  vi.mocked(useRepoStore).mockImplementation(((sel: any) => sel(repoState)) as any);
  vi.mocked(useUiStore).mockImplementation(((sel: any) => sel(uiState)) as any);
  vi.mocked(useAccountStore).mockImplementation(((sel: any) => sel(accountState)) as any);
  return { openConnection, repoState };
}

describe('Footer', () => {
  it('puts the Git logo in the left corner to hide the sidebar', () => {
    setup();
    render(<Footer />);
    expect(screen.getByRole('button', { name: 'hideSidebar' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the account the repository authenticates as', () => {
    setup();
    render(<Footer />);
    expect(screen.getByText('@MykhailoBovtriuk')).toBeTruthy();
  });

  it('pushes from the ahead counter', async () => {
    const { repoState } = setup({ aheadBehind: { ahead: 2, behind: 0, upstream: 'origin/x' } });
    render(<Footer />);
    fireEvent.click(screen.getByText('↑2'));
    await waitFor(() => expect(repoState.push).toHaveBeenCalledTimes(1));
  });

  it('pulls from the behind counter', async () => {
    const { repoState } = setup({ aheadBehind: { ahead: 0, behind: 3, upstream: 'origin/x' } });
    render(<Footer />);
    fireEvent.click(screen.getByText('↓3'));
    await waitFor(() => expect(repoState.pull).toHaveBeenCalledTimes(1));
  });

  // The remote would reject the push until its commits are pulled in.
  it('holds the push back while the branch is also behind', () => {
    setup({ aheadBehind: { ahead: 2, behind: 3, upstream: 'origin/x' } });
    render(<Footer />);
    const up = screen.getByText('↑2');
    expect(up).toBeDisabled();
    expect(up).toHaveAttribute('title', 'pullFirst');
    expect(screen.getByText('↓3')).not.toBeDisabled();
  });

  it('shows how far the branch is from its upstream', () => {
    setup({ aheadBehind: { ahead: 2, behind: 3, upstream: 'origin/feature/login' } });
    render(<Footer />);
    expect(screen.getByText('↑2')).toBeTruthy();
    expect(screen.getByText('↓3')).toBeTruthy();
  });

  // The branch lives in the titlebar, with the switcher next to it.
  it('does not repeat the branch name', () => {
    setup();
    render(<Footer />);
    expect(screen.queryByText('feature/login')).toBeNull();
  });

  // Whatever authenticates the repository, the chip leads to the one dialog
  // where it can be changed.
  it('opens the repository connection when clicked', () => {
    const { openConnection } = setup();
    render(<Footer />);
    fireEvent.click(screen.getByText('@MykhailoBovtriuk'));
    expect(openConnection).toHaveBeenCalledOnce();
  });

  // A remote with nobody signed in is the state where the next push fails, so
  // the way out belongs here rather than only in the failure toast.
  it('offers sign-in when a remote has no account', () => {
    const { openConnection } = setup({ account: null });
    render(<Footer />);
    fireEvent.click(screen.getByText('signIn'));
    expect(openConnection).toHaveBeenCalledOnce();
  });

  it('opens the connection from the ssh label too', () => {
    const { openConnection } = setup({ account: null, remoteProtocol: 'ssh', authSource: 'ssh' });
    render(<Footer />);
    fireEvent.click(screen.getByText('account.viaSsh'));
    expect(openConnection).toHaveBeenCalledOnce();
  });

  it('says nothing about accounts for a repository with no remote', () => {
    setup({ account: null, remoteHost: null, remoteProtocol: null, authSource: null });
    render(<Footer />);
    expect(screen.queryByText('signIn')).toBeNull();
    expect(screen.getByText('a1b2c3d')).toBeTruthy();
  });

  // An ssh remote authenticates with a key: no sign-in offer, but no silence
  // either.
  it('names the ssh key instead of offering a sign-in', () => {
    setup({ account: null, remoteProtocol: 'ssh', authSource: 'ssh' });
    render(<Footer />);
    expect(screen.queryByText('signIn')).toBeNull();
    expect(screen.getByText('account.viaSsh')).toBeTruthy();
  });

  // The usual state on a machine somebody has worked on for years: git already
  // has the credential, so "Sign in" was an invitation to redo what was done.
  it('names the system credential store instead of offering a sign-in', () => {
    setup({ account: null, authSource: 'system' });
    render(<Footer />);
    expect(screen.queryByText('signIn')).toBeNull();
    expect(screen.getByText('account.viaSystem')).toBeTruthy();
  });

  // Flashing the offer and withdrawing it a moment later is worse than showing
  // it slightly late.
  it('says nothing while the answer is still in flight', () => {
    setup({ account: null, authSource: null });
    render(<Footer />);
    expect(screen.queryByText('signIn')).toBeNull();
    expect(screen.queryByText('account.viaSystem')).toBeNull();
    expect(screen.queryByText('account.viaSsh')).toBeNull();
  });

  // An account of our own wins: it has a name and a face, which beats naming
  // the mechanism.
  it('prefers the signed-in account over the mechanism', () => {
    setup({ authSource: 'account' });
    render(<Footer />);
    expect(screen.getByText('@MykhailoBovtriuk')).toBeTruthy();
    expect(screen.queryByText('account.viaSystem')).toBeNull();
  });
});
