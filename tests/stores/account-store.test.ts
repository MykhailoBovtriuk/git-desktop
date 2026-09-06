import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ProviderAccount, ProviderOption } from '../../src/types';

const api = {
  list: vi.fn(),
  providersFor: vi.fn(),
  forRepo: vi.fn(),
  bind: vi.fn(),
  unbind: vi.fn(),
  signIn: vi.fn(),
  signInWithToken: vi.fn(),
  cancelSignIn: vi.fn(),
  signOut: vi.fn(),
  onAccountChanged: vi.fn(),
};
vi.mock('../../src/api/account-api', () => ({ accountApi: api }));

const { useAccountStore } = await import('../../src/stores/account-store');

const ACCOUNT: ProviderAccount = {
  id: 'github.com|octocat',
  providerId: 'github',
  host: 'github.com',
  displayName: 'GitHub',
  login: 'octocat',
  name: 'The Octocat',
  email: 'octo@example.com',
  avatarDataUrl: null,
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
      options: OPTIONS,
    });
    await useAccountStore.getState().openSignIn('github.com');
    expect(useAccountStore.getState().phase).toBe('browser');
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
      options: OPTIONS,
    });
    await useAccountStore.getState().openSignIn('github.com');
    await useAccountStore.getState().continueWithBrowser();

    expect(api.signIn).toHaveBeenCalledWith('github', 'github.com', undefined, undefined, null);
    expect(useAccountStore.getState().phase).toBe('waiting');
  });

  it('closes the dialog when the awaited account turns up', async () => {
    useAccountStore.setState({
      phase: 'waiting',
      target: {
        host: 'github.com',
        providerId: 'github',
        options: OPTIONS,
        repoPath: null,
        candidates: [],
      },
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

  describe('deciding what to ask about a freshly opened repository', () => {
    beforeEach(() => {
      api.forRepo.mockReset();
      api.bind.mockResolvedValue(null);
      api.providersFor.mockResolvedValue({
        host: 'github.com',
        providerId: 'github',
        options: OPTIONS,
      });
    });

    // The user already answered for this repo. Asking again would be nagging.
    it('asks nothing when the repository is already bound', async () => {
      api.forRepo.mockResolvedValue({ bound: ACCOUNT, candidates: [ACCOUNT] });
      await useAccountStore.getState().resolveForRepo('/src/p', 'github.com');

      expect(useAccountStore.getState().phase).toBeNull();
      expect(useAccountStore.getState().current).toEqual(ACCOUNT);
    });

    it('offers a sign-in when nothing is signed in to that host', async () => {
      api.forRepo.mockResolvedValue({ bound: null, candidates: [] });
      await useAccountStore.getState().resolveForRepo('/src/p', 'github.com');

      expect(useAccountStore.getState().phase).toBe('browser');
      expect(useAccountStore.getState().target?.repoPath).toBe('/src/p');
    });

    // Regression: signing in finishes in the main process and arrives over
    // account:changed. Reloading only the account list left the footer — which
    // shows the repository's own account — still saying nobody was signed in.
    it('picks up an account bound while the repository was already open', async () => {
      api.forRepo.mockResolvedValue({ bound: ACCOUNT, candidates: [ACCOUNT] });
      expect(useAccountStore.getState().current).toBeNull();

      const candidates = await useAccountStore.getState().refreshCurrent('/src/p', 'github.com');

      expect(useAccountStore.getState().current).toEqual(ACCOUNT);
      expect(candidates).toEqual([]);
    });

    // It must never interrupt: this runs on every account change, including
    // ones the user did not start from this repository.
    it('never opens a dialog while refreshing', async () => {
      const work = { ...ACCOUNT, id: 'github.com|work', login: 'work' };
      api.forRepo.mockResolvedValue({ bound: null, candidates: [ACCOUNT, work] });

      const candidates = await useAccountStore.getState().refreshCurrent('/src/p', 'github.com');

      expect(useAccountStore.getState().phase).toBeNull();
      expect(candidates).toHaveLength(2);
    });

    // One possible answer is not a question worth a dialog.
    it('binds the only account on the host without asking', async () => {
      api.forRepo.mockResolvedValue({ bound: null, candidates: [ACCOUNT] });
      await useAccountStore.getState().resolveForRepo('/src/p', 'github.com');

      expect(api.bind).toHaveBeenCalledWith('/src/p', ACCOUNT.id);
      expect(useAccountStore.getState().phase).toBeNull();
      expect(useAccountStore.getState().current).toEqual(ACCOUNT);
    });

    // Two accounts on one host is exactly the case that used to be guessed
    // wrong, attributing work to whichever signed in last.
    it('asks which account when the host already has some', async () => {
      const work = { ...ACCOUNT, id: 'github.com|work', login: 'work' };
      api.forRepo.mockResolvedValue({ bound: null, candidates: [ACCOUNT, work] });
      await useAccountStore.getState().resolveForRepo('/src/p', 'github.com');

      expect(useAccountStore.getState().phase).toBe('pick-account');
      expect(useAccountStore.getState().target?.candidates).toHaveLength(2);
    });

    it('remembers the account the user picks for that repository', async () => {
      const work = { ...ACCOUNT, id: 'github.com|work', login: 'work' };
      useAccountStore.setState({ accounts: [ACCOUNT, work] });
      api.forRepo.mockResolvedValue({ bound: null, candidates: [ACCOUNT, work] });
      await useAccountStore.getState().resolveForRepo('/src/p', 'github.com');
      await useAccountStore.getState().chooseAccount('github.com|work');

      expect(api.bind).toHaveBeenCalledWith('/src/p', 'github.com|work');
      expect(useAccountStore.getState().phase).toBeNull();
      expect(useAccountStore.getState().current?.login).toBe('work');
    });

    it('lets the user reopen a binding that was made silently', async () => {
      const work = { ...ACCOUNT, id: 'github.com|work', login: 'work' };
      api.forRepo.mockResolvedValue({ bound: ACCOUNT, candidates: [ACCOUNT, work] });
      await useAccountStore.getState().changeAccountForRepo('/src/p', 'github.com');

      expect(useAccountStore.getState().phase).toBe('pick-account');
      expect(useAccountStore.getState().target?.candidates).toHaveLength(2);
      expect(useAccountStore.getState().target?.repoPath).toBe('/src/p');
    });

    it('carries the repository into the sign-in so the result binds to it', async () => {
      api.forRepo.mockResolvedValue({ bound: null, candidates: [] });
      await useAccountStore.getState().resolveForRepo('/src/p', 'github.com');
      await useAccountStore.getState().continueWithBrowser();

      expect(api.signIn).toHaveBeenCalledWith(
        'github',
        'github.com',
        undefined,
        undefined,
        '/src/p',
      );
    });
  });

  // Adding a repository back should behave like the first time, not silently
  // reuse an answer given before it was removed.
  it('forgets everything remembered about a removed repository', async () => {
    api.unbind.mockResolvedValue(null);
    useAccountStore.getState().dismissForRepo('/src/p');
    useAccountStore.setState({ current: ACCOUNT });

    await useAccountStore.getState().forgetRepo('/src/p');

    expect(api.unbind).toHaveBeenCalledWith('/src/p');
    expect(useAccountStore.getState().dismissedRepos.has('/src/p')).toBe(false);
    expect(useAccountStore.getState().current).toBeNull();
  });

  it('reloads after signing out', async () => {
    api.list.mockResolvedValue({ accounts: [], persistent: true, error: null });
    await useAccountStore.getState().signOut('github.com|octocat');
    expect(api.signOut).toHaveBeenCalledWith('github.com|octocat');
    expect(useAccountStore.getState().accounts).toEqual([]);
  });
});
