// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AccountsSection } from '../../../src/components/settings/AccountsSection';
import { useAccountStore } from '../../../src/stores/account-store';
import { testKey } from '../../../src/lib/test-key';
import { accountApi } from '../../../src/api/account-api';
import { useRepoStore } from '../../../src/stores/repo-store';
import { useUiStore } from '../../../src/stores/ui-store';
import type {
  AuthSource,
  ProviderAccount,
  ProviderOption,
  RepoTestResult,
} from '../../../src/types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));
vi.mock('../../../src/stores/account-store', () => ({ useAccountStore: vi.fn() }));
vi.mock('../../../src/stores/repo-store', () => ({ useRepoStore: vi.fn() }));
vi.mock('../../../src/stores/ui-store', () => ({ useUiStore: vi.fn() }));
vi.mock('../../../src/api/account-api', () => ({
  accountApi: { providersFor: vi.fn() },
}));

const providersFor = vi.mocked(accountApi.providersFor);

const REPO = '/src/project';

const account = (
  host: string,
  login: string,
  providerId: ProviderAccount['providerId'] = 'github',
  repoPath = REPO,
): ProviderAccount => ({
  id: repoPath,
  repoPath,
  providerId,
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
  repoPath = REPO as string | null,
  remoteUrl = 'https://github.com/o/r.git' as string | null,
  remoteHost = 'github.com' as string | null,
  remoteProtocol = 'https' as string | null,
  authSource = 'none' as AuthSource | null,
  tests = {} as Record<string, RepoTestResult>,
} = {}) {
  const openSignIn = vi.fn().mockResolvedValue(undefined);
  const switchRemoteProtocol = vi.fn().mockResolvedValue(undefined);
  const signOut = vi.fn().mockResolvedValue(undefined);
  const runTest = vi.fn().mockResolvedValue(undefined);
  const accountFor = (path: string | null) => accounts.find(a => a.repoPath === path) ?? null;
  const state = {
    accounts,
    persistent,
    openSignIn,
    signOut,
    accountFor,
    authSource,
    identity: null,
    tests,
    testing: {},
    runTest,
    clearTest: vi.fn(),
    refreshAuthSource: vi.fn().mockResolvedValue(undefined),
    forgetSystemCredential: vi.fn(),
  };
  const repo = { repoPath, remoteUrl, remoteHost, remoteProtocol, switchRemoteProtocol };
  vi.mocked(useAccountStore).mockImplementation(((sel: any) => sel(state)) as any);
  vi.mocked(useRepoStore).mockImplementation(((sel: any) => sel(repo)) as any);
  (useRepoStore as unknown as { getState: () => unknown }).getState = () => repo;
  const ui = { requestConfirm: vi.fn(), addToast: vi.fn() };
  vi.mocked(useUiStore).mockImplementation(((sel: any) => sel(ui)) as any);
  (useUiStore as unknown as { getState: () => unknown }).getState = () => ui;
  return { openSignIn, signOut, switchRemoteProtocol, runTest };
}

