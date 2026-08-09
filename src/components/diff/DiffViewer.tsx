import { useTranslation } from 'react-i18next';
import { useFileDiff } from './useFileDiff';
import { useDiffHighlighter } from './useDiffHighlighter';
import { DiffFile } from './DiffFile';

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
    handleHunk,
  } = useFileDiff();
  const renderContent = useDiffHighlighter(selectedFile);

  if (!hasSelection) return <Centered>{t('noDiff')}</Centered>;
  if (loading) return <Centered>{t('common:loading')}</Centered>;
  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-1 text-red text-sm px-4 text-center">
        <span>{t('loadFailed')}</span>
        <span className="text-subtext text-xs break-all">{error}</span>
      </div>
    );
  }
  if (diffs.length === 0) return <Centered>{t('noDiffToDisplay')}</Centered>;

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
          isStaged={isStaged}
          onHunk={handleHunk}
          renderContent={renderContent}
        />
      ))}
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full flex items-center justify-center text-subtext text-sm">{children}</div>
  );
}
