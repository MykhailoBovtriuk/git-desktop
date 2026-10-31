import { useTranslation } from 'react-i18next';
import { Button, Switch } from '../../shared/ui';

interface MergeFooterProps {
  sourceBranch: string;
  targetBranch: string;
  remaining: number;
  autoCommit: boolean;
  toggleAutoCommit: () => void;
  onAbort: () => void;
  onSave: () => void;
  saving: boolean;
  saveDisabled: boolean;
}

export function MergeFooter({
  sourceBranch,
  targetBranch,
  remaining,
  autoCommit,
  toggleAutoCommit,
  onAbort,
  onSave,
  saving,
  saveDisabled,
}: MergeFooterProps) {
  const { t } = useTranslation('merge');
  return (
    <div className="h-10 bg-mantle border-t border-surface0 flex items-center justify-between px-3 shrink-0">
      <span className="text-subtext text-xs">
        {t('mergingArrow', { source: sourceBranch, target: targetBranch })}
        {remaining > 0 && (
          <span className="text-red"> {t('remainingConflicts', { count: remaining })}</span>
        )}
      </span>
      <div className="flex items-center gap-3">
        <Switch
          checked={autoCommit}
          onToggle={toggleAutoCommit}
          title={t('autoCommitHint')}
          label={t('autoCommit')}
        />
        <Button variant="danger" size="sm" onClick={onAbort} disabled={saving}>
          {t('abortMerge')}
        </Button>
        <Button size="sm" onClick={onSave} disabled={saveDisabled}>
          {t('saveMarkResolved')}
        </Button>
      </div>
    </div>
  );
}
