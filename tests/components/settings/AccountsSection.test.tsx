// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AccountsSection } from '../../../src/components/settings/AccountsSection';
import { useAccountStore } from '../../../src/stores/account-store';
import { useRepoStore } from '../../../src/stores/repo-store';
import { useUiStore } from '../../../src/stores/ui-store';
import type { ProviderAccount } from '../../../src/types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));
vi.mock('../../../src/stores/account-store', () => ({ useAccountStore: vi.fn() }));
vi.mock('../../../src/stores/repo-store', () => ({ useRepoStore: vi.fn() }));

const account = (host: string, login: string): ProviderAccount => ({
  id: `${host}|${login}`,
  providerId: 'github',
  host,
  displayName: 'GitHub',
  login,
  name: null,
  email: '',
  avatarDataUrl: null,
});

function setup({
  accounts = [] as ProviderAccount[],
  persistent = true,
  remoteHost = null as string | null,
} = {}) {
  const openSignIn = vi.fn();
  const signOut = vi.fn().mockResolvedValue(undefined);
  const state = { accounts, persistent, openSignIn, signOut };
  vi.mocked(useAccountStore).mockImplementation(((sel: any) => sel(state)) as any);
  vi.mocked(useRepoStore).mockImplementation(((sel: any) => sel({ remoteHost })) as any);
  return { openSignIn, signOut };
}

describe('AccountsSection', () => {
  beforeEach(() => vi.clearAllMocks());

  // Being signed in to several servers at once is the normal case, and signing
  // out of one must visibly not touch the others.
  it('lists every signed-in server separately', () => {
    const { signOut } = setup({
      accounts: [account('github.com', 'octocat'), account('gitlab.acme.internal', 'jane')],
    });
    render(<AccountsSection />);

    expect(screen.getByText('@octocat · github.com')).toBeTruthy();
    expect(screen.getByText('@jane · gitlab.acme.internal')).toBeTruthy();

    fireEvent.click(screen.getAllByText('section.signOut')[0]);
    expect(signOut).toHaveBeenCalledWith('github.com|octocat');
  });

  it('says so when nothing is signed in', () => {
    setup();
    render(<AccountsSection />);
    expect(screen.getByText('section.empty')).toBeTruthy();
  });

  // The open repository's server is almost certainly the one meant, so asking
  // the user to retype it would be busywork.
  it('adds the open repository server without asking for an address', () => {
    const { openSignIn } = setup({ remoteHost: 'gitlab.acme.internal' });
    render(<AccountsSection />);

    fireEvent.click(screen.getByText('section.add'));
    expect(openSignIn).toHaveBeenCalledWith('gitlab.acme.internal');
  });

  it('asks for an address when the open repository is already covered', () => {
    const { openSignIn } = setup({
      accounts: [account('github.com', 'octocat')],
      remoteHost: 'github.com',
    });
    render(<AccountsSection />);

    fireEvent.click(screen.getByText('section.add'));
    expect(openSignIn).not.toHaveBeenCalled();

    fireEvent.change(screen.getByPlaceholderText('section.hostPlaceholder'), {
      target: { value: 'gitlab.com' },
    });
    fireEvent.click(screen.getByText('section.add'));
    expect(openSignIn).toHaveBeenCalledWith('gitlab.com');
  });

  // Better to say the session is all there is than to let the user discover it
  // at the next launch.
  it('warns when tokens cannot survive a restart', () => {
    setup({ persistent: false });
    render(<AccountsSection />);
    expect(screen.getByText('section.notPersistent')).toBeTruthy();
  });

  it('stays quiet about persistence when the keychain works', () => {
    setup();
    render(<AccountsSection />);
    expect(screen.queryByText('section.notPersistent')).toBeNull();
  });

  // How the open repository authenticates lives in its connection dialog;
  // this screen is about the app's accounts only.
  it('says nothing about the open repository connection', () => {
    setup({ remoteHost: 'github.com' });
    render(<AccountsSection />);

    expect(screen.queryByText('github.com')).toBeNull();
    expect(screen.queryByRole('radiogroup')).toBeNull();
  });

  it('opens the open repository connection dialog from here too', () => {
    useUiStore.setState({ connectionOpen: false });
    setup({ remoteHost: 'github.com' });
    render(<AccountsSection />);

    fireEvent.click(screen.getByText('section.connection'));
    expect(useUiStore.getState().connectionOpen).toBe(true);
  });

  it('has no connection to show without an open remote', () => {
    setup();
    render(<AccountsSection />);
    expect(screen.queryByText('section.connection')).toBeNull();
  });
});
