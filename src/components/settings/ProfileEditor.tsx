import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { gitApi } from '../../api/git-api';
import { Button, Modal, Switch, TextInput } from '../../shared/ui';
import { createProfileId } from '../../lib/git-profile';
import type { GitProfile } from '../../types';

interface ProfileEditorProps {
  profile: GitProfile | null;
  onSave: (profile: GitProfile) => void;
  onClose: () => void;
}

export function ProfileEditor({ profile, onSave, onClose }: ProfileEditorProps) {
  const { t } = useTranslation('settings');
  const [label, setLabel] = useState(profile?.label ?? '');
  const [name, setName] = useState(profile?.name ?? '');
  const [email, setEmail] = useState(profile?.email ?? '');
  const [sshKeyPath, setSshKeyPath] = useState(profile?.sshKeyPath ?? '');
  const [signCommits, setSignCommits] = useState(profile?.signCommits ?? false);

  const trimmedKey = sshKeyPath.trim();
  // Signing reuses the SSH key, so it cannot be enabled without one.
  const canSign = trimmedKey.length > 0;
  const valid = label.trim() && name.trim() && email.trim();

  const pickKey = async () => {
    const picked = await gitApi.openFileDialog(t('pickSshKey'));
    if (picked) setSshKeyPath(picked);
  };

  const handleSave = () => {
    if (!valid) return;
    onSave({
      id: profile?.id ?? createProfileId(),
      label: label.trim(),
      name: name.trim(),
      email: email.trim(),
      sshKeyPath: trimmedKey || undefined,
      signCommits: canSign && signCommits,
    });
  };

  return (
    <Modal
      title={profile ? t('editProfile') : t('newProfile')}
      width="w-[28rem]"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common:cancel')}
          </Button>
          <Button variant="primary" disabled={!valid} onClick={handleSave}>
            {t('common:save')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-subtext text-xs">{t('profileLabel')}</span>
          <TextInput
            variant="modal"
            autoFocus
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder={t('profileLabelPlaceholder')}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-subtext text-xs">{t('profileName')}</span>
          <TextInput
            variant="modal"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Jane Doe"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-subtext text-xs">{t('profileEmail')}</span>
          <TextInput
            variant="modal"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="jane@example.com"
          />
        </label>

        <div className="flex flex-col gap-1">
          <span className="text-subtext text-xs">{t('profileSshKey')}</span>
          <div className="flex items-center gap-2">
            <TextInput
              variant="modal"
              value={sshKeyPath}
              onChange={e => setSshKeyPath(e.target.value)}
              placeholder="~/.ssh/id_ed25519"
              className="flex-1 min-w-0"
            />
            <Button variant="surface" onClick={pickKey}>
              {t('browse')}
            </Button>
          </div>
          <p className="text-subtext text-xs">{t('profileSshKeyHint')}</p>
        </div>

        <div className="flex flex-col gap-1">
          <Switch
            checked={canSign && signCommits}
            onToggle={() => canSign && setSignCommits(v => !v)}
            label={t('signCommits')}
            className={canSign ? '' : 'opacity-40 cursor-not-allowed'}
          />
          <p className="text-subtext text-xs">
            {canSign ? t('signCommitsHint') : t('signCommitsNeedsKey')}
          </p>
        </div>
      </div>
    </Modal>
  );
}
