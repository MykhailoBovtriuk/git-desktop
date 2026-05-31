import { useRepoStore } from '../../stores/repo-store';
import { useUiStore } from '../../stores/ui-store';
import { relativeTime } from '../../lib/relative-time';
import type { Commit } from '../../types';
import { ListItem, Badge } from '../../shared/ui';

interface CommitListProps {
  filter: string;
}

export function CommitList({ filter }: CommitListProps) {
  const { commits } = useRepoStore();
  const { selectedCommit, setSelectedCommit } = useUiStore();

  const filtered = filter
    ? commits.filter(c =>
        c.message.toLowerCase().includes(filter.toLowerCase()) ||
        c.abbreviatedHash.includes(filter)
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
              <span className="text-subtext text-xs">{relativeTime(commit.date)}</span>
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
    </div>
  );
}
