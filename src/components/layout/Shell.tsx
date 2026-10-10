import type { ActiveView } from '../../types';
import { useRepoStore } from '../../stores/repo-store';
import { useUiStore, isOverlayView } from '../../stores/ui-store';
import { Titlebar } from './Titlebar';
import { BareTitlebar } from './BareTitlebar';
import { Sidebar } from './Sidebar';
import { Footer } from './Footer';
import { WelcomeScreen } from '../welcome/WelcomeScreen';
import { Toast } from '../common/Toast';
import { DiffViewer } from '../diff/DiffViewer';
import { CommitGraph } from '../graph/CommitGraph';
import { HistoryView } from '../history/HistoryView';
import { MergeEditor } from '../merge/MergeEditor';
import { MergeConflictModal } from '../merge/MergeConflictModal';
import { RebaseBanner } from '../rebase/RebaseBanner';
import { CheckoutConflictModal } from '../checkout/CheckoutConflictModal';
import { NewBranchModal } from '../branches/NewBranchModal';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { StashView } from '../stash/StashView';
import { SettingsView } from '../settings/SettingsView';
import { AboutView } from '../about/AboutView';
import { SignInModal } from '../account/SignInModal';
import { ConnectionModal } from '../account/ConnectionModal';
import { UpdateModal } from '../update/UpdateModal';
import { RightPanel } from '../panel/RightPanel';

function OverlayContent({ activeView }: { activeView: ActiveView }) {
  if (activeView === 'settings') return <SettingsView />;
  return <AboutView />;
}

function MainContent() {
  const activeView = useUiStore(s => s.activeView);

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
  const repoPath = useRepoStore(s => s.repoPath);
  const activeView = useUiStore(s => s.activeView);
  const showsOverlay = isOverlayView(activeView);
  const sidebarOpen = useUiStore(s => s.sidebarOpen);

  if (!repoPath) {
    // Without a repository there is no footer, so the welcome screen links to
    // Settings/About itself.
    return (
      <>
        {showsOverlay ? (
          <div className="h-screen flex flex-col bg-base overflow-hidden">
            <BareTitlebar />
            <main className="flex-1 overflow-hidden">
              <OverlayContent activeView={activeView} />
            </main>
          </div>
        ) : (
          <WelcomeScreen />
        )}
        <Toast />
        <ConfirmDialog />
        <SignInModal />
        <UpdateModal />
      </>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-base overflow-hidden">
      <Titlebar />
      <RebaseBanner />
      <div className="flex flex-1 overflow-hidden">
        {/* Settings and About take over the whole content area — the sidebar is
            about the open repository and has nothing to offer there. */}
        {showsOverlay ? (
          <main className="flex-1 overflow-hidden">
            <OverlayContent activeView={activeView} />
          </main>
        ) : (
          <>
            {/* Hidden, not unmounted: the commit form keeps an unsent message
                in local state. */}
            <div className={sidebarOpen ? 'contents' : 'hidden'}>
              <Sidebar />
            </div>
            <main className="flex-1 overflow-hidden">
              <MainContent />
            </main>
          </>
        )}
        {/* Settings and About are a different place, not a view beside the
            tools: the panel steps aside but stays mounted, so terminals keep
            their screens and come back as they were. */}
        <div className={showsOverlay ? 'hidden' : 'contents'}>
          <RightPanel />
        </div>
      </div>
      <Footer />
      <Toast />
      <MergeConflictModal />
      <CheckoutConflictModal />
      <NewBranchModal />
      <ConnectionModal />
      <ConfirmDialog />
      <SignInModal />
      <UpdateModal />
    </div>
  );
}
