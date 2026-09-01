import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useRepoStore } from '../../stores/repo-store';
import { useUiStore } from '../../stores/ui-store';
import { useGitAction } from '../../hooks/use-git-action';
import { gitApi } from '../../api/git-api';
import { Button, Textarea } from '../../shared/ui';

export function CommitForm() {
  const { t } = useTranslation('staging');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const {
    commit,
    status,
    merging,
    hasIdentity: identityKnown,
  } = useRepoStore(
    useShallow(s => ({
      commit: s.commit,
      status: s.status,
      merging: s.merging,
      hasIdentity: s.hasIdentity,
    })),
  );
  const { addToast, openOverlayView } = useUiStore(
    useShallow(s => ({ addToast: s.addToast, openOverlayView: s.openOverlayView })),
  );
  const runAction = useGitAction();

  useEffect(() => {
    if (merging && !message) {
      gitApi
        .getMergeMessage()
        .then(m => {
          if (m) setMessage(m);
        })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merging]);

  const hasStaged = status.staged.length > 0;
  // git refuses outright when neither the repository nor the global config
  // names an author. Catching it here beats letting the user type a message and
  // discover it only after pressing Commit. Unknown (not loaded yet) must never
  // block: only a definite "no" from git means committing would actually fail.
  const hasIdentity = identityKnown !== false;
  const canCommit = message.trim().length > 0 && (hasStaged || merging) && !loading && hasIdentity;

  const handleCommit = async () => {
    if (!canCommit) return;
    setLoading(true);
    try {
      const summary = message.trim().slice(0, 50);
      const ok = await runAction(() => commit(message.trim()), { title: t('commitFailed') });
      if (ok) {
        setMessage('');
        addToast({
          variant: 'success',
          title: t('committed'),
          message: t('commitCreated', { summary }),
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 p-2">
      <div className="relative">
        <Textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleCommit();
          }}
          placeholder={t('commitMessage')}
          rows={3}
        />
        {/* Length is informational only — git imposes no limit, and neither do
            we, so this never turns into a warning. */}
        <span className="absolute bottom-2 right-2 text-xs text-subtext">{message.length}</span>
      </div>
      {!hasIdentity && (
        <div className="flex flex-col gap-1 rounded bg-yellow/10 p-2">
          <p className="text-yellow text-xs">{t('noIdentity')}</p>
          <button
            onClick={() => openOverlayView('settings')}
            className="text-blue text-xs hover:underline self-start"
          >
            {t('noIdentityAction')}
          </button>
        </div>
      )}
      <Button
        variant="primary"
        size="sm"
        fullWidth
        onClick={handleCommit}
        disabled={!canCommit}
        className="py-1.5 font-medium"
      >
        {loading ? '...' : t('commitButton')}
      </Button>
    </div>
  );
}
