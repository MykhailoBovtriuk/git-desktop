// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AccountCard } from '../../../src/components/account/AccountCard';
import { useAccountStore } from '../../../src/stores/account-store';
import { useRepoStore } from '../../../src/stores/repo-store';
import { useUiStore } from '../../../src/stores/ui-store';
import { requestOrgAccess } from '../../../src/stores/error-toast';
import type {
  AuthSource,
  ProviderAccount,
  RemoteProtocol,
  RepoIdentity,
  RepoTestResult,
} from '../../../src/types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) => (o ? `${k} ${JSON.stringify(o)}` : k),
  }),
}));
vi.mock('../../../src/stores/account-store', () => ({ useAccountStore: vi.fn() }));
vi.mock('../../../src/stores/repo-store', () => ({ useRepoStore: vi.fn() }));
vi.mock('../../../src/stores/ui-store', () => ({ useUiStore: vi.fn() }));
vi.mock('../../../src/api/account-api', () => ({
  accountApi: {
    providersFor: vi.fn().mockResolvedValue({ host: null, providerId: null, options: [] }),
  },
}));
const openLogEntry = vi.fn();
vi.mock('../../../src/stores/error-toast', () => ({
  openLogEntry: (id: string) => openLogEntry(id),
  showErrorToast: vi.fn(),
  requestOrgAccess: vi.fn(),
}));

const REPO = '/src/p';
const KEY = `github.com\0${REPO}`;

const ACCOUNT: ProviderAccount = {
  id: REPO,
  repoPath: REPO,
  providerId: 'github',
  host: 'github.com',
  displayName: 'GitHub',
  login: 'octocat',
  name: 'The Octocat',
  email: '',
  avatarDataUrl: null,
};

const identity = (over: Partial<RepoIdentity>): RepoIdentity => ({
  source: 'system',
  host: 'github.com',
  login: null,
  name: null,
  avatarDataUrl: null,
  ssh: null,
  helpers: [],
  profile: null,
  ...over,
});

function setup({
  protocol = 'https' as RemoteProtocol | null,
  authSource = 'none' as AuthSource | null,
  current = null as ProviderAccount | null,
  who = null as RepoIdentity | null,
  tests = {} as Record<string, RepoTestResult>,
  testing = {} as Record<string, boolean>,
} = {}) {
  const repo = {
    repoPath: REPO,
    remoteUrl: protocol === 'ssh' ? 'git@github.com:o/r.git' : 'https://github.com/o/r.git',
    remoteHost: 'github.com',
    remoteProtocol: protocol,
    switchRemoteProtocol: vi.fn().mockResolvedValue(undefined),
  };
  const account = {
    accountFor: () => current,
    authSource,
    identity: who,
    tests,
    testing,
    openSignIn: vi.fn(),
    signOut: vi.fn().mockResolvedValue(undefined),
    forgetSystemCredential: vi.fn().mockResolvedValue(undefined),
    refreshAuthSource: vi.fn().mockResolvedValue(undefined),
    runTest: vi.fn().mockResolvedValue(undefined),
    clearTest: vi.fn(),
  };
  const ui = { requestConfirm: vi.fn().mockResolvedValue(true), addToast: vi.fn() };
  vi.mocked(useRepoStore).mockImplementation(((sel: any) => sel(repo)) as any);
  (useRepoStore as unknown as { getState: () => unknown }).getState = () => repo;
  vi.mocked(useAccountStore).mockImplementation(((sel: any) => sel(account)) as any);
  vi.mocked(useUiStore).mockImplementation(((sel: any) => sel(ui)) as any);
  return { repo, account, ui };
}

const buttons = () => screen.queryAllByRole('button').map(b => b.textContent);

