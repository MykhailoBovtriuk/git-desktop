import { useTranslation } from 'react-i18next';
import type { StashEntry } from '../../types';
import { relativeTime } from '../../lib/relative-time';
<<<<<<< Updated upstream
import { ListItem, IconButton } from '../../shared/ui';
=======
import { Button, ListItem, IconButton } from '../../shared/ui';
>>>>>>> Stashed changes

interface StashListProps {
  stashes: StashEntry[];
  selectedIndex: number | null;
<<<<<<< Updated upstream
=======
  canSave: boolean;
>>>>>>> Stashed changes
  onSelect: (index: number) => void;
  onApply: (index: number) => void;
  onPop: (index: number) => void;
  onDrop: (index: number) => void;
<<<<<<< Updated upstream
}

export function StashList({
  stashes, selectedIndex,
  onSelect, onApply, onPop, onDrop,
=======
  onSave: () => void;
}

export function StashList({
  stashes, selectedIndex, canSave,
  onSelect, onApply, onPop, onDrop, onSave,
>>>>>>> Stashed changes
}: StashListProps) {
  const { t } = useTranslation('stash');

  const handleDrop = (index: number) => {
    if (window.confirm(t('dropConfirm', { index }))) onDrop(index);
  };

  return (
<<<<<<< Updated upstream
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
=======
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto min-h-0">
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
                <IconButton
                  tint="blue"
                  title={t('actions.apply')}
                  onClick={e => { e.stopPropagation(); onApply(s.index); }}
                >
                  📋
                </IconButton>
                <IconButton
                  tint="green"
                  title={t('actions.pop')}
                  onClick={e => { e.stopPropagation(); onPop(s.index); }}
                >
                  ↩
                </IconButton>
                <IconButton
                  tint="red"
                  title={t('actions.drop')}
                  onClick={e => { e.stopPropagation(); handleDrop(s.index); }}
                >
                  ✕
                </IconButton>
              </div>
            </div>
          </ListItem>
        ))}
      </div>
      <div className="p-2 border-t border-surface0 shrink-0">
        <Button
          variant="surface"
          size="sm"
          fullWidth
          disabled={!canSave}
          onClick={onSave}
        >
          + {t('stashChanges')}
        </Button>
      </div>
>>>>>>> Stashed changes
    </div>
  );
}
