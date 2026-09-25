import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ProviderAccount, ProviderOption } from '../../src/types';

const api = {
  list: vi.fn(),
  providersFor: vi.fn(),
  needsSignIn: vi.fn(),
  signIn: vi.fn(),
  signInWithToken: vi.fn(),
  cancelSignIn: vi.fn(),
  signOut: vi.fn(),
  onAccountChanged: vi.fn(),
};
vi.mock('../../src/api/account-api', () => ({ accountApi: api }));

const { useAccountStore } = await import('../../src/stores/account-store');

const ACCOUNT: ProviderAccount = {
  id: 'github.com',
  providerId: 'github',
  host: 'github.com',
  displayName: 'GitHub',
  login: 'octocat',
  name: 'The Octocat',
  email: 'octo@example.com',
  avatarDataUrl: null,
};

const GITHUB_OPTION: ProviderOption = {
  id: 'github',
  displayName: 'GitHub',
  configured: true,
  needsHost: false,
  needsClientId: false,
  tokenHelpUrl: null,
};

const OPTIONS: ProviderOption[] = [
  {
    id: 'gitlab-self',
    displayName: 'GitLab',
    configured: true,
    needsHost: true,
    needsClientId: true,
    tokenHelpUrl: null,
  },
  {
    id: 'token',
    displayName: 'Token',
    configured: true,
    needsHost: true,
    needsClientId: false,
    tokenHelpUrl: null,
  },
];

const reset = () =>
  useAccountStore.setState({
    accounts: [],
    current: null,
    persistent: true,
    loaded: false,
    phase: null,
    target: null,
    error: null,
    busy: false,
    dismissedRepos: new Set(),
  });

