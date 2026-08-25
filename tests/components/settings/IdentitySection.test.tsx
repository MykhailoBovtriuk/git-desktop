// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { IdentitySection } from '../../../src/components/settings/IdentitySection';
import { useRepoStore } from '../../../src/stores/repo-store';
import { useUiStore } from '../../../src/stores/ui-store';
import type { EffectiveIdentity, IdentityScope } from '../../../src/types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => (k === 'error.unknown' ? '' : k) }),
}));
vi.mock('../../../src/stores/repo-store', () => ({
  useRepoStore: vi.fn(),
  CheckoutConflictError: class extends Error {},
}));
vi.mock('../../../src/stores/ui-store', () => ({ useUiStore: vi.fn() }));

const identityOf = (scope: IdentityScope): EffectiveIdentity => ({
  name: scope === 'local' ? 'Local Name' : 'Global Name',
  email: scope === 'local' ? 'local@repo.com' : 'global@me.com',
  origin: scope === 'local' ? '/repo/.git/config' : '/home/u/.gitconfig',
  scope,
  signingKey: null,
  signCommits: false,
  inherited:
    scope === 'local'
      ? {
          name: 'Global Name',
          email: 'global@me.com',
          origin: '/home/u/.gitconfig',
          scope: 'global',
        }
      : null,
});

function setup(scope: IdentityScope) {
  const setIdentity = vi.fn().mockResolvedValue(undefined);
  const setGlobalIdentity = vi.fn().mockResolvedValue(undefined);
  const clearIdentity = vi.fn().mockResolvedValue(undefined);
  const repoState = {
    repoPath: '/repo',
    identity: identityOf(scope),
    setIdentity,
    setGlobalIdentity,
    clearIdentity,
  };
  vi.mocked(useRepoStore).mockImplementation(((sel: any) => sel(repoState)) as any);
  vi.mocked(useUiStore).mockImplementation(((sel: any) => sel({ addToast: vi.fn() })) as any);
  return { setIdentity, setGlobalIdentity, clearIdentity };
}

const segment = (label: string) => screen.getByRole('radio', { name: label });

describe('IdentitySection', () => {
  beforeEach(() => vi.clearAllMocks());

  // The switch must never be able to disagree with git: its position is read
  // from the resolved scope, not kept in component state.
  it('reflects a repository override in the switch position', () => {
    setup('local');
    render(<IdentitySection />);
    expect(segment('identity.source.local')).toHaveAttribute('aria-checked', 'true');
    expect(segment('identity.source.global')).toHaveAttribute('aria-checked', 'false');
  });

  it('reflects an inherited identity in the switch position', () => {
    setup('global');
    render(<IdentitySection />);
    expect(segment('identity.source.global')).toHaveAttribute('aria-checked', 'true');
  });

  it('shows only the identity that is in effect', () => {
    setup('local');
    render(<IdentitySection />);
    expect(screen.getByText(/Local Name/)).toBeInTheDocument();
    // The other one is a switch away, not a second block on screen.
    expect(screen.queryByText(/Global Name/)).toBeNull();
  });

  it('switching to Global drops the repository override', async () => {
    const { clearIdentity } = setup('local');
    render(<IdentitySection />);
    fireEvent.click(segment('identity.source.global'));
    await waitFor(() => expect(clearIdentity).toHaveBeenCalledOnce());
  });

  it('switching to the active position does nothing', () => {
    const { clearIdentity } = setup('global');
    render(<IdentitySection />);
    fireEvent.click(segment('identity.source.global'));
    expect(clearIdentity).not.toHaveBeenCalled();
  });

  // Switching to a repository override opens a prefilled form rather than
  // writing anything: there is no value to write yet.
  it('switching to This repository opens a form prefilled from the current identity', () => {
    const { setIdentity } = setup('global');
    render(<IdentitySection />);
    fireEvent.click(segment('identity.source.local'));

    expect(setIdentity).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue('Global Name')).toBeInTheDocument();
    expect(screen.getByDisplayValue('global@me.com')).toBeInTheDocument();
  });

  it('saves to the global config while the switch is on Global', async () => {
    const { setGlobalIdentity, setIdentity } = setup('global');
    render(<IdentitySection />);
    fireEvent.click(screen.getByText('common:edit'));
    fireEvent.change(screen.getByDisplayValue('global@me.com'), {
      target: { value: 'new@me.com' },
    });
    fireEvent.click(screen.getByText('common:save'));

    await waitFor(() =>
      expect(setGlobalIdentity).toHaveBeenCalledWith('Global Name', 'new@me.com'),
    );
    expect(setIdentity).not.toHaveBeenCalled();
  });

  it('saves to the repository while the switch is on This repository', async () => {
    const { setGlobalIdentity, setIdentity } = setup('local');
    render(<IdentitySection />);
    fireEvent.click(screen.getByText('common:edit'));
    fireEvent.click(screen.getByText('common:save'));

    await waitFor(() => expect(setIdentity).toHaveBeenCalledWith('Local Name', 'local@repo.com'));
    expect(setGlobalIdentity).not.toHaveBeenCalled();
  });
});
