import { create } from 'zustand';
import { accountApi } from '../api/account-api';
import type { ProviderAccount, ProviderId, ProviderOption, SignInPhase } from '../types';
import { errorMessage } from '../lib/error-message';

/**
 * Signed-in accounts, and the sign-in conversation.
 *
 * Not persisted: the main process owns the accounts, because it owns the
 * tokens. A copy here that outlived a sign-out would show a user as connected
 * to a service they can no longer reach.
 */
interface SignInTarget {
  host: string;
  /** Null until the user picks one, for a host no provider claims. */
  providerId: ProviderId | null;
  options: ProviderOption[];
  /** The repository this sign-in was started from, if any. */
  repoPath: string | null;
}

interface AccountState {
  accounts: ProviderAccount[];
  persistent: boolean;
  loaded: boolean;
  phase: SignInPhase | null;
  target: SignInTarget | null;
  error: string | null;
  busy: boolean;
  /**
   * Repositories whose sign-in prompt the user dismissed. In memory on purpose:
   * "not now" is an answer about this session, not a permanent preference.
   */
  dismissedRepos: Set<string>;

  /** The account for the open repository's host, as far as the renderer knows. */
  current: ProviderAccount | null;

  loadAccounts: () => Promise<void>;
  accountFor: (host: string | null) => ProviderAccount | null;
  /** Point `current` at whoever is signed in to this host. */
  refreshCurrent: (host: string | null) => void;
  openSignIn: (host: string, repoPath?: string | null) => Promise<void>;
  chooseProvider: (providerId: ProviderId) => void;
  setHost: (host: string) => void;
  continueWithBrowser: (clientId?: string, clientSecret?: string) => Promise<void>;
  submitToken: (login: string, token: string) => Promise<void>;
  cancelSignIn: () => Promise<void>;
  dismissForRepo: (repoPath: string) => void;
  signOut: (accountId: string) => Promise<void>;
}

export const useAccountStore = create<AccountState>()((set, get) => ({
  accounts: [],
  current: null,
  persistent: true,
  loaded: false,
  phase: null,
  target: null,
  error: null,
  busy: false,
  dismissedRepos: new Set(),

  loadAccounts: async () => {
    const snapshot = await accountApi.list();
    set(s => ({
      accounts: snapshot.accounts,
      persistent: snapshot.persistent,
      loaded: true,
      // A failure reported here came from the browser round trip, which had no
      // IPC call left to throw from. Surface it without clobbering a newer one.
      error: snapshot.error ?? s.error,
      // Arriving accounts mean the flow finished: nothing left to wait for.
      ...(snapshot.error === null && s.phase === 'waiting' && hasHost(snapshot, s.target)
        ? { phase: null, target: null }
        : {}),
      ...(snapshot.error ? { phase: 'error' as const } : {}),
    }));
  },

  accountFor: host => (host ? (get().accounts.find(a => a.host === host) ?? null) : null),

  refreshCurrent: host =>
    set(s => ({ current: host ? (s.accounts.find(a => a.host === host) ?? null) : null })),

  openSignIn: async (host, repoPath = null) => {
    set({ busy: true, error: null });
    try {
      const info = await accountApi.providersFor(host);
      // A host we recognise skips the picker: choosing "GitHub" for github.com
      // is not a decision worth asking about. But recognising a host is not the
      // same as being able to sign in to it — a build with no GitLab client id
      // knows what gitlab.com is and still cannot open a browser flow for it,
      // and sending the user there produced a dialog whose only button failed.
      const offered = info.options.some(o => o.id === info.providerId);
      const onlyToken = info.options.length === 1 && info.options[0]?.id === 'token';
      set({
        target: {
          host,
          providerId: offered ? info.providerId : onlyToken ? 'token' : null,
          options: info.options,
          repoPath,
        },
        phase: offered ? 'browser' : onlyToken ? 'token' : 'choose',
      });
    } catch (err: unknown) {
      set({ phase: 'error', error: errorMessage(err) });
    } finally {
      set({ busy: false });
    }
  },

  chooseProvider: providerId =>
    set(s => ({
      target: s.target ? { ...s.target, providerId } : null,
      phase: providerId === 'token' ? 'token' : 'browser',
    })),

  setHost: host => set(s => ({ target: s.target ? { ...s.target, host } : null })),

  continueWithBrowser: async (clientId, clientSecret) => {
    const target = get().target;
    if (!target?.providerId) return;
    set({ busy: true, error: null });
    try {
      await accountApi.signIn(target.providerId, target.host, clientId, clientSecret);
      // The browser now owns the next step; the answer arrives over
      // 'account:changed', which is why this is a state and not an await.
      set({ phase: 'waiting' });
    } catch (err: unknown) {
      set({ phase: 'error', error: errorMessage(err) });
    } finally {
      set({ busy: false });
    }
  },

  submitToken: async (login, token) => {
    const target = get().target;
    if (!target) return;
    set({ busy: true, error: null });
    try {
      await accountApi.signInWithToken(target.host, login, token, target.repoPath);
      set({ phase: null, target: null });
      await get().loadAccounts();
    } catch (err: unknown) {
      set({ phase: 'error', error: errorMessage(err) });
    } finally {
      set({ busy: false });
    }
  },

  cancelSignIn: async () => {
    set({ phase: null, target: null, error: null });
    await accountApi.cancelSignIn().catch(() => {});
  },

  dismissForRepo: repoPath =>
    set(s => ({ dismissedRepos: new Set(s.dismissedRepos).add(repoPath) })),

  signOut: async accountId => {
    await accountApi.signOut(accountId);
    set(s => ({ current: s.current?.id === accountId ? null : s.current }));
    await get().loadAccounts();
  },
}));

function hasHost(snapshot: { accounts: ProviderAccount[] }, target: SignInTarget | null): boolean {
  return !!target && snapshot.accounts.some(a => a.host === target.host);
}
