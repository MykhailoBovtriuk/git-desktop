import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useRepoStore } from '../../stores/repo-store';
import { useUiStore } from '../../stores/ui-store';
import { useSettingsStore } from '../../stores/settings-store';
import { useGitAction } from '../../hooks/use-git-action';
import { matchProfile } from '../../lib/git-profile';
import { Badge, Button, ListItem } from '../../shared/ui';
import { ProfileEditor } from './ProfileEditor';
import type { GitProfile } from '../../types';

export function ProfileSettings() {
  const { t } = useTranslation('settings');
  const { profiles, saveProfile, deleteProfile } = useSettingsStore(
    useShallow(s => ({
      profiles: s.profiles,
      saveProfile: s.saveProfile,
      deleteProfile: s.deleteProfile,
    })),
  );
  const { repoPath, identity, applyProfile, clearProfile } = useRepoStore(
    useShallow(s => ({
      repoPath: s.repoPath,
      identity: s.identity,
      applyProfile: s.applyProfile,
      clearProfile: s.clearProfile,
    })),
  );
  const requestConfirm = useUiStore(s => s.requestConfirm);
  const runAction = useGitAction();
  const [editing, setEditing] = useState<GitProfile | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);

  const active = matchProfile(identity, profiles);

  const openEditor = (profile: GitProfile | null) => {
    setEditing(profile);
    setEditorOpen(true);
  };

  const handleApply = (profile: GitProfile) =>
    runAction(() => applyProfile(profile), {
      title: t('applyProfile'),
      success: t('applied', { label: profile.label }),
    });

  const handleClear = () =>
    runAction(() => clearProfile(), { title: t('clearProfile'), success: t('cleared') });

  const handleDelete = async (profile: GitProfile) => {
    const ok = await requestConfirm({
      title: t('deleteProfileTitle'),
      message: t('deleteProfileMessage', { label: profile.label }),
      confirmLabel: t('common:delete'),
      danger: true,
    });
    if (ok) deleteProfile(profile.id);
  };

  return (
    <div className="flex flex-col gap-2">
      {profiles.length === 0 && <p className="text-subtext text-xs">{t('noProfiles')}</p>}

      {profiles.map(profile => {
        const isActive = active?.id === profile.id;
        return (
          <ListItem key={profile.id} selected={isActive} className="px-3 py-2 rounded">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-text text-sm truncate">{profile.label}</span>
                  {isActive && <Badge variant="ref">{t('activeHere')}</Badge>}
                  {profile.signCommits && <Badge variant="ref">{t('signed')}</Badge>}
                </div>
                <p className="text-subtext text-xs truncate">
                  {profile.name} · {profile.email}
                </p>
                {profile.sshKeyPath && (
                  <p className="text-subtext text-xs truncate font-mono">{profile.sshKeyPath}</p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="surface"
                  size="sm"
                  disabled={!repoPath || isActive}
                  onClick={() => handleApply(profile)}
                >
                  {t('use')}
                </Button>
                <Button variant="secondary" size="sm" onClick={() => openEditor(profile)}>
                  {t('common:edit')}
                </Button>
                <Button variant="secondary" size="sm" onClick={() => handleDelete(profile)}>
                  {t('common:delete')}
                </Button>
              </div>
            </div>
          </ListItem>
        );
      })}

      <div className="flex items-center gap-2 mt-1">
        <Button variant="primary" size="sm" onClick={() => openEditor(null)}>
          {t('newProfile')}
        </Button>
        {repoPath && (
          <Button variant="secondary" size="sm" onClick={handleClear}>
            {t('clearProfile')}
          </Button>
        )}
      </div>

      {repoPath && (
        <p className="text-subtext text-xs mt-1">
          {identity?.name && identity.email
            ? t('currentIdentity', { name: identity.name, email: identity.email })
            : t('noLocalIdentity')}
        </p>
      )}

      {editorOpen && (
        <ProfileEditor
          profile={editing}
          onClose={() => setEditorOpen(false)}
          onSave={profile => {
            saveProfile(profile);
            setEditorOpen(false);
          }}
        />
      )}
    </div>
  );
}
