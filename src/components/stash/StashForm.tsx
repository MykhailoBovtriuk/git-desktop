import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Textarea } from '../../shared/ui';

interface StashFormProps {
  canStash: boolean;
  onStash: (message: string) => void;
  listMode: boolean;
  onToggle: () => void;
}

export function StashForm({ canStash, onStash, listMode, onToggle }: StashFormProps) {
  const { t } = useTranslation('stash');
  const [message, setMessage] = useState('');

  const handleStash = () => {
    const trimmed = message.trim();
    if (!trimmed) return;
    onStash(trimmed);
    setMessage('');
  };

  if (listMode) return null;

  return (
    <div className="flex flex-col gap-2 p-2 border-t border-surface0 shrink-0">
      <Textarea
        value={message}
        onChange={e => setMessage(e.target.value)}
        placeholder={t('messagePlaceholder')}
        rows={2}
      />
      <div className="flex items-center gap-2">
        <Button
          variant="primary"
          size="sm"
          fullWidth
          disabled={!canStash || !message.trim()}
          onClick={handleStash}
          className="py-1.5 font-medium"
        >
          {t('stash')}
        </Button>
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={false}
          aria-label={t('list')}
          className="flex items-center gap-1.5 shrink-0 text-xs text-subtext hover:text-text transition-colors"
        >
          <span className="relative inline-flex h-3.5 w-6 items-center rounded-full bg-surface2 transition-colors duration-200">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-white shadow-sm translate-x-0.5 transition-transform duration-200" />
          </span>
          {t('list')}
        </button>
      </div>
    </div>
  );
}
