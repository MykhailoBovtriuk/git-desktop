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
  /** The repository this sign-in is for, so the result can be bound to it. */
  repoPath: string | null;
  /** Accounts already on this host, when the question is "which of these?". */
  candidates: ProviderAccount[];
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

  /** The account the open repository is bound to, as far as the renderer knows. */
  current: ProviderAccount | null;

  loadAccounts: () => Promise<void>;
  accountFor: (host: string | null) => ProviderAccount | null;
  /**
   * Decide what to ask about a freshly opened repository: nothing, which of
   * the accounts already on this host, or a full sign-in.
   */
  resolveForRepo: (repoPath: string, host: string) => Promise<void>;
  /**
   * Re-read which account the open repository belongs to, without ever putting
   * a dialog in the way.
   *
   * Signing in finishes in the main process, so the renderer learns about it
   * through `account:changed` — and reloading only the account list left the
   * footer, which shows the repository's own account, still saying nobody was
   * signed in.
   */
  refreshCurrent: (repoPath: string, host: string) => Promise<ProviderAccount[]>;
  chooseAccount: (accountId: string) => Promise<void>;
  /**
   * Reopen the choice for a repository already bound.
   *
   * A binding made silently — the usual case, when only one account existed —
   * would otherwise be unchangeable, and it is wrong exactly when a second
   * account turns up.
   */
  changeAccountForRepo: (repoPath: string, host: string) => Promise<void>;
  openSignIn: (host: string, repoPath?: string | null) => Promise<void>;
  chooseProvider: (providerId: ProviderId) => void;
  setHost: (host: string) => void;
  continueWithBrowser: (clientId?: string, clientSecret?: string) => Promise<void>;
  submitToken: (login: string, token: string) => Promise<void>;
  cancelSignIn: () => Promise<void>;
  dismissForRepo: (repoPath: string) => void;
  /**
   * Drop everything this app remembered about a repository.
   *
   * Removing it from the list is the user saying they are done with it, so the
   * chosen account and the dismissed prompt go too — adding it back later
   * should behave like the first time, not silently reuse an old answer. The
   * token stays: it belongs to the host, and other repositories still need it.
   */
  forgetRepo: (repoPath: string) => Promise<void>;
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

  refreshCurrent: async (repoPath, host) => {
    const { bound, candidates } = await accountApi.forRepo(repoPath, host);
    if (bound) {
      set({ current: bound });
      return [];
    }
    // One account on the host is not a question. Binding it silently is the
    // same answer the user would give, without a dialog in the way.
    if (candidates.length === 1) {
      await accountApi.bind(repoPath, candidates[0].id).catch(() => {});
      set({ current: candidates[0] });
      return [];
    }
    set({ current: null });
    return candidates;
  },

  resolveForRepo: async (repoPath, host) => {
    const candidates = await get().refreshCurrent(repoPath, host);
    // Empty means refreshCurrent settled it: either the repository was already
    // bound, or there was exactly one account to bind it to.
    if (candidates.length === 0 && get().current) return;

    if (candidates.length === 0) {
      await get().openSignIn(host, repoPath);
      return;
    }
    // Two or more: asking beats guessing, and guessing is what silently
    // attributed work to whichever account signed in last.
    const info = await accountApi.providersFor(host);
    set({
      phase: 'pick-account',
      target: { host, providerId: info.providerId, options: info.options, repoPath, candidates },
    });
  },

  changeAccountForRepo: async (repoPath, host) => {
    set({ busy: true, error: null });
    try {
      const [{ candidates }, info] = await Promise.all([
        accountApi.forRepo(repoPath, host),
        accountApi.providersFor(host),
      ]);
      set({
        phase: 'pick-account',
        target: { host, providerId: info.providerId, options: info.options, repoPath, candidates },
      });
    } catch (err: unknown) {
      set({ phase: 'error', error: errorMessage(err) });
    } finally {
      set({ busy: false });
    }
  },

  chooseAccount: async accountId => {
    const target = get().target;
    if (!target?.repoPath) return;
    set({ busy: true });
    try {
      await accountApi.bind(target.repoPath, accountId);
      set({
        phase: null,
        target: null,
        current: get().accounts.find(a => a.id === accountId) ?? null,
      });
    } catch (err: unknown) {
      set({ phase: 'error', error: errorMessage(err) });
    } finally {
      set({ busy: false });
    }
  },

  openSignIn: async (host, repoPath = null) => {
    set({ busy: true, error: null });
    try {
      const info = await accountApi.providersFor(host);
      set({
        target: {
          host,
          providerId: info.providerId,
          options: info.options,
          repoPath,
          candidates: [],
        },
        // A host we recognise skips the picker: choosing "GitHub" for
        // github.com is not a decision worth asking about.
        phase: info.providerId ? 'browser' : 'choose',
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
      await accountApi.signIn(
        target.providerId,
        target.host,
        clientId,
        clientSecret,
        target.repoPath,
      );
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

  forgetRepo: async repoPath => {
    set(s => {
      const dismissedRepos = new Set(s.dismissedRepos);
      dismissedRepos.delete(repoPath);
      return { dismissedRepos, current: null };
    });
    await accountApi.unbind(repoPath).catch(() => {});
  },

  signOut: async accountId => {
    await accountApi.signOut(accountId);
    set(s => ({ current: s.current?.id === accountId ? null : s.current }));
    await get().loadAccounts();
  },
}));

function hasHost(snapshot: { accounts: ProviderAccount[] }, target: SignInTarget | null): boolean {
  return !!target && snapshot.accounts.some(a => a.host === target.host);
}

