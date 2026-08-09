import { useMergeEditor } from './useMergeEditor';
import { MergeFileTabs } from './MergeFileTabs';
import { MergeColumnHeaders } from './MergeColumnHeaders';
import { MergeBody } from './MergeBody';
import { MergeFooter } from './MergeFooter';

export function MergeEditor() {
  const m = useMergeEditor();
  if (!m.mergeState) return null;

  return (
    <div className="h-full flex flex-col">
      <MergeFileTabs
        files={m.files}
        activeMergeFile={m.activeMergeFile}
        resolved={m.resolved}
        onSelect={m.setActiveMergeFile}
      />
      <MergeColumnHeaders
        targetBranch={m.mergeState.targetBranch}
        sourceBranch={m.mergeState.sourceBranch}
        onAll={m.setAll}
      />
      <MergeBody segs={m.segs} setChoice={m.setChoice} />
      <MergeFooter
        sourceBranch={m.mergeState.sourceBranch}
        targetBranch={m.mergeState.targetBranch}
        remaining={m.remaining}
        autoCommit={m.autoCommit}
        toggleAutoCommit={m.toggleAutoCommit}
        onAbort={m.handleAbort}
        onSave={m.handleMarkResolved}
        saving={m.saving}
        saveDisabled={m.saveDisabled}
      />
    </div>
  );
}