describe('AccountsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    providersFor.mockResolvedValue({ host: 'github.com', providerId: null, options: [] });
  });

  it('asks for a repository first: accounts belong to one', () => {
    setup({ repoPath: null });
    render(<AccountsSection />);
    expect(screen.getByText('section.noRepo')).toBeTruthy();
    expect(screen.queryByText('connection.signIn')).toBeNull();
    expect(screen.queryByText('section.signedInRepos')).toBeNull();
  });

  it('signs the open repository in through the same flow as the footer', () => {
    const { openSignIn } = setup();
    render(<AccountsSection />);

    fireEvent.click(screen.getByText('connection.signIn'));
    expect(openSignIn).toHaveBeenCalledWith('github.com', REPO);
  });

  it('names the service the remote is on', async () => {
    providersFor.mockResolvedValue({
      host: 'github.com',
      providerId: 'github',
      options: [{ id: 'github', displayName: 'GitHub' } as ProviderOption],
    });
    setup();
    render(<AccountsSection />);

    expect(await screen.findByText('section.signInTo')).toBeTruthy();
    expect(providersFor).toHaveBeenCalledWith('github.com');
  });

  it.each([
    [
      'a local remote',
      { remoteUrl: '/srv/r.git', remoteHost: null, remoteProtocol: 'other' },
      'section.noSignIn',
    ],
    ['no remote', { remoteUrl: null, remoteHost: null, remoteProtocol: null }, 'section.noRemote'],
  ])('offers no sign-in for %s', (_, repo, hint) => {
    const { openSignIn } = setup(repo);
    render(<AccountsSection />);

    expect(screen.getByText(hint)).toBeTruthy();
    expect(screen.queryByText('connection.signIn')).toBeNull();
    expect(openSignIn).not.toHaveBeenCalled();
  });

  it('shows the ssh card with a test and no sign-in', () => {
    setup({ remoteUrl: 'git@github.com:o/r.git', remoteProtocol: 'ssh', authSource: 'ssh' });
    render(<AccountsSection />);

    expect(screen.getByText('card.test')).toBeTruthy();
    expect(screen.queryByText('connection.signIn')).toBeNull();
  });

  it('switches the protocol of the open repository', () => {
    const { switchRemoteProtocol } = setup();
    render(<AccountsSection />);

    expect(screen.getByRole('radio', { name: 'HTTPS' }).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByRole('radio', { name: 'SSH' }));
    expect(switchRemoteProtocol).toHaveBeenCalledWith('ssh');
  });

  it('has no protocol switch without a repository', () => {
    setup({ repoPath: null });
    render(<AccountsSection />);
    expect(screen.queryByRole('radiogroup')).toBeNull();
  });

  it('explains the account only for an https remote', () => {
    setup();
    const { unmount } = render(<AccountsSection />);
    expect(screen.getByText('section.repoHint')).toBeTruthy();
    unmount();

    setup({ remoteUrl: 'git@github.com:o/r.git', remoteProtocol: 'ssh' });
    render(<AccountsSection />);
    expect(screen.queryByText('section.repoHint')).toBeNull();
  });

  it('shows the account the repository is signed in to instead of a sign-in', () => {
    setup({
      accounts: [account('gitlab.acme.com', 'joe', 'gitlab-self')],
      remoteHost: 'gitlab.acme.com',
      remoteUrl: 'https://gitlab.acme.com/o/r.git',
    });
    render(<AccountsSection />);

    expect(screen.getByText('@joe · gitlab.acme.com')).toBeTruthy();
    expect(screen.queryByText('connection.signIn')).toBeNull();
  });

  it("ignores other repositories' accounts", () => {
    setup({ accounts: [account('github.com', 'octocat', 'github', '/src/other')] });
    render(<AccountsSection />);

    expect(screen.queryByText('@octocat · github.com')).toBeNull();
    expect(screen.getByText('connection.signIn')).toBeTruthy();
  });

  it('signs this repository out', () => {
    const { signOut } = setup({ accounts: [account('github.com', 'octocat')] });
    render(<AccountsSection />);

    fireEvent.click(screen.getByText('section.signOut'));
    expect(signOut).toHaveBeenCalledWith(REPO);
  });

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

  describe('without a repository', () => {
    const accounts = [
      account('github.com', 'octocat', 'github', '/src/one'),
      account('gitlab.com', 'joe', 'gitlab', '/work/two'),
    ];

    it('lists every repository that has an account here', () => {
      setup({ repoPath: null, accounts });
      render(<AccountsSection />);

      expect(screen.getByText('section.signedInRepos')).toBeTruthy();
      expect(screen.getByText('one')).toBeTruthy();
      expect(screen.getByText('/src/one')).toBeTruthy();
      expect(screen.getByText('@octocat · github.com')).toBeTruthy();
      expect(screen.getByText('two')).toBeTruthy();
      expect(screen.getByText('@joe · gitlab.com')).toBeTruthy();
    });

    it('signs one of them out', () => {
      const { signOut } = setup({ repoPath: null, accounts });
      render(<AccountsSection />);

      fireEvent.click(screen.getAllByText('section.signOut')[1]);
      expect(signOut).toHaveBeenCalledWith('/work/two');
    });

    it('tests one of them and shows its own result', () => {
      const { runTest } = setup({
        repoPath: null,
        accounts,
        tests: {
          [testKey('gitlab.com', '/work/two')]: {
            host: 'gitlab.com',
            login: 'joe',
            ok: true,
            steps: [{ step: 'write', ok: true, message: 'ok', logId: 'l1' }],
            at: Date.now(),
          },
        },
      });
      render(<AccountsSection />);

      fireEvent.click(screen.getAllByText('card.test')[0]);
      expect(runTest).toHaveBeenCalledWith('/src/one', 'github.com');
      expect(screen.getAllByText(/test\.passed/)).toHaveLength(1);
    });
  });
});
