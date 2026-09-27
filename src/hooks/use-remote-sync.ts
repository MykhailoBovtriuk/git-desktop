import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useRepoStore } from '../stores/repo-store';
import { useUiStore } from '../stores/ui-store';
import { useAccountStore } from '../stores/account-store';
import { classifyGitError } from '../lib/git-error-mapper';
import { errorMessage } from '../lib/error-message';

export type SyncOp = 'fetch' | 'pull' | 'push' | 'publish';

export function useRemoteSync() {
  const { t } = useTranslation(['sync', 'footer']);
  const { currentBranch, remoteHost, remoteProtocol, fetch, pull, push, publishBranch } =
    useRepoStore(
      useShallow(s => ({
        currentBranch: s.currentBranch,
        remoteHost: s.remoteHost,
        remoteProtocol: s.remoteProtocol,
        fetch: s.fetch,
        pull: s.pull,
        push: s.push,
        publishBranch: s.publishBranch,
      })),
    );
  const addToast = useUiStore(s => s.addToast);
  const openSignIn = useAccountStore(s => s.openSignIn);
  const [loading, setLoading] = useState<SyncOp | null>(null);
  // The toast's Publish action calls run from an older render, whose `loading`
  // may be stale; the ref sees the operation that is really in flight.
  const inFlight = useRef(false);
  // A token only ever reaches an https remote. Offering to sign in for an ssh
  // one — or for no remote at all — is an offer that cannot be kept.
  const signInHost = remoteProtocol === 'https' ? remoteHost : null;

  const actions: Record<SyncOp, () => Promise<unknown>> = {
    fetch,
    pull,
    push,
    publish: publishBranch,
  };

  const run = async (op: SyncOp): Promise<void> => {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(op);
    const label = op === 'publish' ? t('publishBranch') : t(op);
    try {
      const result = await actions[op]();
      const msg =
        op === 'pull' && typeof result === 'string' ? result : t('success', { op: label });
      addToast({ variant: 'success', title: label, message: msg });
    } catch (err: unknown) {
      const raw = errorMessage(err);
      const { kind, action: errAction } = classifyGitError(err);
      const friendly = t(`footer:error.${kind}`);
      addToast({
        variant: 'error',
        title: t('failed', { op: label }),
        message: friendly || raw,
        // Publishing is often the first contact with authentication, so it
        // gets the same offers as the other three.
        action:
          errAction === 'publishBranch' && currentBranch && op !== 'publish'
            ? { label: t('publishBranch'), onClick: () => void run('publish') }
            : errAction === 'signIn' && signInHost
              ? { label: t('footer:signIn'), onClick: () => void openSignIn(signInHost) }
              : undefined,
      });
    } finally {
      inFlight.current = false;
      setLoading(null);
    }
  };

  return { run, loading };
}
