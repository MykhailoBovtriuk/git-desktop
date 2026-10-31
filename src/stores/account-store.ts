import { create } from 'zustand';
import { accountApi } from '../api/account-api';
import type {
  AuthSource,
  ProviderAccount,
  ProviderId,
  ProviderOption,
  RemoteProtocol,
  SignInPhase,
} from '../types';
import { errorMessage } from '../lib/error-message';
import { parseServerAddress, type ServerAddressError } from '../lib/server-address';

interface SignInTarget {
  host: string;
  providerId: ProviderId | null;
  options: ProviderOption[];
  repoPath: string;
  existing: ProviderAccount | null;
}

type EndpointError = ServerAddressError | 'mismatch' | 'unreachable';

interface AccountState {
  accounts: ProviderAccount[];
  persistent: boolean;
  loaded: boolean;
  phase: SignInPhase | null;
  target: SignInTarget | null;
  error: string | null;
  endpointError: EndpointError | null;
  busy: boolean;
  dismissedRepos: Set<string>;

  authSource: AuthSource | null;

  loadAccounts: () => Promise<void>;
  accountFor: (repoPath: string | null) => ProviderAccount | null;
  refreshAuthSource: (
    host: string | null,
    protocol: RemoteProtocol | null,
    repoPath: string | null,
  ) => Promise<void>;
  openSignIn: (host: string, repoPath: string) => Promise<void>;
  beginSignIn: (providerId: ProviderId, repoPath: string) => Promise<void>;
  submitEndpoint: (address: string) => Promise<void>;
  chooseProvider: (providerId: ProviderId) => Promise<void>;
  confirmReplace: () => void;
  switchMethod: (method: 'browser' | 'token') => void;
  continueWithBrowser: (clientId?: string, clientSecret?: string) => Promise<void>;
  submitToken: (login: string, token: string) => Promise<void>;
  cancelSignIn: () => Promise<void>;
  dismissForRepo: (repoPath: string) => void;
  signOut: (repoPath: string) => Promise<void>;
  forgetSystemCredential: (host: string) => Promise<void>;
}

const HOSTED_INSTEAD: Partial<Record<ProviderId, { host: string; provider: ProviderId }>> = {
  'github-enterprise': { host: 'github.com', provider: 'github' },
  'gitlab-self': { host: 'gitlab.com', provider: 'gitlab' },
  'bitbucket-server': { host: 'bitbucket.org', provider: 'bitbucket' },
  'azure-devops-server': { host: 'dev.azure.com', provider: 'azure-devops' },
};

function firstMethod(option: ProviderOption | undefined): SignInPhase {
  return option?.configured || option?.needsClientId ? 'browser' : 'token';
}

