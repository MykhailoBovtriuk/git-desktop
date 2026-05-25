import { useRepoStore } from '../../stores/repo-store';
import { useUiStore } from '../../stores/ui-store';
import { Accordion } from '../common/Accordion';
import { ChangesSection } from '../staging/ChangesSection';

export function Sidebar() {
  const { status } = useRepoStore();
  const { activeView, setActiveView } = useUiStore();

  const totalChanges = status.staged.length + status.unstaged.length;

  return (
    <div className="w-56 bg-mantle border-r border-surface0 flex flex-col overflow-y-auto shrink-0">
      <Accordion
        title="Changes"
        badge={totalChanges}
        open={activeView === 'changes'}
        onToggle={() => setActiveView('changes')}
      >
        <ChangesSection />
      </Accordion>

      <Accordion
        title="History"
        open={activeView === 'history'}
        onToggle={() => setActiveView('history')}
      >
        <div />
      </Accordion>

      <Accordion
        title="Graph"
        open={activeView === 'graph'}
        onToggle={() => setActiveView('graph')}
      >
        <div />
      </Accordion>
    </div>
  );
}
