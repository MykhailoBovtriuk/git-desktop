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
  const { commit, status, merging } = useRepoStore(
    useShallow(s => ({ commit: s.commit, status: s.status, merging: s.merging })),
  );
  const { addToast } = useUiStore(useShallow(s => ({ addToast: s.addToast })));
  const runAction = useGitAction();

  // While a merge is in progress, prefill git's default merge message once.
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
  // During a merge, committing concludes it even with nothing extra staged.
  const canCommit = message.trim().length > 0 && (hasStaged || merging) && !loading;
  const overLimit = message.length > 100;

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
        <span
          className={`absolute bottom-2 right-2 text-xs ${overLimit ? 'text-red' : 'text-subtext'}`}
        >
          {message.length}/100
        </span>
      </div>
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
