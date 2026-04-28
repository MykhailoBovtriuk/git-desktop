import { useRepoStore } from '../../stores/repo-store';
import { useUiStore } from '../../stores/ui-store';
import type { Commit } from '../../types';

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

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
          <div
            key={commit.hash}
            onClick={() => setSelectedCommit(isSelected ? null : commit.hash)}
            className={`px-3 py-2 cursor-pointer border-b border-surface0 border-l-2 transition-colors ${
              isSelected ? 'bg-surface1 border-blue' : 'border-transparent hover:bg-surface0'
            }`}
          >
            <p className="text-text text-xs truncate">{commit.message.slice(0, 60)}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-subtext text-xs">{commit.author}</span>
              <span className="text-subtext text-xs">·</span>
              <span className="text-subtext text-xs">{relativeTime(commit.date)}</span>
            </div>
            {commit.refs.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {commit.refs.slice(0, 3).map(ref => (
                  <span key={ref} className="bg-surface0 text-blue text-xs px-1 rounded">
                    {ref.replace('HEAD -> ', '').slice(0, 20)}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
