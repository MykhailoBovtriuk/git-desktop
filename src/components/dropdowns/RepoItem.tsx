import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ContextMenu, DropdownRow, MenuItem, TruncatedText } from '../../shared/ui';

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

  return (
    <div className="relative">
      <DropdownRow>
        <button onClick={onOpen} className="flex items-center gap-2 flex-1 min-w-0 text-left">
          <TruncatedText className="text-text">{name}</TruncatedText>
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
      </DropdownRow>

      {/* anchor="panel": this dropdown is right-aligned to the titlebar, so a
          button-anchored menu would land on top of the repo list it belongs to. */}
      <ContextMenu open={contextOpen} anchorRef={btnRef} anchor="panel" height={44}>
        <MenuItem tone="danger" onClick={onRemove}>
          {t('removeFromList')}
        </MenuItem>
      </ContextMenu>
    </div>
  );
}
