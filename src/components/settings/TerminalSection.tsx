import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { terminalApi } from '../../api/terminal-api';
import {
  TERMINAL_FONT_SIZES,
  useSettingsStore,
  type TerminalFontSize,
} from '../../stores/settings-store';
import { SegmentedControl } from '../../shared/ui';
import type { TerminalShell } from '../../types';
import { SettingsSection } from './SettingsSection';

const AUTO = '';

export function TerminalSection() {
  const { t } = useTranslation('terminal');
  const { terminalShell, setTerminalShell, terminalFontSize, setTerminalFontSize } =
    useSettingsStore(
      useShallow(s => ({
        terminalShell: s.terminalShell,
        setTerminalShell: s.setTerminalShell,
        terminalFontSize: s.terminalFontSize,
        setTerminalFontSize: s.setTerminalFontSize,
      })),
    );
  const [shells, setShells] = useState<TerminalShell[]>([]);

  useEffect(() => {
    void terminalApi
      .shells()
      .then(setShells)
      .catch(() => {});
  }, []);

  const value = shells.some(s => s.id === terminalShell) ? (terminalShell as string) : AUTO;

  return (
    <>
      {shells.length > 0 && (
        <SettingsSection title={t('settings.shell')} description={t('settings.shellHint')}>
          <SegmentedControl
            label={t('settings.shell')}
            value={value}
            onChange={(id: string) => setTerminalShell(id === AUTO ? null : id)}
            options={[
              { value: AUTO, label: t('settings.auto') },
              ...shells.map(s => ({ value: s.id, label: s.label })),
            ]}
          />
        </SettingsSection>
      )}
      <SettingsSection title={t('settings.fontSize')}>
        <SegmentedControl
          label={t('settings.fontSize')}
          value={terminalFontSize}
          onChange={(size: TerminalFontSize) => setTerminalFontSize(size)}
          options={TERMINAL_FONT_SIZES.map(size => ({ value: size, label: `${size}px` }))}
        />
      </SettingsSection>
    </>
  );
}
