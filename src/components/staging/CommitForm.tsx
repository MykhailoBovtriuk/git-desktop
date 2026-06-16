import { useState, useEffect } from 'react';
import { useRepoStore } from '../../stores/repo-store';
import { useUiStore } from '../../stores/ui-store';
import { gitApi } from '../../api/git-api';
import { Button, Textarea } from '../../shared/ui';

export function CommitForm() {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const { commit, status, merging } = useRepoStore();
  const { addToast } = useUiStore();

  // While a merge is in progress, prefill git's default merge message once.
  useEffect(() => {
    if (merging && !message) {
      gitApi.getMergeMessage().then(m => { if (m) setMessage(m); }).catch(() => {});
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
      await commit(message.trim());
      setMessage('');
      addToast({ variant: 'success', title: 'Committed', message: `Created commit: ${message.trim().slice(0, 50)}` });
    } catch (err: unknown) {
      addToast({ variant: 'error', title: 'Commit failed', message: err instanceof Error ? err.message : String(err) });
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
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleCommit(); }}
          placeholder="Commit message"
          rows={3}
        />
        <span className={`absolute bottom-2 right-2 text-xs ${overLimit ? 'text-red' : 'text-subtext'}`}>
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
        {loading ? '...' : 'Commit'}
      </Button>
    </div>
  );
}
