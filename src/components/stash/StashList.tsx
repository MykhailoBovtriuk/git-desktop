import { useTranslation } from 'react-i18next';
import type { StashEntry } from '../../types';
import { relativeTime } from '../../lib/relative-time';
import { ListItem, IconButton } from '../../shared/ui';

interface StashListProps {
  stashes: StashEntry[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  onApply: (index: number) => void;
  onPop: (index: number) => void;
  onDrop: (index: number) => void;
}

export function StashList({
  stashes, selectedIndex,
  onSelect, onApply, onPop, onDrop,
}: StashListProps) {
  const { t } = useTranslation('stash');

  const handleDrop = (index: number) => {
    if (window.confirm(t('dropConfirm', { index }))) onDrop(index);
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {stashes.length === 0 && (
        <p className="text-subtext text-xs text-center py-6">{t('noStashes')}</p>
      )}
      {stashes.map(s => (
        <ListItem
          key={s.index}
          selected={selectedIndex === s.index}
          onClick={() => onSelect(s.index)}
          className="group px-3 py-2 border-b border-surface0"
        >
          <div className="flex items-start justify-between gap-1">
            <div className="min-w-0">
              <div className="text-text text-xs truncate">{s.message}</div>
              <p className="text-subtext text-xs mt-0.5">
                {s.branch && <>{s.branch} · </>}
                {relativeTime(s.date)}
              </p>
            </div>
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <IconButton tint="blue" title={t('actions.apply')} onClick={e => { e.stopPropagation(); onApply(s.index); }}>📋</IconButton>
              <IconButton tint="green" title={t('actions.pop')} onClick={e => { e.stopPropagation(); onPop(s.index); }}>↩</IconButton>
              <IconButton tint="red" title={t('actions.drop')} onClick={e => { e.stopPropagation(); handleDrop(s.index); }}>✕</IconButton>
            </div>
          </div>
        </ListItem>
      ))}
    </div>
  );
}
