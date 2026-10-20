// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SignInModal } from '../../../src/components/account/SignInModal';
import { useAccountStore } from '../../../src/stores/account-store';
import { useRepoStore } from '../../../src/stores/repo-store';
import type { ProviderOption, SignInPhase } from '../../../src/types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));
vi.mock('../../../src/stores/account-store', () => ({ useAccountStore: vi.fn() }));
vi.mock('../../../src/stores/repo-store', () => ({ useRepoStore: vi.fn() }));
vi.mock('../../../src/api/account-api', () => ({
  accountApi: { openTokenHelp: vi.fn().mockResolvedValue(null) },
}));

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

const OPTIONS: ProviderOption[] = [
  option({ id: 'gitlab-self', displayName: 'GitLab (self-managed)', group: 'gitlab-self' }),
  option({
    id: 'github-enterprise',
    displayName: 'GitHub Enterprise',
    group: 'github-enterprise',
    needsClientSecret: true,
  }),
  option({ id: 'azure-devops-server', displayName: 'Azure DevOps Server', needsClientId: false }),
  option({
    id: 'token',
    displayName: 'Personal access token',
    needsClientId: false,
  }),
  option({
    id: 'github',
    displayName: 'GitHub',
    group: 'github',
    defaultHost: 'github.com',
    configured: true,
    needsHost: false,
    needsClientId: false,
  }),
];

const EXISTING = {
  id: 'github.com',
  providerId: 'github' as const,
  host: 'github.com',
  displayName: 'GitHub',
  login: 'octocat',
  name: 'The Octocat',
  email: '',
  avatarDataUrl: null,
};

function setup({
  phase = 'browser' as SignInPhase | null,
  providerId = 'github' as string | null,
  host = 'github.com',
  error = null as string | null,
  endpointError = null as string | null,
  existing = null as typeof EXISTING | null,
  repoPath = '/tmp/repo' as string | null,
} = {}) {
  const actions = {
    chooseProvider: vi.fn(),
    submitEndpoint: vi.fn(),
    confirmReplace: vi.fn(),
    switchMethod: vi.fn(),
    continueWithBrowser: vi.fn().mockResolvedValue(undefined),
    submitToken: vi.fn().mockResolvedValue(undefined),
    cancelSignIn: vi.fn().mockResolvedValue(undefined),
    dismissForRepo: vi.fn(),
  };
  const state = {
    phase,
    target: phase ? { host, providerId, options: OPTIONS, repoPath, existing } : null,
    error,
    endpointError,
    busy: false,
    ...actions,
  };
  vi.mocked(useAccountStore).mockImplementation(((sel: any) => sel(state)) as any);
  vi.mocked(useRepoStore).mockImplementation(((sel: any) => sel({ repoPath: '/tmp/repo' })) as any);
  return actions;
}

