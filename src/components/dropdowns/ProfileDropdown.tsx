import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useRepoStore } from '../../stores/repo-store';
import { useUiStore } from '../../stores/ui-store';
import { useSettingsStore } from '../../stores/settings-store';
import { useGitAction } from '../../hooks/use-git-action';
import { matchProfile } from '../../lib/git-profile';
import { DropdownPanel, MenuItem, SectionLabel } from '../../shared/ui';

interface ProfileDropdownProps {
  onClose: () => void;
}

export function ProfileDropdown({ onClose }: ProfileDropdownProps) {
  const { t } = useTranslation('settings');
  const profiles = useSettingsStore(s => s.profiles);
  const { identity, applyProfile, clearProfile } = useRepoStore(
    useShallow(s => ({
      identity: s.identity,
      applyProfile: s.applyProfile,
      clearProfile: s.clearProfile,
    })),
  );
  const openOverlayView = useUiStore(s => s.openOverlayView);
  const runAction = useGitAction();

  const active = matchProfile(identity, profiles);

  const handleApply = async (id: string) => {
    const profile = profiles.find(p => p.id === id);
    if (!profile) return;
    onClose();
    await runAction(() => applyProfile(profile), {
      title: t('applyProfile'),
      success: t('applied', { label: profile.label }),
    });
  };

  const handleClear = async () => {
    onClose();
    await runAction(() => clearProfile(), { title: t('clearProfile'), success: t('cleared') });
  };

  return (
    <DropdownPanel align="center" width="w-64" className="py-1">
      {profiles.length > 0 ? (
        <>
          <SectionLabel className="px-3">{t('profiles')}</SectionLabel>
          {profiles.map(profile => (
            <MenuItem key={profile.id} onClick={() => handleApply(profile.id)}>
              <span className="flex items-center justify-between gap-2">
                <span className="truncate">
                  {profile.label}
                  <span className="text-subtext"> · {profile.email}</span>
                </span>
                {active?.id === profile.id && <span className="text-blue shrink-0">✓</span>}
              </span>
            </MenuItem>
          ))}
          <div className="border-t border-surface1 my-1" />
        </>
      ) : (
        <p className="px-3 py-1.5 text-subtext text-xs">{t('noProfiles')}</p>
      )}

      {identity?.name && (
        <MenuItem tone="danger" onClick={handleClear}>
          {t('clearProfile')}
        </MenuItem>
      )}
      <MenuItem
        onClick={() => {
          onClose();
          openOverlayView('settings');
        }}
      >
        {t('manageProfiles')}
      </MenuItem>
    </DropdownPanel>
  );
}
