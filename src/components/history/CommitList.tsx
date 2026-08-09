import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRepoStore } from '../../stores/repo-store';
import { useUiStore } from '../../stores/ui-store';
import { relativeTime } from '../../lib/relative-time';
import { ListItem, Badge } from '../../shared/ui';

interface CommitListProps {
  filter: string;
}

export function CommitList({ filter }: CommitListProps) {
  const { i18n } = useTranslation('common');
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

  const parentRef = useRef<HTMLDivElement>(null);
  // useVirtualizer returns a mutable instance the React Compiler lint can't
  // prove stable — expected for this library's designed usage, not a bug.
  // eslint-disable-next-line react-hooks/incompatible-library
  const rowVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56,
    overscan: 12,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();
  const lastIndex = virtualItems.length ? virtualItems[virtualItems.length - 1].index : 0;

  useEffect(() => {
    if (filter || !hasMoreCommits || loadingMoreCommits) return;
    if (filtered.length > 0 && lastIndex >= filtered.length - 1) {
      loadMoreCommits();
    }
  }, [lastIndex, filtered.length, hasMoreCommits, loadingMoreCommits, filter, loadMoreCommits]);

  return (
    <div ref={parentRef} className="overflow-y-auto flex-1">
      <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
        {virtualItems.map(virtualRow => {
          const commit = filtered[virtualRow.index];
          const isSelected = selectedCommit === commit.hash;
          return (
            <div
              key={commit.hash}
              data-index={virtualRow.index}
              ref={rowVirtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <ListItem
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
