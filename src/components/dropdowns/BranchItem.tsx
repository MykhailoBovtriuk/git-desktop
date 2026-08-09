import { useState, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { MenuItem } from '../../shared/ui';

interface BranchItemProps {
  name: string;
  current: boolean;
  isRemote: boolean;
  contextOpen: boolean;
  onToggleContext: () => void;
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
  onCheckout,
  onMerge,
  onRebase,
  onDelete,
}: BranchItemProps) {
  const { t } = useTranslation('branches');
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!contextOpen || !btnRef.current) {
      setPos(null);
      return;
    }
    const r = btnRef.current.getBoundingClientRect();
    const MENU_W = 176; // w-44
    const MENU_H = 152;
    let left = r.right + 4;
    if (left + MENU_W > window.innerWidth) left = r.left - MENU_W - 4;
    let top = r.top;
    if (top + MENU_H > window.innerHeight) top = window.innerHeight - MENU_H - 8;
    setPos({ top, left });
  }, [contextOpen]);

  return (
    <div className="relative">
      <div className="flex items-center justify-between w-full px-2 py-1.5 rounded hover:bg-surface1 text-sm">
        <button
          onClick={() => !current && onCheckout()}
          className="flex items-center gap-2 flex-1 min-w-0 text-left"
        >
          <span className={isRemote ? 'text-subtext' : 'text-blue'}>{isRemote ? '○' : '●'}</span>
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
      </div>

      {contextOpen &&
        pos &&
        createPortal(
          <div
            onMouseDown={e => e.stopPropagation()}
            className="fixed bg-surface1 rounded-lg shadow-xl z-[60] py-1 w-44"
            style={{ top: pos.top, left: pos.left }}
          >
            <MenuItem onClick={onCheckout}>{t('checkout')}</MenuItem>
            <MenuItem onClick={onMerge}>{t('mergeIntoCurrent')}</MenuItem>
            <MenuItem onClick={onRebase}>{t('rebaseOntoCurrent')}</MenuItem>
            {/* No delete for the checked-out branch — Git refuses it anyway. */}
            {!current && (
              <>
                <div className="border-t border-surface2 my-1" />
                <MenuItem tone="danger" onClick={onDelete}>
                  {isRemote ? t('deleteRemoteBranch') : t('deleteBranch')}
                </MenuItem>
              </>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
