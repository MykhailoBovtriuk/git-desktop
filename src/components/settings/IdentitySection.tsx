import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useRepoStore } from '../../stores/repo-store';
import { useGitAction } from '../../hooks/use-git-action';
import { Button, SegmentedControl, TextInput } from '../../shared/ui';

type Source = 'global' | 'local';

export function IdentitySection() {
  const { t } = useTranslation('settings');
  const { repoPath, identity, setIdentity, setGlobalIdentity, clearIdentity } = useRepoStore(
    useShallow(s => ({
      repoPath: s.repoPath,
      identity: s.identity,
      setIdentity: s.setIdentity,
      setGlobalIdentity: s.setGlobalIdentity,
      clearIdentity: s.clearIdentity,
    })),
  );
  const runAction = useGitAction();
  const [editing, setEditing] = useState<Source | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  // Derived from git, never stored: a remembered switch position could disagree
  // with the config, which is the whole class of bug this section exists to fix.
  const source: Source = identity?.scope === 'local' ? 'local' : 'global';

  const openForm = (target: Source) => {
    // Prefilled so switching to a repository override means editing one field,
    // not retyping the whole identity.
    setName(identity?.name ?? '');
    setEmail(identity?.email ?? '');
    setEditing(target);
  };

  const switchTo = async (next: Source) => {
    if (next === source) return;
    if (next === 'local') {
      openForm('local');
      return;
    }
    const inherited = identity?.inherited;
    await runAction(() => clearIdentity(), {
      title: t('identity.title'),
      success: inherited?.email
        ? t('identity.nowCommittingAs', { name: inherited.name, email: inherited.email })
        : t('identity.cleared'),
    });
  };

  const save = async () => {
    const write = editing === 'global' ? setGlobalIdentity : setIdentity;
    const ok = await runAction(() => write(name.trim(), email.trim()), {
      title: t('identity.title'),
      success: editing === 'global' ? t('identity.savedGlobal') : t('identity.savedLocal'),
    });
    if (ok) setEditing(null);
  };

  const options = [
    { value: 'global' as const, label: t('identity.source.global') },
    { value: 'local' as const, label: t('identity.source.local') },
  ];

  return (
    <div className="flex flex-col gap-3">
      {repoPath && (
        <SegmentedControl
          label={t('identity.title')}
          value={source}
          options={options}
          onChange={switchTo}
          className="self-start"
        />
      )}

      {identity?.scope === 'none' ? (
        <p className="text-yellow text-xs">{t('identity.missing')}</p>
      ) : (
        <div className="bg-mantle rounded p-3 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-text text-sm truncate">
              {identity?.name} <span className="text-subtext">&lt;{identity?.email}&gt;</span>
            </p>
            {identity?.origin && (
              <p className="text-subtext text-xs font-mono truncate mt-0.5">{identity.origin}</p>
            )}
          </div>
          <button
            onClick={() => openForm(source)}
            className="text-blue text-xs hover:underline shrink-0"
          >
            {t('common:edit')}
          </button>
        </div>
      )}

      {editing && (
        <div className="flex flex-col gap-2">
          <p className="text-subtext text-xs">
            {editing === 'global' ? t('identity.editingGlobal') : t('identity.editingLocal')}
          </p>
          <TextInput
            variant="modal"
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={t('identity.namePlaceholder')}
          />
          <TextInput
            variant="modal"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder={t('identity.emailPlaceholder')}
          />
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              disabled={!name.trim() || !email.trim()}
              onClick={save}
            >
              {t('common:save')}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setEditing(null)}>
              {t('common:cancel')}
            </Button>
          </div>
        </div>
      )}

      {!editing && <p className="text-subtext text-xs">{t(`identity.hint.${source}`)}</p>}
    </div>
  );
}
