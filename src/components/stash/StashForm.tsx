import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Switch, Textarea } from '../../shared/ui';

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
          {t('stashStaged')}
        </Button>
        <Switch checked={false} onToggle={onToggle} label={t('list')} className="shrink-0" />
      </div>
    </div>
  );
}
