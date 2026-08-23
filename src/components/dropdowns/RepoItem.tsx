import { useState, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { MenuItem } from '../../shared/ui';

interface RepoItemProps {
  name: string;
  current: boolean;
  contextOpen: boolean;
  onToggleContext: () => void;
  onOpen: () => void;
  onRemove: () => void;
}

export function RepoItem({
  name,
  current,
  contextOpen,
  onToggleContext,
  onOpen,
  onRemove,
}: RepoItemProps) {
  const { t } = useTranslation('repo');
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!contextOpen || !btnRef.current) {
      setPos(null);
      return;
    }
    const r = btnRef.current.getBoundingClientRect();
    const MENU_W = 176;
    const MENU_H = 44;
    // Anchor on the dropdown panel, not the button: this panel is right-aligned
    // to the titlebar, so a menu measured from the button lands on top of the
    // repo list it belongs to. Open to the panel's left, flip right only if
    // there is no room there.
    const panel = btnRef.current.closest('[data-dropdown-panel]')?.getBoundingClientRect() ?? r;
    let left = panel.left - MENU_W - 4;
    if (left < 8) left = panel.right + 4;
    if (left + MENU_W > window.innerWidth) left = window.innerWidth - MENU_W - 8;
    let top = r.top;
    if (top + MENU_H > window.innerHeight) top = window.innerHeight - MENU_H - 8;
    setPos({ top, left });
  }, [contextOpen]);

  return (
    <div className="relative">
      <div className="flex items-center justify-between w-full px-3 py-1.5 hover:bg-surface1 text-sm">
        <button onClick={onOpen} className="flex items-center gap-2 flex-1 min-w-0 text-left">
          <span className="text-text truncate">{name}</span>
        </button>
        {current && <span className="text-blue text-xs ml-2">✓</span>}
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
            <MenuItem tone="danger" onClick={onRemove}>
              {t('removeFromList')}
            </MenuItem>
          </div>,
          document.body,
        )}
    </div>
  );
}
