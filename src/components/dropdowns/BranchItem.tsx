import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ContextMenu,
  DropdownRow,
  IconButton,
  MenuItem,
  MoreIcon,
  TruncatedText,
} from '../../shared/ui';

interface BranchItemProps {
  name: string;
  current: boolean;
  isRemote: boolean;
  contextOpen: boolean;
  onToggleContext: () => void;
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
          <span className={current ? 'text-blue' : 'text-subtext'}>{isRemote ? '○' : '●'}</span>
          <TruncatedText className="text-text max-w-40">{name}</TruncatedText>
        </button>
        {current && <span className="text-blue text-xs">✓</span>}
        <IconButton
          ref={btnRef}
          icon={MoreIcon}
          size="sm"
          onClick={e => {
            e.stopPropagation();
            onToggleContext();
          }}
          className="ml-2"
          aria-label={t('moreActions')}
        />
      </DropdownRow>

      <ContextMenu open={contextOpen} anchorRef={btnRef}>
        <MenuItem onClick={onCheckout}>{t('checkout')}</MenuItem>
        {onPull && (
          <MenuItem onClick={onPull}>
            <span>{t('sync:pull')}</span>
            {behind > 0 && <span className="text-subtext">↓{behind}</span>}
          </MenuItem>
        )}
        {onPush && (
          <MenuItem onClick={onPush}>
            <span>{t('sync:push')}</span>
            {ahead > 0 && <span className="text-blue">↑{ahead}</span>}
          </MenuItem>
        )}
        {onPublish && <MenuItem onClick={onPublish}>{t('sync:publishBranch')}</MenuItem>}
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