describe('account store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reset();
    api.list.mockResolvedValue({ accounts: [ACCOUNT], persistent: true, error: null });
    api.cancelSignIn.mockResolvedValue(null);
    api.signIn.mockResolvedValue(null);
    api.signOut.mockResolvedValue(null);
  });

  it('loads the accounts the main process holds', async () => {
    await useAccountStore.getState().loadAccounts();
    expect(useAccountStore.getState().accounts).toEqual([ACCOUNT]);
    expect(useAccountStore.getState().loaded).toBe(true);
    expect(useAccountStore.getState().accountFor('github.com')).toEqual(ACCOUNT);
    expect(useAccountStore.getState().accountFor('gitlab.com')).toBeNull();
  });

  it('has no account for a repository without a remote', async () => {
    await useAccountStore.getState().loadAccounts();
    expect(useAccountStore.getState().accountFor(null)).toBeNull();
  });

  // A host the registry recognises needs no question asked: picking "GitHub"
  // for github.com is not a decision worth a dialog step.
  it('goes straight to the browser step for a known host', async () => {
    api.providersFor.mockResolvedValue({
      host: 'github.com',
      providerId: 'github',
      options: [GITHUB_OPTION, ...OPTIONS],
    });
    await useAccountStore.getState().openSignIn('github.com');
    expect(useAccountStore.getState().phase).toBe('browser');
  });

  // Recognising a host is not the same as being able to sign in to it: a build
  // with no GitLab client id knows what gitlab.com is and cannot open a browser
  // flow for it. Sending the user there produced a dialog whose only button
  // failed with "No OAuth client id available".
  it('does not send the user to a browser flow this build cannot start', async () => {
    api.providersFor.mockResolvedValue({
      host: 'gitlab.com',
      providerId: 'gitlab',
      options: OPTIONS,
    });
    await useAccountStore.getState().openSignIn('gitlab.com');
    expect(useAccountStore.getState().phase).toBe('choose');
  });

  it('goes straight to the token form when that is all this build offers', async () => {
    api.providersFor.mockResolvedValue({
      host: 'gitlab.com',
      providerId: 'gitlab',
      options: [OPTIONS[1]],
    });
    await useAccountStore.getState().openSignIn('gitlab.com');
    expect(useAccountStore.getState().phase).toBe('token');
    expect(useAccountStore.getState().target?.providerId).toBe('token');
  });

  it('asks which server it is when nobody claims the host', async () => {
    api.providersFor.mockResolvedValue({
      host: 'git.acme.internal',
      providerId: null,
      options: OPTIONS,
    });
    await useAccountStore.getState().openSignIn('git.acme.internal');
    expect(useAccountStore.getState().phase).toBe('choose');
  });

  it('sends the token path to the form and the rest to the browser', async () => {
    api.providersFor.mockResolvedValue({ host: 'h', providerId: null, options: OPTIONS });
    await useAccountStore.getState().openSignIn('h');

    useAccountStore.getState().chooseProvider('token');
    expect(useAccountStore.getState().phase).toBe('token');

    useAccountStore.getState().chooseProvider('gitlab-self');
    expect(useAccountStore.getState().phase).toBe('browser');
  });

  // The browser owns the next step; the answer arrives over 'account:changed'.
  it('waits after handing off to the browser', async () => {
    api.providersFor.mockResolvedValue({
      host: 'github.com',
      providerId: 'github',
      options: [GITHUB_OPTION, ...OPTIONS],
    });
    await useAccountStore.getState().openSignIn('github.com');
    await useAccountStore.getState().continueWithBrowser();

    expect(api.signIn).toHaveBeenCalledWith('github', 'github.com', undefined, undefined);
    expect(useAccountStore.getState().phase).toBe('waiting');
  });

  it('closes the dialog when the awaited account turns up', async () => {
    useAccountStore.setState({
      phase: 'waiting',
      target: { host: 'github.com', providerId: 'github', options: OPTIONS, repoPath: null },
    });
    await useAccountStore.getState().loadAccounts();
    expect(useAccountStore.getState().phase).toBeNull();
    expect(useAccountStore.getState().target).toBeNull();
  });

  // The browser round trip has no IPC call left to throw from, so a failure
  // rides back with the next account list.
  it('surfaces a failure reported alongside the account list', async () => {
    api.list.mockResolvedValue({
      accounts: [],
      persistent: true,
      error: 'Sign-in state did not match',
    });
    await useAccountStore.getState().loadAccounts();
    expect(useAccountStore.getState().phase).toBe('error');
    expect(useAccountStore.getState().error).toBe('Sign-in state did not match');
  });

  it('signs in with a pasted token and refreshes the list', async () => {
    api.providersFor.mockResolvedValue({ host: 'h', providerId: null, options: OPTIONS });
    api.signInWithToken.mockResolvedValue(ACCOUNT);
    await useAccountStore.getState().openSignIn('h');
    await useAccountStore.getState().submitToken('me', 'secret');

    expect(api.signInWithToken).toHaveBeenCalledWith('h', 'me', 'secret', null);
    expect(useAccountStore.getState().phase).toBeNull();
    expect(useAccountStore.getState().accounts).toEqual([ACCOUNT]);
  });

  it('reports a rejected token without closing the form', async () => {
    api.providersFor.mockResolvedValue({ host: 'h', providerId: null, options: OPTIONS });
    api.signInWithToken.mockRejectedValue(new Error('401 Unauthorized'));
    await useAccountStore.getState().openSignIn('h');
    await useAccountStore.getState().submitToken('me', 'bad');

    expect(useAccountStore.getState().phase).toBe('error');
    expect(useAccountStore.getState().error).toBe('401 Unauthorized');
  });

  it('cancels the pending flow in the main process too', async () => {
    api.providersFor.mockResolvedValue({ host: 'h', providerId: null, options: OPTIONS });
    await useAccountStore.getState().openSignIn('h');
    await useAccountStore.getState().cancelSignIn();

    expect(api.cancelSignIn).toHaveBeenCalled();
    expect(useAccountStore.getState().phase).toBeNull();
  });

  // "Not now" is an answer about this session, so it lives in memory and dies
  // with the process rather than becoming a setting nobody can find again.
  it('remembers which repositories were dismissed', () => {
    useAccountStore.getState().dismissForRepo('/tmp/repo');
    expect(useAccountStore.getState().dismissedRepos.has('/tmp/repo')).toBe(true);
    expect(useAccountStore.getState().dismissedRepos.has('/tmp/other')).toBe(false);
  });

  describe('the account shown for the open repository', () => {
    // Signing in finishes in the main process and arrives over
    // account:changed. Reloading only the account list left the footer — which
    // names the account for this host — still saying nobody was signed in.
    it('points at whoever is signed in to the host', async () => {
      await useAccountStore.getState().loadAccounts();
      expect(useAccountStore.getState().current).toBeNull();

      useAccountStore.getState().refreshCurrent('github.com');
      expect(useAccountStore.getState().current).toEqual(ACCOUNT);
    });

    it('clears when the repository has no remote, or one nobody signed in to', async () => {
      await useAccountStore.getState().loadAccounts();
      useAccountStore.getState().refreshCurrent('github.com');

      useAccountStore.getState().refreshCurrent('gitlab.example.com');
      expect(useAccountStore.getState().current).toBeNull();

      useAccountStore.getState().refreshCurrent('github.com');
      useAccountStore.getState().refreshCurrent(null);
      expect(useAccountStore.getState().current).toBeNull();
    });

    // It runs on every account change, including ones the user did not start
    // from this repository.
    it('never opens a dialog on its own', async () => {
      await useAccountStore.getState().loadAccounts();
      useAccountStore.getState().refreshCurrent('github.com');
      expect(useAccountStore.getState().phase).toBeNull();
    });

    it('carries the repository into a sign-in started from it', async () => {
      api.providersFor.mockResolvedValue({
        host: 'github.com',
        providerId: 'github',
        options: [GITHUB_OPTION, ...OPTIONS],
      });
      api.signInWithToken.mockResolvedValue(ACCOUNT);
      await useAccountStore.getState().openSignIn('github.com', '/src/p');

      expect(useAccountStore.getState().target?.repoPath).toBe('/src/p');

      // The repository is how the main process finds a remote to check the
      // token against, so it has to survive the round trip to the form.
      useAccountStore.getState().chooseProvider('token');
      await useAccountStore.getState().submitToken('me', 'secret');
      expect(api.signInWithToken).toHaveBeenCalledWith('github.com', 'me', 'secret', '/src/p');
    });
  });

  it('reloads after signing out', async () => {
    api.list.mockResolvedValue({ accounts: [], persistent: true, error: null });
    await useAccountStore.getState().signOut('github.com');
    expect(api.signOut).toHaveBeenCalledWith('github.com');
    expect(useAccountStore.getState().accounts).toEqual([]);
  });
});
