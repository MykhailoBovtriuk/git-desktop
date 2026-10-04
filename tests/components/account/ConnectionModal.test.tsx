// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ConnectionModal } from '../../../src/components/account/ConnectionModal';
import { useAccountStore } from '../../../src/stores/account-store';
import { useRepoStore } from '../../../src/stores/repo-store';
import { useUiStore } from '../../../src/stores/ui-store';
import type { AuthSource, ProviderAccount, RemoteProtocol } from '../../../src/types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));
vi.mock('../../../src/stores/account-store', () => ({ useAccountStore: vi.fn() }));
vi.mock('../../../src/stores/repo-store', () => ({ useRepoStore: vi.fn() }));
vi.mock('../../../src/stores/ui-store', () => ({ useUiStore: vi.fn() }));

const ACCOUNT: ProviderAccount = {
  id: 'github.com',
  providerId: 'github',
  host: 'github.com',
  displayName: 'GitHub',
  login: 'octocat',
  name: null,
  email: '',
  avatarDataUrl: null,
};

function setup({
  open = true,
  remoteHost = 'github.com' as string | null,
  remoteProtocol = 'https' as RemoteProtocol | null,
  authSource = 'none' as AuthSource | null,
  current = null as ProviderAccount | null,
  persistent = true,
  confirm = true,
} = {}) {
  const ui = {
    connectionOpen: open,
    closeConnection: vi.fn(),
    requestConfirm: vi.fn().mockResolvedValue(confirm),
    addToast: vi.fn(),
  };
  const repo = {
    repoPath: '/tmp/r',
    remoteUrl: remoteProtocol === 'ssh' ? 'git@github.com:o/r.git' : 'https://github.com/o/r.git',
    remoteHost,
    remoteProtocol,
    switchRemoteProtocol: vi.fn().mockResolvedValue(undefined),
  };
  const account = {
    current,
    authSource,
    persistent,
    openSignIn: vi.fn(),
    signOut: vi.fn().mockResolvedValue(undefined),
    forgetSystemCredential: vi.fn().mockResolvedValue(undefined),
    refreshAuthSource: vi.fn().mockResolvedValue(undefined),
    refreshCurrent: vi.fn(),
  };
  vi.mocked(useUiStore).mockImplementation(((sel: any) => sel(ui)) as any);
  vi.mocked(useRepoStore).mockImplementation(((sel: any) => sel(repo)) as any);
  vi.mocked(useAccountStore).mockImplementation(((sel: any) => sel(account)) as any);
  return { ui, repo, account };
}

describe('ConnectionModal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('stays closed until asked for', () => {
    setup({ open: false });
    const { container } = render(<ConnectionModal />);
    expect(container.innerHTML).toBe('');
  });

  it('shows the address git actually talks to', () => {
    setup();
    render(<ConnectionModal />);
    expect(screen.getByText('https://github.com/o/r.git')).toBeTruthy();
  });

  // On ssh a sign-in changes nothing, so the only way forward is the switch.
  it('names the ssh key and offers the switch to https, not a sign-in', () => {
    const { repo } = setup({ remoteProtocol: 'ssh', authSource: 'ssh' });
    render(<ConnectionModal />);

    expect(screen.getByText('connection.ssh')).toBeTruthy();
    expect(screen.queryByText('connection.signIn')).toBeNull();
    expect(screen.getByRole('radio', { name: 'SSH' }).getAttribute('aria-checked')).toBe('true');

    fireEvent.click(screen.getByRole('radio', { name: 'HTTPS' }));
    expect(repo.switchRemoteProtocol).toHaveBeenCalledWith('https');
  });

  it('does nothing when the current protocol is picked again', () => {
    const { repo } = setup();
    render(<ConnectionModal />);
    fireEvent.click(screen.getByRole('radio', { name: 'HTTPS' }));
    expect(repo.switchRemoteProtocol).not.toHaveBeenCalled();
  });

  // The state right after switching to https on a fresh machine: the push that
  // follows would fail, so the way out is the obvious button.
  it('offers a sign-in when nothing authenticates https', () => {
    const { ui, account } = setup({ authSource: 'none' });
    render(<ConnectionModal />);

    expect(screen.getByText('connection.none')).toBeTruthy();
    fireEvent.click(screen.getByText('connection.signIn'));
    expect(ui.closeConnection).toHaveBeenCalled();
    expect(account.openSignIn).toHaveBeenCalledWith('github.com', '/tmp/r');
  });

  // A stale Keychain password was the dead end: git kept using it and nothing
  // offered to replace it.
  it('can forget a login stored outside the app, after asking', async () => {
    const { ui, account } = setup({ authSource: 'system' });
    render(<ConnectionModal />);

    expect(screen.getByText('connection.system')).toBeTruthy();
    expect(screen.getByText('connection.signIn')).toBeTruthy();
    fireEvent.click(screen.getByText('connection.forget'));

    await waitFor(() => expect(account.forgetSystemCredential).toHaveBeenCalledWith('github.com'));
    expect(ui.requestConfirm).toHaveBeenCalledWith(expect.objectContaining({ danger: true }));
    expect(account.refreshAuthSource).toHaveBeenCalledWith('github.com', 'https');
  });

  it('keeps the stored login when the confirmation is declined', async () => {
    const { ui, account } = setup({ authSource: 'system', confirm: false });
    render(<ConnectionModal />);

    fireEvent.click(screen.getByText('connection.forget'));
    await waitFor(() => expect(ui.requestConfirm).toHaveBeenCalled());
    expect(account.forgetSystemCredential).not.toHaveBeenCalled();
  });

  it('signs out of an account of our own', async () => {
    const { account } = setup({ authSource: 'account', current: ACCOUNT });
    render(<ConnectionModal />);

    expect(screen.getByText('signedInAs')).toBeTruthy();
    expect(screen.queryByText('connection.forget')).toBeNull();
    fireEvent.click(screen.getByText('section.signOut'));

    await waitFor(() => expect(account.signOut).toHaveBeenCalledWith('github.com'));
    expect(account.refreshAuthSource).toHaveBeenCalled();
  });

  it('offers no switch for a remote that is neither ssh nor https', () => {
    setup({ remoteProtocol: 'other', authSource: 'ssh' });
    render(<ConnectionModal />);

    expect(screen.queryByRole('radiogroup')).toBeNull();
    expect(screen.getByText('connection.local')).toBeTruthy();
  });

  it('warns that https logins will not survive a restart without a keychain', () => {
    setup({ persistent: false });
    render(<ConnectionModal />);
    expect(screen.getByText('section.notPersistent')).toBeTruthy();
  });

  it('keeps the keychain warning to https, where a token is involved', () => {
    setup({ persistent: false, remoteProtocol: 'ssh', authSource: 'ssh' });
    render(<ConnectionModal />);
    expect(screen.queryByText('section.notPersistent')).toBeNull();
  });

  it('reports a failed switch instead of failing silently', async () => {
    const { ui, repo } = setup({ remoteProtocol: 'ssh', authSource: 'ssh' });
    repo.switchRemoteProtocol.mockRejectedValueOnce(new Error('boom'));
    render(<ConnectionModal />);

    fireEvent.click(screen.getByRole('radio', { name: 'HTTPS' }));
    await waitFor(() =>
      expect(ui.addToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'error', message: 'boom' }),
      ),
    );
  });
});