describe('AccountCard', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows an account in the app with test and sign-out', () => {
    setup({ authSource: 'account', current: ACCOUNT });
    render(<AccountCard />);

    expect(screen.getByText('The Octocat')).toBeTruthy();
    expect(screen.getByText('@octocat · github.com')).toBeTruthy();
    expect(screen.getByText(/card\.source .*card\.sources\.account/)).toBeTruthy();
    expect(buttons()).toEqual(['card.test', 'section.signOut']);
  });

  it('shows a system login with who it is and where git keeps it', () => {
    setup({
      authSource: 'system',
      who: identity({
        login: 'octocat',
        helpers: [{ url: null, helper: 'osxkeychain', scope: 'global', cli: null }],
      }),
    });
    render(<AccountCard />);

    expect(screen.getByText('@octocat · github.com')).toBeTruthy();
    expect(screen.getByText(/card\.sourceVia .*card\.sources\.system.*osxkeychain/)).toBeTruthy();
    expect(buttons()).toEqual(['card.test', 'connection.forget', 'card.signInInstead']);
  });

  it('names Git Credential Manager as the source', () => {
    setup({
      authSource: 'system',
      who: identity({
        source: 'gcm',
        helpers: [{ url: null, helper: 'manager', scope: 'global', cli: 'gcm' }],
      }),
    });
    render(<AccountCard />);

    expect(screen.getByText(/card\.sources\.gcm.*card\.helper\.gcm/)).toBeTruthy();
    expect(buttons()).toEqual(['card.test', 'connection.forget', 'card.signInInstead']);
  });

  it('shows an ssh key with only a test', () => {
    setup({
      protocol: 'ssh',
      authSource: 'ssh',
      who: identity({
        source: 'ssh',
        login: 'octocat',
        ssh: { ok: true, login: 'octocat', reason: 'ok' },
      }),
    });
    render(<AccountCard />);

    expect(screen.getByText('@octocat')).toBeTruthy();
    expect(screen.getByText('git@github.com:o/r.git')).toBeTruthy();
    expect(screen.getByText(/card\.sources\.ssh/)).toBeTruthy();
    expect(buttons()).toEqual(['card.test']);
  });

  it('offers only a sign-in when nothing signs in', () => {
    const { account } = setup({ authSource: 'none' });
    const onSignIn = vi.fn();
    render(<AccountCard onSignIn={onSignIn} />);

    expect(screen.getByText('connection.none')).toBeTruthy();
    expect(screen.getByText(/card\.sources\.none/)).toBeTruthy();
    expect(buttons()).toEqual(['connection.signIn']);
    fireEvent.click(screen.getByText('connection.signIn'));
    expect(onSignIn).toHaveBeenCalled();
    expect(account.openSignIn).toHaveBeenCalledWith('github.com', REPO);
  });

  it('lets the actions wrap below the text instead of squeezing the title', () => {
    setup({ authSource: 'system' });
    render(<AccountCard />);
    const actions = screen.getByTestId('card-actions');
    expect(actions.parentElement?.className).toContain('flex-wrap');
    expect(screen.getByText('connection.system').className).toContain('break-words');
    expect(screen.getByText('connection.system').className).not.toContain('truncate');
  });

  it('ignores an identity left over from the other protocol', () => {
    setup({ authSource: 'system', who: identity({ source: 'ssh', login: 'old' }) });
    render(<AccountCard />);
    expect(screen.queryByText(/@old/)).toBeNull();
    expect(screen.getByText('connection.system')).toBeTruthy();
  });

  it('runs the test for this repository', () => {
    const { account } = setup({ authSource: 'account', current: ACCOUNT });
    render(<AccountCard />);
    fireEvent.click(screen.getByText('card.test'));
    expect(account.runTest).toHaveBeenCalledWith(REPO, 'github.com');
  });

  it('shows a running test as busy', () => {
    setup({ authSource: 'account', current: ACCOUNT, testing: { [KEY]: true } });
    render(<AccountCard />);
    expect(screen.getByText('card.test').closest('button')?.disabled).toBe(true);
    expect(screen.getByRole('status').textContent).toContain('test.running');
  });

  it('reports a passed test with the user and access, and links its log', () => {
    setup({
      authSource: 'account',
      current: ACCOUNT,
      tests: {
        [KEY]: {
          host: 'github.com',
          login: 'octocat',
          ok: true,
          steps: [
            { step: 'who', ok: true, message: '', logId: 'a' },
            { step: 'read', ok: true, message: '', logId: 'b' },
            { step: 'write', ok: true, message: '', logId: 'c' },
          ],
          at: Date.now(),
        },
      },
    });
    render(<AccountCard />);

    const status = screen.getByRole('status');
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(status.textContent).toMatch(/test\.passed .*test\.user/);
    fireEvent.click(screen.getByText('logs:showInLogs'));
    expect(openLogEntry).toHaveBeenCalledWith('c');
  });

  it('reports a failed ssh test with what to do about it', () => {
    setup({
      protocol: 'ssh',
      authSource: 'ssh',
      tests: {
        [KEY]: {
          host: 'github.com',
          login: null,
          ok: false,
          steps: [
            {
              step: 'who',
              ok: false,
              reasonKind: 'sshKey',
              sshReason: 'key-rejected',
              message: 'The server did not accept any SSH key',
              logId: 'w',
            },
          ],
          at: Date.now(),
        },
      },
    });
    render(<AccountCard />);

    const status = screen.getByRole('status').textContent;
    expect(status).toMatch(/test\.failed .*test\.ssh\.key-rejected/);
    expect(status).toContain('test.sshHint.key-rejected');
    fireEvent.click(screen.getByText('logs:showInLogs'));
    expect(openLogEntry).toHaveBeenCalledWith('w');
  });

  it('offers to request organization access instead of signing in again', () => {
    const { account } = setup({
      authSource: 'account',
      current: ACCOUNT,
      tests: {
        [KEY]: {
          host: 'github.com',
          login: 'octocat',
          ok: false,
          steps: [
            { step: 'who', ok: true, message: 'Signed in as @octocat', logId: 'w' },
            {
              step: 'read',
              ok: false,
              reasonKind: 'orgAccess',
              message: 'Repository not found',
              logId: 'r',
            },
          ],
          at: Date.now(),
        },
      },
    });
    render(<AccountCard />);

    const status = screen.getByRole('status').textContent;
    expect(status).toMatch(/test\.failed .*test\.reason\.orgAccess/);
    expect(status).toContain('test.orgAccessHint');
    fireEvent.click(screen.getByText('footer:requestAccess'));
    expect(requestOrgAccess).toHaveBeenCalledWith(REPO, 'footer:requestAccessFailed');
    expect(account.openSignIn).not.toHaveBeenCalled();
  });

  it('tests right after switching to ssh', async () => {
    const { repo, account } = setup({ authSource: 'system' });
    render(<AccountCard />);

    fireEvent.click(screen.getByRole('radio', { name: 'SSH' }));
    await waitFor(() => expect(account.runTest).toHaveBeenCalledWith(REPO, 'github.com'));
    expect(repo.switchRemoteProtocol).toHaveBeenCalledWith('ssh');
  });

  it('drops the ssh result after switching back to https', async () => {
    const { account } = setup({ protocol: 'ssh', authSource: 'ssh' });
    render(<AccountCard />);

    fireEvent.click(screen.getByRole('radio', { name: 'HTTPS' }));
    await waitFor(() => expect(account.clearTest).toHaveBeenCalledWith(REPO, 'github.com'));
    expect(account.runTest).not.toHaveBeenCalled();
  });

  it('asks before forgetting a system login', async () => {
    const { account, ui } = setup({ authSource: 'system' });
    render(<AccountCard />);

    fireEvent.click(screen.getByText('connection.forget'));
    await waitFor(() =>
      expect(account.forgetSystemCredential).toHaveBeenCalledWith('github.com', REPO),
    );
    expect(ui.requestConfirm).toHaveBeenCalledWith(expect.objectContaining({ danger: true }));
  });
});