describe('SignInModal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders nothing when no sign-in is in progress', () => {
    setup({ phase: null });
    const { container } = render(<SignInModal />);
    expect(container.firstChild).toBeNull();
  });

  it('offers the browser hand-off for a recognised host', () => {
    const actions = setup();
    render(<SignInModal />);

    expect(screen.getByText('browser.title')).toBeTruthy();
    fireEvent.click(screen.getByText('browser.continue'));
    expect(actions.continueWithBrowser).toHaveBeenCalled();
  });

  it('requires a client id before handing off to a self-hosted server', () => {
    setup({ providerId: 'gitlab-self', host: 'gitlab.acme.internal' });
    render(<SignInModal />);
    expect(screen.getByText('browser.continue').closest('button')).toBeDisabled();
  });

  it('asks for no secret when the provider uses PKCE', () => {
    setup({ providerId: 'gitlab-self', host: 'gitlab.acme.internal' });
    render(<SignInModal />);
    expect(screen.queryByPlaceholderText('browser.clientSecretPlaceholder')).toBeNull();
  });

  it('hands off only once both the client id and secret are given', () => {
    const actions = setup({ providerId: 'github-enterprise', host: 'ghe.acme.com' });
    render(<SignInModal />);
    const go = () => screen.getByText('browser.continue').closest('button')!;

    fireEvent.change(screen.getByPlaceholderText('browser.clientIdPlaceholder'), {
      target: { value: 'id-1' },
    });
    expect(go()).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText('browser.clientSecretPlaceholder'), {
      target: { value: 'shh' },
    });
    fireEvent.click(go());
    expect(actions.continueWithBrowser).toHaveBeenCalledWith('id-1', 'shh');
  });

  it('offers to reopen the browser while waiting', () => {
    const actions = setup({ phase: 'waiting' });
    render(<SignInModal />);

    expect(screen.getByText('browser.waiting')).toBeTruthy();
    fireEvent.click(screen.getByText('browser.reopen'));
    expect(actions.continueWithBrowser).toHaveBeenCalled();
  });

  it('lists only the self-hosted choices when the server is unknown', () => {
    const actions = setup({ phase: 'choose', providerId: null, host: 'git.acme.internal' });
    render(<SignInModal />);

    expect(screen.getByText('GitLab (self-managed)')).toBeTruthy();
    expect(screen.getByText('token.otherServer')).toBeTruthy();
    expect(screen.queryByText('GitHub')).toBeNull();

    fireEvent.click(screen.getByText('GitLab (self-managed)'));
    fireEvent.click(screen.getByText('choose.continue'));
    expect(actions.chooseProvider).toHaveBeenCalledWith('gitlab-self');
  });

  it('takes a username and token on the manual path', () => {
    const actions = setup({ phase: 'token', providerId: 'token', host: 'git.acme.internal' });
    render(<SignInModal />);

    fireEvent.change(screen.getByPlaceholderText('token.usernamePlaceholder'), {
      target: { value: 'jane' },
    });
    fireEvent.change(screen.getByPlaceholderText('token.tokenPlaceholder'), {
      target: { value: 'glpat-xxx' },
    });
    fireEvent.click(screen.getByText('token.submit'));
    expect(actions.submitToken).toHaveBeenCalledWith('jane', 'glpat-xxx');
  });

  it('keeps the manual submit disabled until both fields are filled', () => {
    setup({ phase: 'token', providerId: 'token', host: 'git.acme.internal' });
    render(<SignInModal />);
    expect(screen.getByText('token.submit').closest('button')).toBeDisabled();
  });

  it('offers the token path after a failed browser sign-in', () => {
    const actions = setup({ phase: 'error', error: 'state did not match' });
    render(<SignInModal />);

    expect(screen.getByText('state did not match')).toBeTruthy();
    fireEvent.click(screen.getByText('error.useToken'));
    expect(actions.switchMethod).toHaveBeenCalledWith('token');
  });

  it('remembers the repository when the dialog is dismissed', () => {
    const actions = setup();
    render(<SignInModal />);

    fireEvent.click(screen.getByText('common:cancel'));
    expect(actions.dismissForRepo).toHaveBeenCalledWith('/tmp/repo');
    expect(actions.cancelSignIn).toHaveBeenCalled();
  });

  it('does not remember a repository for a sign-in started from Settings', () => {
    const actions = setup({ repoPath: null });
    render(<SignInModal />);
    fireEvent.click(screen.getByText('common:cancel'));
    expect(actions.dismissForRepo).not.toHaveBeenCalled();
  });

  it('asks a self-hosted service for its address', () => {
    const actions = setup({ phase: 'endpoint', providerId: 'github-enterprise', host: '' });
    render(<SignInModal />);

    expect(screen.getByText('endpoint.title')).toBeTruthy();
    expect(screen.getByText('choose.continue').closest('button')).toBeDisabled();
    fireEvent.change(screen.getByLabelText('endpoint.label'), {
      target: { value: 'ghe.acme.com' },
    });
    fireEvent.click(screen.getByText('choose.continue'));
    expect(actions.submitEndpoint).toHaveBeenCalledWith('ghe.acme.com');
  });

  it('explains an address that was not accepted', () => {
    setup({
      phase: 'endpoint',
      providerId: 'github-enterprise',
      host: 'x',
      endpointError: 'mismatch',
    });
    render(<SignInModal />);
    expect(screen.getByText('endpoint.error.mismatch')).toBeTruthy();
  });

  it('warns before replacing an account on the same server', () => {
    const actions = setup({ phase: 'existing', existing: EXISTING });
    render(<SignInModal />);

    expect(screen.getByText('existing.title')).toBeTruthy();
    fireEvent.click(screen.getByText('existing.continue'));
    expect(actions.confirmReplace).toHaveBeenCalled();
  });

  it('asks only for the token when the service names the user itself', () => {
    const actions = setup({
      phase: 'token',
      providerId: 'github-enterprise',
      host: 'ghe.acme.com',
    });
    render(<SignInModal />);

    expect(screen.queryByPlaceholderText('token.usernamePlaceholder')).toBeNull();
    fireEvent.change(screen.getByPlaceholderText('token.tokenPlaceholder'), {
      target: { value: 'ghp_x' },
    });
    fireEvent.click(screen.getByText('token.submit'));
    expect(actions.submitToken).toHaveBeenCalledWith('', 'ghp_x');
  });

  it('offers the own-OAuth-app way in for a self-hosted service', () => {
    const actions = setup({
      phase: 'token',
      providerId: 'github-enterprise',
      host: 'ghe.acme.com',
    });
    render(<SignInModal />);
    fireEvent.click(screen.getByText('token.useOwnApp'));
    expect(actions.switchMethod).toHaveBeenCalledWith('browser');
  });

  it('offers a token from the browser step', () => {
    const actions = setup();
    render(<SignInModal />);
    fireEvent.click(screen.getByText('browser.useToken'));
    expect(actions.switchMethod).toHaveBeenCalledWith('token');
  });

  it('offers no browser for a token-only service', () => {
    setup({ phase: 'token', providerId: 'azure-devops-server', host: 'devops.acme.com' });
    render(<SignInModal />);
    expect(screen.queryByText('token.useOwnApp')).toBeNull();
    expect(screen.queryByText('token.useBrowser')).toBeNull();
  });
});
