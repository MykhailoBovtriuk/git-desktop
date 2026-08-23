import type { ReactNode } from 'react';

interface SettingsSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
}

export function SettingsSection({ title, description, children }: SettingsSectionProps) {
  return (
    <section className="border-b border-surface0 py-4 last:border-0">
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <h2 className="text-text text-sm font-medium">{title}</h2>
          {description && <p className="text-subtext text-xs mt-0.5">{description}</p>}
        </div>
        <div className="shrink-0">{children}</div>
      </div>
    </section>
  );
}
