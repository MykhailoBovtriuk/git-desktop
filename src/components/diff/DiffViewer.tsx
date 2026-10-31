import { useTranslation } from 'react-i18next';
import { useFileDiff } from './useFileDiff';
import { useDiffHighlighter } from './useDiffHighlighter';
import { DiffFile } from './DiffFile';
import { EmptyState } from '../../shared/ui';

export function DiffViewer() {
  const { t } = useTranslation('diff');
  const {
    selectedFile,
    diffs,
    loading,
    error,
    hasSelection,
    isStaged,
    showHunkActions,
    whitespaceBlocksStaging,
    handleHunk,
  } = useFileDiff();
  const renderContent = useDiffHighlighter(selectedFile);

  if (!hasSelection) return <EmptyState>{t('noDiff')}</EmptyState>;
  if (loading) return <EmptyState>{t('common:loading')}</EmptyState>;
  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-1 text-red text-sm px-4 text-center">
        <span>{t('loadFailed')}</span>
        <span className="text-subtext text-xs break-all">{error}</span>
      </div>
    );
  }
  if (diffs.length === 0) return <EmptyState>{t('noDiffToDisplay')}</EmptyState>;

  const hunkOffsets = diffs.reduce<number[]>((acc, _d, i) => {
    acc[i] = i === 0 ? 0 : acc[i - 1] + diffs[i - 1].hunks.length;
    return acc;
  }, []);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {diffs.map((diff, di) => (
        <DiffFile
          key={diff.path}
          diff={diff}
          baseHunkIndex={hunkOffsets[di]}
          showHunkActions={showHunkActions}
          whitespaceBlocksStaging={whitespaceBlocksStaging}
          isStaged={isStaged}
          onHunk={handleHunk}
          renderContent={renderContent}
        />
      ))}
    </div>
  );
}
