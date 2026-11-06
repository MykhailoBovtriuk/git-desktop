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
  authSource: vi.fn(),
  identity: vi.fn(),
  test: vi.fn(),
  onAccountChanged: vi.fn(),
};
vi.mock('../../src/api/account-api', () => ({ accountApi: api }));

const { useAccountStore } = await import('../../src/stores/account-store');
const { testKey } = await import('../../src/lib/test-key');

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
  option({ id: 'azure-devops-server', needsClientId: false }),
];

const answers = (providerId: string | null, host: string | null = null) => ({
  host,
  providerId,
  options: OPTIONS,
});

const reset = () =>
  useAccountStore.setState({
    accounts: [],
    persistent: true,
    loaded: false,
    phase: null,
    target: null,
    error: null,
    endpointError: null,
    busy: false,
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

      expect(api.probeServer).toHaveBeenCalledWith('gitlab-self', 'git.acme.internal', REPO);
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

    it('carries the repository into a sign-in started from it', async () => {
      api.signInWithToken.mockResolvedValue(ACCOUNT);
      await store().openSignIn('git.acme.internal', '/src/p');
      expect(store().target?.repoPath).toBe('/src/p');

      await store().chooseProvider('azure-devops-server');
      await store().submitToken('secret');
      expect(api.signInWithToken).toHaveBeenCalledWith(
        'azure-devops-server',
        'git.acme.internal',
        'secret',
        '/src/p',
      );
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
      await store().openSignIn('github.com', REPO);
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
    await store().openSignIn('github.com', REPO);
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
    await store().submitToken('secret');

    expect(api.signInWithToken).toHaveBeenCalledWith('gitlab', 'gitlab.com', 'secret', REPO);
    expect(store().phase).toBeNull();
    expect(store().accounts).toEqual([ACCOUNT]);
  });

  it('reports a rejected token without closing the form', async () => {
    api.signInWithToken.mockRejectedValue(new Error('401 Unauthorized'));
    await store().openSignIn('gitlab.com', REPO);
    store().switchMethod('token');
    await store().submitToken('bad');

    expect(store().phase).toBe('token');
    expect(store().error).toBe('401 Unauthorized');
  });

  it('cancels the pending flow in the main process too', async () => {
    await store().openSignIn('h.example', REPO);
    await store().cancelSignIn();

    expect(api.cancelSignIn).toHaveBeenCalled();
    expect(store().phase).toBeNull();
  });

  describe('the account shown for the open repository', () => {
    it('points at whoever is signed in to the repository', async () => {
      expect(store().accountFor(REPO)).toBeNull();
      await store().loadAccounts();
      expect(store().accountFor(REPO)).toEqual(ACCOUNT);
    });

    it('is empty for another repository or none', async () => {
      await store().loadAccounts();
      expect(store().accountFor('/src/other')).toBeNull();
      expect(store().accountFor(null)).toBeNull();
    });

    it('never opens a dialog on its own', async () => {
      await store().loadAccounts();
      store().accountFor(REPO);
      expect(store().phase).toBeNull();
    });
  });

  it('reloads after signing out', async () => {
    api.list.mockResolvedValue({ accounts: [], persistent: true, error: null });
    await store().signOut(REPO);
    expect(api.signOut).toHaveBeenCalledWith(REPO);
    expect(store().accounts).toEqual([]);
  });

  describe('identity', () => {
    const identity = (login: string) => ({
      source: 'ssh' as const,
      host: 'github.com',
      login,
      name: null,
      avatarDataUrl: null,
      ssh: { ok: true, login, reason: 'ok' as const },
      helpers: [],
      profile: null,
    });

    beforeEach(() => {
      api.authSource.mockResolvedValue('ssh');
      useAccountStore.setState({ identity: null });
    });

    it('is refreshed together with the auth source', async () => {
      api.identity.mockResolvedValue(identity('octocat'));
      await store().refreshAuthSource('github.com', 'ssh', REPO);
      await vi.waitFor(() => expect(store().identity?.login).toBe('octocat'));
      expect(api.identity).toHaveBeenCalledWith(REPO);
    });

    it('keeps the newest answer when an older one arrives late', async () => {
      let finishOld: (v: unknown) => void = () => {};
      api.identity
        .mockImplementationOnce(() => new Promise(r => (finishOld = r)))
        .mockResolvedValueOnce(identity('newer'));
      const old = store().refreshIdentity('/src/old');
      await store().refreshIdentity(REPO);
      finishOld(identity('older'));
      await old;
      expect(store().identity?.login).toBe('newer');
    });

    it('is cleared without a remote', async () => {
      useAccountStore.setState({ identity: identity('octocat') });
      await store().refreshAuthSource(null, null, REPO);
      expect(store().identity).toBeNull();
      expect(api.identity).not.toHaveBeenCalled();
    });
  });

  describe('connection test', () => {
    const passed = (login: string) => ({
      host: 'github.com',
      login,
      ok: true,
      steps: [{ step: 'who' as const, ok: true, message: 'ok', logId: 'l1' }],
      at: 1,
    });

    beforeEach(() => useAccountStore.setState({ tests: {}, testing: {} }));

    it('keeps each result under its host and repository', async () => {
      api.test.mockResolvedValueOnce(passed('a')).mockResolvedValueOnce(passed('b'));
      await store().runTest('/src/a', 'github.com');
      await store().runTest('/src/b', 'github.com');

      expect(api.test).toHaveBeenCalledWith('/src/a');
      expect(store().tests[testKey('github.com', '/src/a')].login).toBe('a');
      expect(store().tests[testKey('github.com', '/src/b')].login).toBe('b');
      expect(store().tests[testKey('gitlab.com', '/src/a')]).toBeUndefined();
    });

    it('marks the repository busy while the test runs and ignores a second start', async () => {
      let finish: (v: unknown) => void = () => {};
      api.test.mockImplementationOnce(() => new Promise(r => (finish = r)));
      const running = store().runTest(REPO, 'github.com');
      expect(store().testing[testKey('github.com', REPO)]).toBe(true);
      await store().runTest(REPO, 'github.com');
      expect(api.test).toHaveBeenCalledTimes(1);

      finish(passed('octocat'));
      await running;
      expect(store().testing[testKey('github.com', REPO)]).toBeUndefined();
    });

    it('turns a failed call into a failed result with its log entry', async () => {
      api.test.mockRejectedValueOnce(Object.assign(new Error('no remote'), { logId: 'e1' }));
      await store().runTest(REPO, 'github.com');
      const result = store().tests[testKey('github.com', REPO)];
      expect(result.ok).toBe(false);
      expect(result.steps[0]).toMatchObject({ ok: false, message: 'no remote', logId: 'e1' });
    });

    it('forgets a result on request', async () => {
      api.test.mockResolvedValueOnce(passed('octocat'));
      await store().runTest(REPO, 'github.com');
      store().clearTest(REPO, 'github.com');
      expect(store().tests).toEqual({});
    });
  });
});
