// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { GitIdentities } from '../../../src/types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, string>) => (o?.who ? `${k}: ${o.who}` : k),
  }),
}));
const api = vi.hoisted(() => ({ getIdentity: vi.fn(), setIdentity: vi.fn() }));
vi.mock('../../../src/api/git-api', () => ({ gitApi: api }));

const { GitIdentitySection } = await import('../../../src/components/settings/GitIdentitySection');
const { useRepoStore } = await import('../../../src/stores/repo-store');

const loadIdentity = vi.fn().mockResolvedValue(undefined);

function setup(identities: GitIdentities, repoPath: string | null = '/work/app') {
  api.getIdentity.mockResolvedValue(identities);
  api.setIdentity.mockResolvedValue(null);
  useRepoStore.setState({ repoPath, loadIdentity } as never);
  return render(<GitIdentitySection />);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GitIdentitySection', () => {
  it('saves the global author and refreshes the commit form’s check', async () => {
    setup({ global: { name: '', email: '' }, local: { name: '', email: '' } });
    const name = await screen.findByLabelText('identity.name');
    expect(screen.getByText('identity.missing')).toBeInTheDocument();
    const save = screen.getByRole('button', { name: 'identity.save' });
    expect(save).toBeDisabled();

    fireEvent.change(name, { target: { value: 'Ada' } });
    fireEvent.change(screen.getByLabelText('identity.email'), {
      target: { value: 'ada@example.com' },
    });
    api.getIdentity.mockResolvedValue({
      global: { name: 'Ada', email: 'ada@example.com' },
      local: { name: '', email: '' },
    });
    fireEvent.click(save);

    await waitFor(() => expect(loadIdentity).toHaveBeenCalled());
    expect(api.setIdentity).toHaveBeenCalledTimes(1);
    expect(api.setIdentity).toHaveBeenCalledWith('global', {
      name: 'Ada',
      email: 'ada@example.com',
    });
  });

  it('sets a repository override and shows it as the next commit’s author', async () => {
    setup({ global: { name: 'Ada', email: 'ada@home.example' }, local: { name: '', email: '' } });
    fireEvent.click(await screen.findByRole('switch', { name: 'identity.override' }));
    const emails = screen.getAllByLabelText('identity.email');
    fireEvent.change(emails[1], { target: { value: 'ada@work.example' } });
    expect(screen.getByText('identity.effective: Ada <ada@work.example>')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'identity.save' }));
    await waitFor(() =>
      expect(api.setIdentity).toHaveBeenCalledWith('local', {
        name: '',
        email: 'ada@work.example',
      }),
    );
  });

  it('turning the override off unsets it', async () => {
    setup({
      global: { name: 'Ada', email: 'ada@home.example' },
      local: { name: '', email: 'ada@work.example' },
    });
    const toggle = await screen.findByRole('switch', { name: 'identity.override' });
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(toggle);
    fireEvent.click(screen.getByRole('button', { name: 'identity.save' }));
    await waitFor(() =>
      expect(api.setIdentity).toHaveBeenCalledWith('local', { name: '', email: '' }),
    );
  });

  it('offers no override without an open repository', async () => {
    setup({ global: { name: 'Ada', email: 'a@b.c' }, local: null }, null);
    await screen.findByLabelText('identity.name');
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });
});
