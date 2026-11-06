import { create } from 'zustand';
import { accountApi } from '../api/account-api';
import type {
  AuthSource,
  ProviderAccount,
  ProviderId,
  ProviderOption,
  RemoteProtocol,
  RepoIdentity,
  RepoTestResult,
  SignInPhase,
} from '../types';
import { errorLogId, errorMessage } from '../lib/error-message';
import { testKey } from '../lib/test-key';

interface SignInTarget {
  host: string;
  providerId: ProviderId | null;
  options: ProviderOption[];
  repoPath: string;
  existing: ProviderAccount | null;
}

type EndpointError = 'mismatch' | 'unreachable';

interface AccountState {
  accounts: ProviderAccount[];
  persistent: boolean;
  loaded: boolean;
  phase: SignInPhase | null;
  target: SignInTarget | null;
  error: string | null;
  errorLogId: string | null;
  endpointError: EndpointError | null;
  busy: boolean;

  authSource: AuthSource | null;
  identity: RepoIdentity | null;
  tests: Record<string, RepoTestResult>;
  testing: Record<string, boolean>;

  loadAccounts: () => Promise<void>;
  accountFor: (repoPath: string | null) => ProviderAccount | null;
  refreshAuthSource: (
    host: string | null,
    protocol: RemoteProtocol | null,
    repoPath: string | null,
  ) => Promise<void>;
  refreshIdentity: (repoPath: string | null) => Promise<void>;
  openSignIn: (host: string, repoPath: string) => Promise<void>;
  chooseProvider: (providerId: ProviderId) => Promise<void>;
  confirmReplace: () => void;
  switchMethod: (method: 'browser' | 'token') => void;
  continueWithBrowser: (clientId?: string, clientSecret?: string) => Promise<void>;
  submitToken: (token: string) => Promise<void>;
  cancelSignIn: () => Promise<void>;
  signOut: (repoPath: string) => Promise<void>;
  forgetSystemCredential: (host: string, repoPath: string | null) => Promise<void>;
  runTest: (repoPath: string, host: string) => Promise<void>;
  clearTest: (repoPath: string, host: string) => void;
}

function firstMethod(option: ProviderOption | undefined): SignInPhase {
  return option?.configured || option?.needsClientId ? 'browser' : 'token';
}

export const useAccountStore = create<AccountState>()((set, get) => {
  let identityRequest = 0;

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
    set({ busy: true, error: null, errorLogId: null });
    try {
      await fn();
    } catch (err: unknown) {
      set({
        error: errorMessage(err),
        errorLogId: errorLogId(err) ?? null,
        ...(keepPhase ? {} : { phase: 'error' as const }),
      });
    } finally {
      set({ busy: false });
    }
  };

  const checkServer = async (providerId: ProviderId, host: string): Promise<boolean> => {
    const answer = await accountApi.probeServer(providerId, host, get().target?.repoPath ?? null);
    if (answer === 'ok') return true;
    set({ endpointError: answer });
    return false;
  };

  return {
    accounts: [],
    authSource: null,
    identity: null,
    tests: {},
    testing: {},
    persistent: true,
    loaded: false,
    phase: null,
    target: null,
    error: null,
    errorLogId: null,
    endpointError: null,
    busy: false,

    loadAccounts: async () => {
      const snapshot = await accountApi.list();
      set(s => ({
        accounts: snapshot.accounts,
        persistent: snapshot.persistent,
        loaded: true,
        // A failure reported here came from the browser round trip, which had no
        // IPC call left to throw from. Surface it without clobbering a newer one.
        error: snapshot.error ?? s.error,
        errorLogId: snapshot.error ? (snapshot.errorLogId ?? null) : s.errorLogId,
        ...(snapshot.error === null && s.phase === 'waiting' && signedIn(snapshot, s)
          ? { phase: null, target: null }
          : {}),
        ...(snapshot.error ? { phase: 'error' as const } : {}),
      }));
    },

    accountFor: repoPath =>
      repoPath ? (get().accounts.find(a => a.repoPath === repoPath) ?? null) : null,

    refreshAuthSource: async (host, protocol, repoPath) => {
      void get().refreshIdentity(host ? repoPath : null);
      if (!host) {
        set({ authSource: null });
        return;
      }
      const authSource = await accountApi.authSource(host, protocol, repoPath).catch(() => null);
      set({ authSource });
    },

    refreshIdentity: async repoPath => {
      const request = ++identityRequest;
      if (!repoPath) {
        set({ identity: null });
        return;
      }
      const identity = await accountApi.identity(repoPath).catch(() => null);
      // ssh -T can take seconds: an older reply must not overwrite a newer one.
      if (request === identityRequest) set({ identity });
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

    switchMethod: method => set({ phase: method, error: null, errorLogId: null }),

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

    submitToken: async token => {
      const target = get().target;
      if (!target?.providerId) return;
      const { providerId } = target;
      await guarded(
        async () => {
          await accountApi.signInWithToken(providerId, target.host, token, target.repoPath);
          set({ phase: null, target: null });
          await get().loadAccounts();
        },
        { keepPhase: true },
      );
    },

    cancelSignIn: async () => {
      set({ phase: null, target: null, error: null, errorLogId: null, endpointError: null });
      await accountApi.cancelSignIn().catch(() => {});
    },

    signOut: async repoPath => {
      await accountApi.signOut(repoPath);
      await get().loadAccounts();
    },

    forgetSystemCredential: async (host, repoPath) => {
      await accountApi.forgetSystemCredential(host, repoPath);
    },

    runTest: async (repoPath, host) => {
      const key = testKey(host, repoPath);
      if (get().testing[key]) return;
      set(s => ({ testing: { ...s.testing, [key]: true } }));
      const result = await accountApi.test(repoPath).catch((err: unknown): RepoTestResult => ({
        host,
        login: null,
        ok: false,
        steps: [
          { step: 'who', ok: false, message: errorMessage(err), logId: errorLogId(err) ?? null },
        ],
        at: Date.now(),
      }));
      set(s => {
        const { [key]: _, ...testing } = s.testing;
        return { testing, tests: { ...s.tests, [key]: result } };
      });
    },

    clearTest: (repoPath, host) =>
      set(s => {
        const { [testKey(host, repoPath)]: _, ...tests } = s.tests;
        return { tests };
      }),
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
