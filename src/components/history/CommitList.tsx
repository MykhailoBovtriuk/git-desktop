import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useRepoStore } from '../../stores/repo-store';
import { useUiStore } from '../../stores/ui-store';
import { relativeTime } from '../../lib/relative-time';
import type { Commit } from '../../types';
import { ListItem, Badge } from '../../shared/ui';

interface CommitListProps {
  filter: string;
}

export function CommitList({ filter }: CommitListProps) {
  const { t, i18n } = useTranslation('common');
  const { commits, hasMoreCommits, loadingMoreCommits, loadMoreCommits } = useRepoStore(
    useShallow(s => ({
      commits: s.commits,
      hasMoreCommits: s.hasMoreCommits,
      loadingMoreCommits: s.loadingMoreCommits,
      loadMoreCommits: s.loadMoreCommits,
    })),
  );
  const { selectedCommit, setSelectedCommit } = useUiStore(
    useShallow(s => ({ selectedCommit: s.selectedCommit, setSelectedCommit: s.setSelectedCommit })),
  );

  const filtered = filter
    ? commits.filter(
        c =>
          c.message.toLowerCase().includes(filter.toLowerCase()) ||
          c.abbreviatedHash.includes(filter),
      )
    : commits;

  return (
    <div className="overflow-y-auto flex-1">
      {filtered.map((commit: Commit) => {
        const isSelected = selectedCommit === commit.hash;
        return (
          <ListItem
            key={commit.hash}
            selected={isSelected}
            onClick={() => setSelectedCommit(isSelected ? null : commit.hash)}
            className="px-3 py-2 border-b border-surface0"
          >
            <p className="text-text text-xs truncate">{commit.message}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-subtext text-xs">{commit.author}</span>
              <span className="text-subtext text-xs">·</span>
              <span className="text-subtext text-xs">
                {relativeTime(commit.date, i18n.language)}
              </span>
            </div>
            {commit.refs.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {commit.refs.slice(0, 3).map(ref => (
                  <Badge key={ref} variant="ref">
                    {ref.replace('HEAD -> ', '').slice(0, 20)}
                  </Badge>
                ))}
              </div>
            )}
          </ListItem>
        );
      })}

      {/* Load more only when not filtering — the filter is client-side over the
          commits already loaded, so paging under a filter would be confusing. */}
      {!filter && hasMoreCommits && (
        <button
          onClick={loadMoreCommits}
          disabled={loadingMoreCommits}
          className="w-full px-3 py-2 text-xs text-blue hover:bg-surface0 disabled:opacity-50"
        >
          {loadingMoreCommits ? t('loadingMore') : t('loadMore')}
        </button>
      )}
    </div>
  );
}
