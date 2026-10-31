import { useTranslation } from 'react-i18next';
import { EmptyState } from '../../shared/ui';

interface RawDiffProps {
  raw: string;
}

function lineClass(line: string): string {
  if (line.startsWith('+++') || line.startsWith('---')) return 'text-subtext';
  if (line.startsWith('+')) return 'text-green';
  if (line.startsWith('-')) return 'text-red';
  if (line.startsWith('@@')) return 'text-blue';
  if (line.startsWith('diff --git')) return 'text-text font-semibold';
  return 'text-subtext';
}

export function RawDiff({ raw }: RawDiffProps) {
  const { t } = useTranslation('diff');
  if (!raw.trim()) {
    return <EmptyState>{t('diff:noDiffToDisplay')}</EmptyState>;
  }
  const lines = raw.split('\n');
  return (
    <div className="h-full overflow-auto p-3 font-mono text-xs leading-5">
      {lines.map((line, i) => (
        <div key={i} className={lineClass(line)}>
          {line || ' '}
        </div>
      ))}
    </div>
  );
}
