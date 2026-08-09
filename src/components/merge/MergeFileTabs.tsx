import { useTranslation } from 'react-i18next';

interface MergeFileTabsProps {
  files: string[];
  activeMergeFile: string | null;
  resolved: Set<string>;
  onSelect: (file: string) => void;
}

export function MergeFileTabs({ files, activeMergeFile, resolved, onSelect }: MergeFileTabsProps) {
  const { t } = useTranslation('merge');
  return (
    <div className="flex items-center bg-mantle border-b border-surface0 shrink-0 overflow-x-auto">
      {files.map(f => (
        <button
          key={f}
          onClick={() => onSelect(f)}
          className={`px-3 py-2 text-xs shrink-0 border-r border-surface0 transition-colors ${
            activeMergeFile === f ? 'bg-surface0 text-text' : 'text-subtext hover:bg-surface0'
          } ${resolved.has(f) ? 'text-green' : ''}`}
        >
          {f.split('/').pop()}
          {resolved.has(f) && ' ✓'}
        </button>
      ))}
      <div className="ml-auto px-3 text-subtext text-xs shrink-0">
        {t('resolved', { resolved: resolved.size, total: files.length })}
      </div>
    </div>
  );
}
