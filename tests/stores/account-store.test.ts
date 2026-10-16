import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ProviderAccount, ProviderOption } from '../../src/types';

const api = {
  list: vi.fn(),
  providersFor: vi.fn(),
  needsSignIn: vi.fn(),
  signIn: vi.fn(),
  signInWithToken: vi.fn(),
  probeServer: vi.fn(),
  cancelSignIn: vi.fn(),
  signOut: vi.fn(),
  onAccountChanged: vi.fn(),
};
vi.mock('../../src/api/account-api', () => ({ accountApi: api }));

const { useAccountStore } = await import('../../src/stores/account-store');

const REPO = '/src/p';

const ACCOUNT: ProviderAccount = {
  id: REPO,
  repoPath: REPO,
  providerId: 'github',
  host: 'github.com',
  displayName: 'GitHub',
  login: 'octocat',
  name: 'The Octocat',
  email: 'octo@example.com',
  avatarDataUrl: null,
};

const option = (o: Partial<ProviderOption> & Pick<ProviderOption, 'id'>): ProviderOption => ({
  displayName: o.id,
  group: 'other',
  defaultHost: null,
  configured: false,
  needsHost: true,
  needsClientId: true,
  needsClientSecret: false,
  tokenHelpUrl: null,
  ...o,
});

const GITHUB_OPTION = option({
  id: 'github',
  group: 'github',
  defaultHost: 'github.com',
  configured: true,
  needsHost: false,
  needsClientId: false,
});
const GITLAB_OPTION = option({
  id: 'gitlab',
  group: 'gitlab',
  defaultHost: 'gitlab.com',
  needsHost: false,
});
const ENTERPRISE_OPTION = option({ id: 'github-enterprise', group: 'github-enterprise' });
const OPTIONS: ProviderOption[] = [
  GITHUB_OPTION,
  GITLAB_OPTION,
  ENTERPRISE_OPTION,
  option({ id: 'gitlab-self', group: 'gitlab-self' }),
  option({ id: 'token', needsClientId: false }),
];

const answers = (providerId: string | null, host: string | null = null) => ({
  host,
  providerId,
  options: OPTIONS,
});

const reset = () =>
  useAccountStore.setState({
    accounts: [],
    current: null,
    persistent: true,
    loaded: false,
    phase: null,
    target: null,
    error: null,
    endpointError: null,
    busy: false,
    dismissedRepos: new Set(),
  });

