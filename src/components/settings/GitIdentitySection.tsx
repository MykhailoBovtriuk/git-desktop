import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { gitApi } from '../../api/git-api';
import { useRepoStore } from '../../stores/repo-store';
import { useUiStore } from '../../stores/ui-store';
import { errorMessage } from '../../lib/error-message';
import { basenameFromPath } from '../../lib/basename';
import { Button, Switch, TextInput } from '../../shared/ui';
import type { GitIdentities, GitIdentity } from '../../types';

const EMPTY: GitIdentity = { name: '', email: '' };
const same = (a: GitIdentity, b: GitIdentity) => a.name === b.name && a.email === b.email;
const isSet = (id: GitIdentity | null) => !!id && (!!id.name || !!id.email);

function IdentityFields({
  value,
  onChange,
  idPrefix,
}: {
  value: GitIdentity;
  onChange: (next: GitIdentity) => void;
  idPrefix: string;
}) {
  const { t } = useTranslation('settings');
  return (
    <div className="grid grid-cols-[6rem_1fr] items-center gap-2">
      <label htmlFor={`${idPrefix}-name`} className="text-subtext text-xs">
        {t('identity.name')}
      </label>
      <TextInput
        id={`${idPrefix}-name`}
        variant="modal"
        value={value.name}
        onChange={e => onChange({ ...value, name: e.target.value })}
        placeholder="Ada Lovelace"
      />
      <label htmlFor={`${idPrefix}-email`} className="text-subtext text-xs">
        {t('identity.email')}
      </label>
      <TextInput
        id={`${idPrefix}-email`}
        variant="modal"
        type="email"
        value={value.email}
        onChange={e => onChange({ ...value, email: e.target.value })}
        placeholder="ada@example.com"
      />
    </div>
  );
}

/** Who commits are authored as: git's own config, globally and per repository. */
export function GitIdentitySection() {
  const { t } = useTranslation('settings');
  const repoPath = useRepoStore(s => s.repoPath);
  const addToast = useUiStore(s => s.addToast);
  const [saved, setSaved] = useState<GitIdentities | null>(null);
  const [global, setGlobal] = useState<GitIdentity>(EMPTY);
  const [local, setLocal] = useState<GitIdentity>(EMPTY);
  const [override, setOverride] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    void gitApi
      .getIdentity()
      .then(identities => {
        if (!alive) return;
        setSaved(identities);
        setGlobal(identities.global);
        setLocal(identities.local ?? EMPTY);
        setOverride(isSet(identities.local));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [repoPath]);

  if (!saved) return null;

  const savedLocal = saved.local ?? EMPTY;
  const dirty =
    !same(global, saved.global) ||
    (saved.local !== null && (override ? !same(local, savedLocal) : isSet(saved.local)));

  const save = async () => {
    setSaving(true);
    try {
      if (!same(global, saved.global)) await gitApi.setIdentity('global', global);
      if (saved.local !== null) {
        const nextLocal = override ? local : EMPTY;
        if (!same(nextLocal, savedLocal)) await gitApi.setIdentity('local', nextLocal);
      }
      const fresh = await gitApi.getIdentity();
      setSaved(fresh);
      setGlobal(fresh.global);
      setLocal(fresh.local ?? EMPTY);
      setOverride(isSet(fresh.local));
      // The commit form's "no author" notice reads this.
      await useRepoStore.getState().loadIdentity();
      addToast({ variant: 'success', title: t('identity.title'), message: t('identity.saved') });
    } catch (err) {
      addToast({ variant: 'error', title: t('identity.title'), message: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  // What the next commit here will say, as git resolves it: local over global.
  const effective = override && saved.local !== null ? { ...global, ...pick(local) } : global;

  return (
    <section className="py-4 flex flex-col gap-4">
      <div>
        <h2 className="text-text text-sm font-medium">{t('identity.title')}</h2>
        <p className="text-subtext text-xs mt-0.5 mb-3">{t('identity.hint')}</p>
        <IdentityFields value={global} onChange={setGlobal} idPrefix="identity-global" />
      </div>

      {saved.local !== null && repoPath && (
        <div className="border-t border-surface0 pt-4">
          <Switch
            checked={override}
            onToggle={() => setOverride(v => !v)}
            label={t('identity.override', { repo: basenameFromPath(repoPath) })}
          />
          <p className="text-subtext text-xs mt-1 mb-3">{t('identity.overrideHint')}</p>
          {override && (
            <IdentityFields value={local} onChange={setLocal} idPrefix="identity-local" />
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-4 border-t border-surface0 pt-4">
        <p className="text-subtext text-xs min-w-0 truncate">
          {effective.name || effective.email
            ? t('identity.effective', {
                who: [effective.name, effective.email && `<${effective.email}>`]
                  .filter(Boolean)
                  .join(' '),
              })
            : t('identity.missing')}
        </p>
        <Button size="sm" onClick={() => void save()} disabled={!dirty || saving}>
          {t('identity.save')}
        </Button>
      </div>
    </section>
  );
}

/** Only the fields a repository actually overrides; the rest come from global. */
function pick(id: GitIdentity): Partial<GitIdentity> {
  const out: Partial<GitIdentity> = {};
  if (id.name) out.name = id.name;
  if (id.email) out.email = id.email;
  return out;
}
