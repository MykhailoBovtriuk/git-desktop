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

const OPTIONS: ProviderOption[] = [
  {
    id: 'gitlab-self',
    displayName: 'GitLab (self-managed)',
    configured: true,
    needsHost: true,
    needsClientId: true,
    tokenHelpUrl: null,
  },
  {
    id: 'token',
    displayName: 'Personal access token',
    configured: true,
    needsHost: true,
    needsClientId: false,
    tokenHelpUrl: 'https://git.acme.internal',
  },
  {
    id: 'github',
    displayName: 'GitHub',
    configured: true,
    needsHost: false,
    needsClientId: false,
    tokenHelpUrl: null,
  },
];

const CANDIDATES = [
  {
    id: 'github.com|octocat',
    providerId: 'github' as const,
    host: 'github.com',
    displayName: 'GitHub',
    login: 'octocat',
    name: 'The Octocat',
    email: 'o@x',
    avatarDataUrl: null,
  },
  {
    id: 'github.com|work',
    providerId: 'github' as const,
    host: 'github.com',
    displayName: 'GitHub',
    login: 'work',
    name: 'Work Account',
    email: 'w@x',
    avatarDataUrl: null,
  },
];

function setup({
  phase = 'browser' as SignInPhase | null,
  providerId = 'github' as string | null,
  host = 'github.com',
  error = null as string | null,
} = {}) {
  const actions = {
    chooseProvider: vi.fn(),
    setHost: vi.fn(),
    continueWithBrowser: vi.fn().mockResolvedValue(undefined),
    submitToken: vi.fn().mockResolvedValue(undefined),
    cancelSignIn: vi.fn().mockResolvedValue(undefined),
    dismissForRepo: vi.fn(),
    chooseAccount: vi.fn().mockResolvedValue(undefined),
    openSignIn: vi.fn().mockResolvedValue(undefined),
  };
  const state = {
    phase,
    target: phase
      ? { host, providerId, options: OPTIONS, repoPath: '/tmp/repo', candidates: CANDIDATES }
      : null,
    error,
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

  // A self-hosted instance registers its own OAuth app, so the client id has
  // to come from the user — and until it does there is nothing to send.
  it('requires a client id before handing off to a self-hosted server', () => {
    setup({ providerId: 'gitlab-self', host: 'gitlab.acme.internal' });
    render(<SignInModal />);
    expect(screen.getByText('browser.continue').closest('button')).toBeDisabled();
  });

  // A closed tab or a browser that never opened would otherwise be a dead end.
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
    expect(screen.getByText('Personal access token')).toBeTruthy();
    // github.com is not something you can pick for a different host.
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

  // The browser flow can fail for reasons the token path does not share, so
  // the error state has to leave a way forward rather than only a Cancel.
  it('offers the token path after a failed browser sign-in', () => {
    const actions = setup({ phase: 'error', error: 'state did not match' });
    render(<SignInModal />);

    expect(screen.getByText('state did not match')).toBeTruthy();
    fireEvent.click(screen.getByText('error.useToken'));
    expect(actions.chooseProvider).toHaveBeenCalledWith('token');
  });

  // Two accounts on one host: which owns this repository is a question only
  // the user can answer, and guessing attributes their work to the wrong one.
  it('asks which of several accounts owns the repository', () => {
    const actions = setup({ phase: 'pick-account' });
    render(<SignInModal />);

    expect(screen.getByText('The Octocat')).toBeTruthy();
    expect(screen.getByText('Work Account')).toBeTruthy();
    expect(screen.getByText('pick.use').closest('button')).toBeDisabled();

    fireEvent.click(screen.getByText('Work Account'));
    fireEvent.click(screen.getByText('pick.use'));
    expect(actions.chooseAccount).toHaveBeenCalledWith('github.com|work');
  });

  it('offers a third account from the picker', () => {
    const actions = setup({ phase: 'pick-account' });
    render(<SignInModal />);

    fireEvent.click(screen.getByText('pick.another'));
    expect(actions.openSignIn).toHaveBeenCalledWith('github.com', '/tmp/repo');
  });

  // "Not now" must not come back the next time the same repository is opened.
  it('remembers the repository when the dialog is dismissed', () => {
    const actions = setup();
    render(<SignInModal />);

    fireEvent.click(screen.getByText('common:cancel'));
    expect(actions.dismissForRepo).toHaveBeenCalledWith('/tmp/repo');
    expect(actions.cancelSignIn).toHaveBeenCalled();
  });
});
