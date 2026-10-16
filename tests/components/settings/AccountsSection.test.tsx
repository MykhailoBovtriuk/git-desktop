// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AccountsSection } from '../../../src/components/settings/AccountsSection';
import { useAccountStore } from '../../../src/stores/account-store';
import { accountApi } from '../../../src/api/account-api';
import { useRepoStore } from '../../../src/stores/repo-store';
import type { ProviderAccount } from '../../../src/types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));
vi.mock('../../../src/stores/account-store', () => ({ useAccountStore: vi.fn() }));
vi.mock('../../../src/stores/repo-store', () => ({ useRepoStore: vi.fn() }));
vi.mock('../../../src/api/account-api', () => ({
  accountApi: { credentialHelpers: vi.fn() },
}));

const helpers = vi.mocked(accountApi.credentialHelpers);

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
} = {}) {
  const beginSignIn = vi.fn();
  const signOut = vi.fn().mockResolvedValue(undefined);
  const state = { accounts, persistent, beginSignIn, signOut };
  vi.mocked(useAccountStore).mockImplementation(((sel: any) => sel(state)) as any);
  vi.mocked(useRepoStore).mockImplementation(((sel: any) => sel({ repoPath })) as any);
  return { beginSignIn, signOut };
}

const radios = () => screen.getAllByRole('radio') as HTMLInputElement[];

describe('AccountsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    helpers.mockResolvedValue([]);
  });

  it('asks for a repository first: accounts belong to one', () => {
    setup({ repoPath: null });
    render(<AccountsSection />);
    expect(screen.getByText('section.noRepo')).toBeTruthy();
    expect(screen.queryByRole('radio')).toBeNull();
  });

  it('signs the open repository in to the picked service', () => {
    const { beginSignIn } = setup();
    render(<AccountsSection />);

    expect(screen.getByRole('radio', { name: 'GitHub' })).toBeChecked();
    expect(radios().every(r => !r.disabled)).toBe(true);
    fireEvent.click(screen.getByText('service.signIn'));
    expect(beginSignIn).toHaveBeenCalledWith('github', REPO);
  });

  it.each([
    ['GitHub', 'Enterprise', 'github', 'github-enterprise'],
    ['GitLab', 'Self-Managed', 'gitlab', 'gitlab-self'],
    ['Bitbucket', 'Data Center', 'bitbucket', 'bitbucket-server'],
    ['Azure DevOps', 'Server', 'azure-devops', 'azure-devops-server'],
  ])('offers %s and its %s edition', (name, edition, cloud, self) => {
    const { beginSignIn } = setup();
    render(<AccountsSection />);

    fireEvent.click(screen.getByRole('radio', { name }));
    fireEvent.click(screen.getByText('service.signIn'));
    expect(beginSignIn).toHaveBeenLastCalledWith(cloud, REPO);

    fireEvent.click(screen.getByRole('checkbox', { name: edition }));
    fireEvent.click(screen.getByText('service.signIn'));
    expect(beginSignIn).toHaveBeenLastCalledWith(self, REPO);
  });

  it('has no checkbox for another Git server', () => {
    const { beginSignIn } = setup();
    render(<AccountsSection />);

    expect(screen.queryByRole('radio', { name: /Gitea/ })).toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: 'service.other' }));
    expect(screen.queryByRole('checkbox')).toBeNull();
    fireEvent.click(screen.getByText('service.signInOther'));
    expect(beginSignIn).toHaveBeenCalledWith('token', REPO);
  });

  it('locks the choice on the service the repository is signed in to', () => {
    setup({ accounts: [account('gitlab.acme.com', 'joe', 'gitlab-self')] });
    render(<AccountsSection />);

    expect(screen.getByRole('radio', { name: 'GitLab' })).toBeChecked();
    expect(radios().every(r => r.disabled)).toBe(true);
    const box = screen.getByRole('checkbox', { name: 'Self-Managed' });
    expect(box).toBeChecked();
    expect(box).toBeDisabled();
    expect(screen.getByText('@joe · gitlab.acme.com')).toBeTruthy();
    expect(screen.queryByText('service.signIn')).toBeNull();
  });

  it("ignores other repositories' accounts", () => {
    setup({ accounts: [account('github.com', 'octocat', 'github', '/src/other')] });
    render(<AccountsSection />);

    expect(screen.queryByText('@octocat')).toBeNull();
    expect(radios().every(r => !r.disabled)).toBe(true);
  });

  it('signs this repository out', () => {
    const { signOut } = setup({ accounts: [account('github.com', 'octocat')] });
    render(<AccountsSection />);

    expect(screen.getByText('@octocat')).toBeTruthy();
    fireEvent.click(screen.getByText('section.signOut'));
    expect(signOut).toHaveBeenCalledWith(REPO);
  });

  it('lists the credential helpers git already has', async () => {
    helpers.mockResolvedValue([
      { url: null, helper: 'osxkeychain', scope: 'global', cli: null },
      { url: 'https://github.com', helper: '!gh auth git-credential', scope: 'global', cli: 'gh' },
    ]);
    setup();
    render(<AccountsSection />);

    expect(await screen.findByText('osxkeychain')).toBeTruthy();
    expect(screen.getByText('system.cli.gh')).toBeTruthy();
    expect(screen.getByText('system.forAll')).toBeTruthy();
  });

  it('says so when git has no credential helper', async () => {
    setup();
    render(<AccountsSection />);
    expect(await screen.findByText('system.none')).toBeTruthy();
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
});