describe('account store', () => {
  const store = () => useAccountStore.getState();

  beforeEach(() => {
    vi.clearAllMocks();
    reset();
    api.list.mockResolvedValue({ accounts: [ACCOUNT], persistent: true, error: null });
    api.cancelSignIn.mockResolvedValue(null);
    api.signIn.mockResolvedValue(null);
    api.signOut.mockResolvedValue(null);
    api.probeServer.mockResolvedValue('ok');
    api.providersFor.mockImplementation(async (host: string | null) =>
      answers(host === 'github.com' ? 'github' : host === 'gitlab.com' ? 'gitlab' : null, host),
    );
  });

  it('loads the accounts the main process holds', async () => {
    await store().loadAccounts();
    expect(store().accounts).toEqual([ACCOUNT]);
    expect(store().loaded).toBe(true);
    expect(store().accountFor(REPO)).toEqual(ACCOUNT);
    expect(store().accountFor('/src/other')).toBeNull();
  });

  it('has no account for a repository without a remote', async () => {
    await store().loadAccounts();
    expect(store().accountFor(null)).toBeNull();
  });

  describe('from a repository', () => {
    it('goes straight to the browser step for a known host', async () => {
      await store().openSignIn('github.com', REPO);
      expect(store().phase).toBe('browser');
      expect(store().target?.providerId).toBe('github');
    });

    it('still opens the browser step for a known host this build has no keys for', async () => {
      await store().openSignIn('gitlab.com', REPO);
      expect(store().phase).toBe('browser');
      expect(store().target?.providerId).toBe('gitlab');
    });

    it('asks which server it is when nobody claims the host', async () => {
      await store().openSignIn('git.acme.internal', REPO);
      expect(store().phase).toBe('choose');
      expect(store().target?.host).toBe('git.acme.internal');
    });

    it('checks the chosen service is really there before going on', async () => {
      await store().openSignIn('git.acme.internal', REPO);
      await store().chooseProvider('gitlab-self');

      expect(api.probeServer).toHaveBeenCalledWith('gitlab-self', 'git.acme.internal');
      expect(store().phase).toBe('browser');
      expect(store().target?.providerId).toBe('gitlab-self');
    });

    it('stays on the choice when the server is something else', async () => {
      api.probeServer.mockResolvedValue('mismatch');
      await store().openSignIn('git.acme.internal', REPO);
      await store().chooseProvider('github-enterprise');

      expect(store().phase).toBe('choose');
      expect(store().endpointError).toBe('mismatch');
    });

    it('has nothing to probe for a bare Git server', async () => {
      await store().openSignIn('git.acme.internal', REPO);
      await store().chooseProvider('token');
      expect(api.probeServer).not.toHaveBeenCalled();
      expect(store().phase).toBe('token');
    });

    it('carries the repository into a sign-in started from it', async () => {
      api.signInWithToken.mockResolvedValue(ACCOUNT);
      await store().openSignIn('git.acme.internal', '/src/p');
      expect(store().target?.repoPath).toBe('/src/p');

      await store().chooseProvider('token');
      await store().submitToken('me', 'secret');
      expect(api.signInWithToken).toHaveBeenCalledWith(
        'token',
        'git.acme.internal',
        'me',
        'secret',
        '/src/p',
      );
    });
  });

  describe('from Settings', () => {
    it('signs in to a hosted service at its own address', async () => {
      await store().beginSignIn('github', REPO);
      expect(store().phase).toBe('browser');
      expect(store().target?.host).toBe('github.com');
    });

    it('asks a self-hosted service for its address first', async () => {
      await store().beginSignIn('github-enterprise', REPO);
      expect(store().phase).toBe('endpoint');
      expect(store().target?.host).toBe('');
    });

    it('goes on to the browser once the address checks out', async () => {
      await store().beginSignIn('github-enterprise', REPO);
      await store().submitEndpoint('https://GHE.acme.com/some/repo');

      expect(api.probeServer).toHaveBeenCalledWith('github-enterprise', 'ghe.acme.com');
      expect(store().phase).toBe('browser');
      expect(store().target).toMatchObject({
        host: 'ghe.acme.com',
        providerId: 'github-enterprise',
      });
    });

    it.each([
      ['not a url at all', 'invalid'],
      ['http://ghe.acme.com', 'insecure'],
    ])('refuses %s', async (address, error) => {
      await store().beginSignIn('github-enterprise', REPO);
      await store().submitEndpoint(address);
      expect(store().phase).toBe('endpoint');
      expect(store().endpointError).toBe(error);
      expect(api.probeServer).not.toHaveBeenCalled();
    });

    it('says so when nothing answers at the address', async () => {
      api.probeServer.mockResolvedValue('unreachable');
      await store().beginSignIn('gitlab-self', REPO);
      await store().submitEndpoint('gitlab.acme.com');
      expect(store().phase).toBe('endpoint');
      expect(store().endpointError).toBe('unreachable');
    });

    it('treats github.com in the Enterprise step as GitHub', async () => {
      await store().beginSignIn('github-enterprise', REPO);
      await store().submitEndpoint('github.com');
      expect(store().target).toMatchObject({ host: 'github.com', providerId: 'github' });
      expect(store().phase).toBe('browser');
    });
  });

  it('signs in afresh where another repository already has an account', async () => {
    useAccountStore.setState({
      accounts: [{ ...ACCOUNT, id: '/src/other', repoPath: '/src/other' }],
    });
    await store().openSignIn('github.com', REPO);
    expect(store().phase).toBe('browser');
    expect(store().target?.existing).toBeNull();
  });

  describe('a repository that already has an account', () => {
    beforeEach(() => useAccountStore.setState({ accounts: [ACCOUNT] }));

    it('warns before replacing it', async () => {
      await store().beginSignIn('github', REPO);
      expect(store().phase).toBe('existing');
      expect(store().target?.existing).toEqual(ACCOUNT);
    });

    it('goes on to sign in again once confirmed', async () => {
      await store().openSignIn('github.com', REPO);
      store().confirmReplace();
      expect(store().phase).toBe('browser');
    });
  });

  it('takes a token for a service without OAuth', async () => {
    api.providersFor.mockResolvedValue({
      host: 'devops.acme.com',
      providerId: 'azure-devops-server',
      options: [...OPTIONS, option({ id: 'azure-devops-server', needsClientId: false })],
    });
    await store().openSignIn('devops.acme.com', REPO);
    expect(store().phase).toBe('token');
  });

  it('switches between the browser and a token', async () => {
    await store().beginSignIn('github', REPO);
    store().switchMethod('token');
    expect(store().phase).toBe('token');
    store().switchMethod('browser');
    expect(store().phase).toBe('browser');
  });

  it('waits after handing off to the browser', async () => {
    await store().openSignIn('github.com', REPO);
    await store().continueWithBrowser();

    expect(api.signIn).toHaveBeenCalledWith('github', 'github.com', REPO, undefined, undefined);
    expect(store().phase).toBe('waiting');
  });

  it('closes the dialog when the awaited account turns up', async () => {
    useAccountStore.setState({
      phase: 'waiting',
      target: {
        host: 'github.com',
        providerId: 'github',
        options: OPTIONS,
        repoPath: REPO,
        existing: null,
      },
    });
    await store().loadAccounts();
    expect(store().phase).toBeNull();
    expect(store().target).toBeNull();
  });

  it('surfaces a failure reported alongside the account list', async () => {
    api.list.mockResolvedValue({
      accounts: [],
      persistent: true,
      error: 'Sign-in state did not match',
    });
    await store().loadAccounts();
    expect(store().phase).toBe('error');
    expect(store().error).toBe('Sign-in state did not match');
  });

  it('signs in with a pasted token for the chosen service and refreshes the list', async () => {
    api.signInWithToken.mockResolvedValue(ACCOUNT);
    await store().openSignIn('gitlab.com', REPO);
    await store().submitToken('', 'secret');

    expect(api.signInWithToken).toHaveBeenCalledWith('gitlab', 'gitlab.com', '', 'secret', REPO);
    expect(store().phase).toBeNull();
    expect(store().accounts).toEqual([ACCOUNT]);
  });

  it('reports a rejected token without closing the form', async () => {
    api.signInWithToken.mockRejectedValue(new Error('401 Unauthorized'));
    await store().openSignIn('gitlab.com', REPO);
    store().switchMethod('token');
    await store().submitToken('', 'bad');

    expect(store().phase).toBe('token');
    expect(store().error).toBe('401 Unauthorized');
  });

  it('cancels the pending flow in the main process too', async () => {
    await store().openSignIn('h.example', REPO);
    await store().cancelSignIn();

    expect(api.cancelSignIn).toHaveBeenCalled();
    expect(store().phase).toBeNull();
  });

  it('remembers which repositories were dismissed', () => {
    store().dismissForRepo('/tmp/repo');
    expect(store().dismissedRepos.has('/tmp/repo')).toBe(true);
    expect(store().dismissedRepos.has('/tmp/other')).toBe(false);
  });

  describe('the account shown for the open repository', () => {
    it('points at whoever is signed in to the host', async () => {
      await store().loadAccounts();
      expect(store().current).toBeNull();

      store().refreshCurrent(REPO);
      expect(store().current).toEqual(ACCOUNT);
    });

    it('clears when the repository has no remote, or one nobody signed in to', async () => {
      await store().loadAccounts();
      store().refreshCurrent(REPO);

      store().refreshCurrent('/src/other');
      expect(store().current).toBeNull();

      store().refreshCurrent(REPO);
      store().refreshCurrent(null);
      expect(store().current).toBeNull();
    });

    it('never opens a dialog on its own', async () => {
      await store().loadAccounts();
      store().refreshCurrent(REPO);
      expect(store().phase).toBeNull();
    });
  });

  it('reloads after signing out', async () => {
    api.list.mockResolvedValue({ accounts: [], persistent: true, error: null });
    await store().signOut(REPO);
    expect(api.signOut).toHaveBeenCalledWith(REPO);
    expect(store().accounts).toEqual([]);
  });
});
