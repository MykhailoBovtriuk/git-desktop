// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProtocolSwitch } from '../../../src/components/account/ProtocolSwitch';
import { useRepoStore } from '../../../src/stores/repo-store';
import { useUiStore } from '../../../src/stores/ui-store';
import type { RemoteProtocol } from '../../../src/types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));
vi.mock('../../../src/stores/repo-store', () => ({ useRepoStore: vi.fn() }));
vi.mock('../../../src/stores/ui-store', () => ({ useUiStore: vi.fn() }));

function setup({
  repoPath = '/tmp/r' as string | null,
  remoteProtocol = 'ssh' as RemoteProtocol | null,
} = {}) {
  const ui = { addToast: vi.fn() };
  const repo = {
    repoPath,
    remoteProtocol,
    switchRemoteProtocol: vi.fn().mockResolvedValue(undefined),
  };
  (useUiStore as unknown as { getState: () => unknown }).getState = () => ui;
  vi.mocked(useRepoStore).mockImplementation(((sel: any) => sel(repo)) as any);
  return { ui, repo };
}

describe('ProtocolSwitch', () => {
  beforeEach(() => vi.clearAllMocks());

  it('marks the protocol the remote uses and switches to the other one', () => {
    const { repo } = setup();
    render(<ProtocolSwitch />);

    expect(screen.getByRole('radio', { name: 'SSH' }).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByRole('radio', { name: 'HTTPS' }));
    expect(repo.switchRemoteProtocol).toHaveBeenCalledWith('https');
  });

  it('does nothing when the current protocol is picked again', () => {
    const { repo } = setup({ remoteProtocol: 'https' });
    render(<ProtocolSwitch />);
    fireEvent.click(screen.getByRole('radio', { name: 'HTTPS' }));
    expect(repo.switchRemoteProtocol).not.toHaveBeenCalled();
  });

  it('ignores a second click while a switch is running', () => {
    const { repo } = setup();
    repo.switchRemoteProtocol.mockReturnValue(new Promise(() => {}));
    render(<ProtocolSwitch />);
    fireEvent.click(screen.getByRole('radio', { name: 'HTTPS' }));
    fireEvent.click(screen.getByRole('radio', { name: 'HTTPS' }));
    expect(repo.switchRemoteProtocol).toHaveBeenCalledTimes(1);
  });

  it('reports a failed switch', async () => {
    const { ui, repo } = setup();
    repo.switchRemoteProtocol.mockRejectedValueOnce(new Error('boom'));
    render(<ProtocolSwitch />);

    fireEvent.click(screen.getByRole('radio', { name: 'HTTPS' }));
    await waitFor(() =>
      expect(ui.addToast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'error',
          title: 'connection.switchFailed',
          message: 'boom',
        }),
      ),
    );
  });

  it.each([
    ['no repository', { repoPath: null }],
    ['a local remote', { remoteProtocol: 'other' as RemoteProtocol }],
    ['no remote', { remoteProtocol: null }],
  ])('is hidden for %s', (_, opts) => {
    setup(opts);
    const { container } = render(<ProtocolSwitch />);
    expect(container.innerHTML).toBe('');
  });
});
