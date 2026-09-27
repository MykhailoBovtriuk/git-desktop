import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ContextMenu, DropdownRow, MenuItem } from '../../shared/ui';

interface BranchItemProps {
  name: string;
  current: boolean;
  isRemote: boolean;
  contextOpen: boolean;
  onToggleContext: () => void;
  // Pull and push move HEAD's branch only, so they come for the current one:
  // pull/push once it has an upstream, publish before that.
  onPull?: () => void;
  onPush?: () => void;
  onPublish?: () => void;
  ahead?: number;
  behind?: number;
  onCheckout: () => void;
  onMerge: () => void;
  onRebase: () => void;
  onDelete: () => void;
}

export function BranchItem({
  name,
  current,
  isRemote,
  contextOpen,
  onToggleContext,
  onPull,
  onPush,
  onPublish,
  ahead = 0,
  behind = 0,
  onCheckout,
  onMerge,
  onRebase,
  onDelete,
}: BranchItemProps) {
  const { t } = useTranslation('branches');
  const btnRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="relative">
      <DropdownRow>
        <button
          onClick={() => !current && onCheckout()}
          className="flex items-center gap-2 flex-1 min-w-0 text-left"
        >
          {/* Only the current branch earns the accent — a blue dot on every
              row was an indicator carrying no information. */}
          <span className={current ? 'text-blue' : 'text-subtext'}>{isRemote ? '○' : '●'}</span>
          <span className="text-text truncate max-w-40">{name}</span>
        </button>
        {current && <span className="text-blue text-xs">✓</span>}
        <button
          ref={btnRef}
          onClick={e => {
            e.stopPropagation();
            onToggleContext();
          }}
          className="ml-2 px-1 text-subtext hover:text-text"
          aria-label={t('moreActions')}
        >
          ⋯
        </button>
      </DropdownRow>

      <ContextMenu
        open={contextOpen}
        anchorRef={btnRef}
        height={152 + 28 * [onPull, onPush, onPublish].filter(Boolean).length}
      >
        <MenuItem onClick={onCheckout}>{t('checkout')}</MenuItem>
        {onPull && (
          <MenuItem onClick={onPull}>
            <span className="flex justify-between">
              <span>{t('pull')}</span>
              {behind > 0 && <span className="text-subtext">↓{behind}</span>}
            </span>
          </MenuItem>
        )}
        {onPush && (
          <MenuItem onClick={onPush}>
            <span className="flex justify-between">
              <span>{t('push')}</span>
              {ahead > 0 && <span className="text-blue">↑{ahead}</span>}
            </span>
          </MenuItem>
        )}
        {onPublish && <MenuItem onClick={onPublish}>{t('publishBranch')}</MenuItem>}
        <MenuItem onClick={onMerge}>{t('mergeIntoCurrent')}</MenuItem>
        <MenuItem onClick={onRebase}>{t('rebaseOntoCurrent')}</MenuItem>
        {!current && (
          <>
            <div className="border-t border-surface2 my-1" />
            <MenuItem tone="danger" onClick={onDelete}>
              {isRemote ? t('deleteRemoteBranch') : t('deleteBranch')}
            </MenuItem>
          </>
        )}
      </ContextMenu>
    </div>
  );
}
