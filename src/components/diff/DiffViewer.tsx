import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useUiStore } from '../../stores/ui-store';
import { useRepoStore } from '../../stores/repo-store';
import { gitApi } from '../../api/git-api';
import { useGitAction } from '../../hooks/use-git-action';
import { parseDiff } from './parse-diff';
import { buildHunkPatch } from '../../lib/build-patch';
import { langForPath, DIFF_THEME } from './highlight-lang';
import type { HighlighterCore } from './highlighter';
import type { DiffLine, FileDiff } from '../../types';

export function DiffViewer() {
  const { t } = useTranslation('diff');
  const runGitAction = useGitAction();
  const { stageHunk, unstageHunk } = useRepoStore(
    useShallow(s => ({ stageHunk: s.stageHunk, unstageHunk: s.unstageHunk })),
  );
  // Bumped by every tracked operation; used only as an effect trigger so the
  // open diff re-fetches after a hunk is staged/unstaged (the diff shrinks but
  // no other effect dependency changes).
  const epoch = useRepoStore(s => s.epoch);
  const { selectedFile, selectedFileArea, selectedCommit, activeView } = useUiStore(
    useShallow(s => ({
      selectedFile: s.selectedFile,
      selectedFileArea: s.selectedFileArea,
      selectedCommit: s.selectedCommit,
      activeView: s.activeView,
    })),
  );
  const stagedInStatus = useRepoStore(
    s => !!selectedFile && s.status.staged.some(f => f.path === selectedFile),
  );
  // The clicked list decides the diff source: a partially staged file is in
  // both lists, so the path alone is ambiguous. Fall back to the status
  // lookup only when a selection carries no area.
  const isStaged = selectedFileArea ? selectedFileArea === 'staged' : stagedInStatus;
  const inChanges = useRepoStore(
    s =>
      !!selectedFile &&
      (s.status.staged.some(f => f.path === selectedFile) ||
        s.status.unstaged.some(f => f.path === selectedFile)),
  );
  const useCommitContext = (activeView === 'history' || activeView === 'graph') && !!selectedCommit;
  // A selection is only valid while viewing a commit, or while the file is still
  // among the current changes. Otherwise (e.g. after commit/discard) show empty.
  const hasSelection = !!selectedFile && (useCommitContext || inChanges);
  const [diffs, setDiffs] = useState<FileDiff[]>([]);
  // Raw diff text kept alongside the parsed hunks so hunk staging can slice an
  // exact patch (parse-diff is lossy — see build-patch.ts).
  const [raw, setRaw] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Syntax highlighting: resolve the language from the file extension, then lazy
  // load shiki only for files we have a grammar for. null lang → plain diff.
  const lang = selectedFile ? langForPath(selectedFile) : null;
  const [highlighter, setHighlighter] = useState<HighlighterCore | null>(null);
  useEffect(() => {
    if (!lang || highlighter) return;
    let active = true;
    import('./highlighter')
      .then(m => m.getHighlighter())
      .then(h => {
        if (active) setHighlighter(h);
      })
      .catch(() => {
        // Highlighting is cosmetic — on any load failure the diff still renders
        // as plain text.
      });
    return () => {
      active = false;
    };
  }, [lang, highlighter]);

  // Render a diff line's content: syntax-highlighted token spans when the
  // highlighter is ready, otherwise the plain text in its semantic +/- color.
  // Per-line tokenization loses cross-line context (block comments, multi-line
  // strings) but keeps each line aligned with its +/- background.
  const renderContent = (line: DiffLine) => {
    if (highlighter && lang) {
      try {
        const { tokens } = highlighter.codeToTokens(line.content, { lang, theme: DIFF_THEME });
        return (tokens[0] ?? []).map((tk, i) => (
          <span key={i} style={{ color: tk.color }}>
            {tk.content}
          </span>
        ));
      } catch {
        // Fall through to plain text.
      }
    }
    const cls =
      line.type === 'add' ? 'text-green' : line.type === 'remove' ? 'text-red' : 'text-text';
    return <span className={cls}>{line.content}</span>;
  };

  // Hunk staging is only meaningful for working/staged changes, never when
  // viewing a historical commit.
  const showHunkActions = inChanges && !useCommitContext;

  const handleHunk = (globalHunkIndex: number) =>
    runGitAction(
      async () => {
        const patch = buildHunkPatch(raw, globalHunkIndex);
        await (isStaged ? unstageHunk(patch) : stageHunk(patch));
      },
      { title: isStaged ? t('unstageHunk') : t('stageHunk') },
    );

  useEffect(() => {
    if (!hasSelection) {
      setDiffs([]);
      setRaw('');
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        let rawText = '';
        if (useCommitContext && selectedCommit) {
          rawText = await gitApi.getFileDiff(selectedCommit, selectedFile);
        } else {
          rawText = isStaged
            ? await gitApi.getStagedDiff(selectedFile)
            : await gitApi.getWorkingDiff(selectedFile);
        }
        if (!cancelled) {
          setRaw(rawText);
          setDiffs(parseDiff(rawText));
        }
      } catch (err) {
        if (!cancelled) {
          setDiffs([]);
          setRaw('');
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // `epoch` re-runs the fetch after a hunk stage/unstage so the diff stays current.
  }, [selectedFile, selectedCommit, isStaged, useCommitContext, hasSelection, epoch]);

  if (!hasSelection) {
    return (
      <div className="h-full flex items-center justify-center text-subtext text-sm">
        {t('noDiff')}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-subtext text-sm">
        {t('common:loading')}
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-1 text-red text-sm px-4 text-center">
        <span>{t('loadFailed')}</span>
        <span className="text-subtext text-xs break-all">{error}</span>
      </div>
    );
  }

  if (diffs.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-subtext text-sm">
        {t('noDiffToDisplay')}
      </div>
    );
  }

  // Global hunk index (across all files in this diff) so build-patch can slice
  // the right hunk from the raw text. Normally one file, but be defensive.
  const hunkOffsets = diffs.reduce<number[]>((acc, _d, i) => {
    acc[i] = i === 0 ? 0 : acc[i - 1] + diffs[i - 1].hunks.length;
    return acc;
  }, []);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {diffs.map((diff, di) => (
        <div key={diff.path} className="flex flex-col overflow-auto">
          <div className="flex items-center gap-2 px-3 py-2 bg-mantle border-b border-surface0 shrink-0">
            <span className="text-text text-sm font-medium">{diff.path.split('/').pop()}</span>
            <span className="text-green text-xs">+{diff.additions}</span>
            <span className="text-red text-xs">-{diff.deletions}</span>
          </div>

          <div className="font-mono text-xs overflow-auto flex-1">
            {diff.hunks.map((hunk, hi) => (
              <div key={hi}>
                <div className="flex items-center justify-between bg-surface0 text-subtext px-3 py-0.5 border-y border-surface1">
                  <span>
                    @@ -{hunk.oldStart},{hunk.oldCount} +{hunk.newStart},{hunk.newCount} @@
                  </span>
                  {showHunkActions && (
                    <button
                      type="button"
                      onClick={() => handleHunk(hunkOffsets[di] + hi)}
                      className="text-blue hover:text-sky text-xs px-1 shrink-0"
                    >
                      {isStaged ? t('unstageHunk') : t('stageHunk')}
                    </button>
                  )}
                </div>
                {hunk.lines.map((line, li) => (
                  <div
                    key={li}
                    className={`flex ${
                      line.type === 'add'
                        ? 'bg-green/10'
                        : line.type === 'remove'
                          ? 'bg-red/10'
                          : ''
                    }`}
                  >
                    <span className="text-subtext w-8 shrink-0 text-right pr-2 select-none border-r border-surface0">
                      {line.oldLineNumber ?? ''}
                    </span>
                    <span className="text-subtext w-8 shrink-0 text-right pr-2 select-none border-r border-surface0">
                      {line.newLineNumber ?? ''}
                    </span>
                    <span className="px-2 whitespace-pre">
                      <span
                        className={
                          line.type === 'add'
                            ? 'text-green'
                            : line.type === 'remove'
                              ? 'text-red'
                              : 'text-subtext'
                        }
                      >
                        {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}
                      </span>
                      {renderContent(line)}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
