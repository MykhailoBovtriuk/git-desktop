import { useRepoStore } from '../../stores/repo-store';
import { useUiStore } from '../../stores/ui-store';
import { Titlebar } from './Titlebar';
import { Sidebar } from './Sidebar';
import { Footer } from './Footer';
import { WelcomeScreen } from '../welcome/WelcomeScreen';
import { Toast } from '../common/Toast';
import { DiffViewer } from '../diff/DiffViewer';
import { CommitGraph } from '../graph/CommitGraph';
import { HistoryView } from '../history/HistoryView';
import { MergeEditor } from '../merge/MergeEditor';
import { MergeConflictModal } from '../merge/MergeConflictModal';
import { StashView } from '../stash/StashView';

function MainContent() {
  const { activeView } = useUiStore();

  switch (activeView) {
    case 'history':
      return <HistoryView />;
    case 'merge-editor':
      return <MergeEditor />;
    case 'graph':
      return <CommitGraph />;
    case 'stash':
      return <StashView />;
    default:
      return <DiffViewer />;
  }
}

export function Shell() {
  const { repoPath } = useRepoStore();

  if (!repoPath) {
    return (
      <>
        <WelcomeScreen />
        <Toast />
      </>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-base overflow-hidden">
      <Titlebar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-hidden">
          <MainContent />
        </main>
      </div>
      <Footer />
      <Toast />
      <MergeConflictModal />
    </div>
  );
}
