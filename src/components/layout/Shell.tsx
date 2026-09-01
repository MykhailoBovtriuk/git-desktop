import type { ActiveView } from '../../types';
import { useRepoStore } from '../../stores/repo-store';
import { useUiStore, isOverlayView } from '../../stores/ui-store';
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
import { RebaseBanner } from '../rebase/RebaseBanner';
import { CheckoutConflictModal } from '../checkout/CheckoutConflictModal';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { StashView } from '../stash/StashView';
import { SettingsView } from '../settings/SettingsView';
import { AboutView } from '../about/AboutView';
import { SignInModal } from '../account/SignInModal';

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

  if (!repoPath) {
    // There is no footer without a repository, so the welcome screen carries
    // its own entry points into Settings/About — otherwise they'd be
    // unreachable for a first-run user.
    return (
      <>
        {showsOverlay ? (
          <div className="h-screen flex flex-col bg-base overflow-hidden">
            <OverlayContent activeView={activeView} />
          </div>
        ) : (
          <WelcomeScreen />
        )}
        <Toast />
        <ConfirmDialog />
        <SignInModal />
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
            <Sidebar />
            <main className="flex-1 overflow-hidden">
              <MainContent />
            </main>
          </>
        )}
      </div>
      <Footer />
      <Toast />
      <MergeConflictModal />
      <CheckoutConflictModal />
      <ConfirmDialog />
      <SignInModal />
    </div>
  );
}