export const useAccountStore = create<AccountState>()((set, get) => {
  const setTarget = (target: Omit<SignInTarget, 'existing'>, phase?: SignInPhase) => {
    const existing = get().accountFor(target.repoPath);
    set({
      target: { ...target, existing },
      phase:
        phase ??
        (existing ? 'existing' : firstMethod(target.options.find(o => o.id === target.providerId))),
      endpointError: null,
    });
  };

  const proceed = async (providerId: ProviderId, host: string, repoPath: string) => {
    const { options } = await accountApi.providersFor(host);
    setTarget({ host, providerId, options, repoPath });
  };

  const guarded = async (fn: () => Promise<void>, { keepPhase = false } = {}) => {
    set({ busy: true, error: null });
    try {
      await fn();
    } catch (err: unknown) {
      set({ error: errorMessage(err), ...(keepPhase ? {} : { phase: 'error' as const }) });
    } finally {
      set({ busy: false });
    }
  };

  const checkServer = async (providerId: ProviderId, host: string): Promise<boolean> => {
    if (providerId === 'token') return true;
    const answer = await accountApi.probeServer(providerId, host);
    if (answer === 'ok') return true;
    set({ endpointError: answer });
    return false;
  };

  return {
    accounts: [],
    authSource: null,
    persistent: true,
    loaded: false,
    phase: null,
    target: null,
    error: null,
    endpointError: null,
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
        ...(snapshot.error === null && s.phase === 'waiting' && signedIn(snapshot, s)
          ? { phase: null, target: null }
          : {}),
        ...(snapshot.error ? { phase: 'error' as const } : {}),
      }));
    },

    accountFor: repoPath =>
      repoPath ? (get().accounts.find(a => a.repoPath === repoPath) ?? null) : null,

    refreshAuthSource: async (host, protocol, repoPath) => {
      if (!host) {
        set({ authSource: null });
        return;
      }
      const authSource = await accountApi.authSource(host, protocol, repoPath).catch(() => null);
      set({ authSource });
    },

    openSignIn: (host, repoPath) =>
      guarded(async () => {
        const info = await accountApi.providersFor(host);
        if (info.providerId) {
          await proceed(info.providerId, host, repoPath);
          return;
        }
        setTarget({ host, providerId: null, options: info.options, repoPath }, 'choose');
      }),

    beginSignIn: (providerId, repoPath) =>
      guarded(async () => {
        const info = await accountApi.providersFor(null);
        const option = info.options.find(o => o.id === providerId);
        if (!option) throw new Error(`Unknown provider: ${providerId}`);
        if (!option.needsHost && option.defaultHost) {
          await proceed(providerId, option.defaultHost, repoPath);
          return;
        }
        setTarget(
          { host: option.defaultHost ?? '', providerId, options: info.options, repoPath },
          'endpoint',
        );
      }),

    submitEndpoint: address =>
      guarded(async () => {
        const target = get().target;
        if (!target?.providerId) return;
        const parsed = parseServerAddress(address);
        if (parsed.error) {
          set({ endpointError: parsed.error });
          return;
        }
        const hosted = HOSTED_INSTEAD[target.providerId];
        if (hosted && parsed.host === hosted.host) {
          await proceed(hosted.provider, hosted.host, target.repoPath);
          return;
        }
        set({ target: { ...target, host: parsed.host }, endpointError: null });
        if (!(await checkServer(target.providerId, parsed.host))) return;
        await proceed(target.providerId, parsed.host, target.repoPath);
      }),

    chooseProvider: providerId =>
      guarded(async () => {
        const target = get().target;
        if (!target) return;
        set({ target: { ...target, providerId }, endpointError: null });
        if (!(await checkServer(providerId, target.host))) return;
        await proceed(providerId, target.host, target.repoPath);
      }),

    confirmReplace: () =>
      set(s => {
        const option = s.target?.options.find(o => o.id === s.target?.providerId);
        return { phase: firstMethod(option) };
      }),

    switchMethod: method => set({ phase: method, error: null }),

    continueWithBrowser: (clientId, clientSecret) =>
      guarded(async () => {
        const target = get().target;
        if (!target?.providerId) return;
        await accountApi.signIn(
          target.providerId,
          target.host,
          target.repoPath,
          clientId,
          clientSecret,
        );
        // The browser now owns the next step; the answer arrives over
        // 'account:changed', which is why this is a state and not an await.
        set({ phase: 'waiting' });
      }),

    submitToken: async (login, token) => {
      const target = get().target;
      if (!target) return;
      await guarded(
        async () => {
          await accountApi.signInWithToken(
            target.providerId ?? 'token',
            target.host,
            login,
            token,
            target.repoPath,
          );
          set({ phase: null, target: null });
          await get().loadAccounts();
        },
        { keepPhase: true },
      );
    },

    cancelSignIn: async () => {
      set({ phase: null, target: null, error: null, endpointError: null });
      await accountApi.cancelSignIn().catch(() => {});
    },

    dismissForRepo: repoPath =>
      set(s => ({ dismissedRepos: new Set(s.dismissedRepos).add(repoPath) })),

    signOut: async repoPath => {
      await accountApi.signOut(repoPath);
      await get().loadAccounts();
    },

    forgetSystemCredential: async host => {
      await accountApi.forgetSystemCredential(host);
    },
  };
});

function signedIn(
  snapshot: { accounts: ProviderAccount[] },
  s: Pick<AccountState, 'target'>,
): boolean {
  const target = s.target;
  if (!target) return false;
  // A re-sign leaves the list unchanged, so while waiting any account for this
  // repository counts as done.
  return snapshot.accounts.some(a => a.repoPath === target.repoPath);
}
