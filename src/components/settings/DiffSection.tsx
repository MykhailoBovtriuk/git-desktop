import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { DIFF_FONT_SIZES, useSettingsStore, type DiffFontSize } from '../../stores/settings-store';
import { SegmentedControl, Switch } from '../../shared/ui';
import { SettingsSection } from './SettingsSection';

export function DiffSection() {
  const { t } = useTranslation('settings');
  const s = useSettingsStore(
    useShallow(st => ({
      fontSize: st.diffFontSize,
      setFontSize: st.setDiffFontSize,
      wrap: st.diffWrapLines,
      setWrap: st.setDiffWrapLines,
      ignoreWs: st.diffIgnoreWhitespace,
      setIgnoreWs: st.setDiffIgnoreWhitespace,
    })),
  );

  return (
    <>
      <SettingsSection title={t('diff.fontSize')}>
        <SegmentedControl
          label={t('diff.fontSize')}
          value={s.fontSize}
          onChange={(size: DiffFontSize) => s.setFontSize(size)}
          options={DIFF_FONT_SIZES.map(size => ({ value: size, label: `${size}px` }))}
        />
      </SettingsSection>
      <SettingsSection title={t('diff.wrap')} description={t('diff.wrapHint')}>
        <Switch
          checked={s.wrap}
          onToggle={() => s.setWrap(!s.wrap)}
          label={t('diff.wrap')}
          hideLabel
        />
      </SettingsSection>
      <SettingsSection
        title={t('diff.ignoreWhitespace')}
        description={t('diff.ignoreWhitespaceHint')}
      >
        <Switch
          checked={s.ignoreWs}
          onToggle={() => s.setIgnoreWs(!s.ignoreWs)}
          label={t('diff.ignoreWhitespace')}
          hideLabel
        />
      </SettingsSection>
    </>
  );
}
