import { useRepoStore } from '../../stores/repo-store';
import { useUiStore } from '../../stores/ui-store';
import { Accordion } from '../common/Accordion';
import { ChangesSection } from '../staging/ChangesSection';

export function Sidebar() {
  const { status } = useRepoStore();
  const { sidebarSections, toggleSection, setActiveView, activeView } = useUiStore();

  const totalChanges = status.staged.length + status.unstaged.length;

  const handleHistoryToggle = () => {
    toggleSection('history');
    if (!sidebarSections.history) {
      setActiveView('history');
    } else if (activeView === 'history') {
      setActiveView('changes');
    }
  };

  return (
    <div className="w-56 bg-mantle border-r border-surface0 flex flex-col overflow-y-auto shrink-0">
      <Accordion
        title="Changes"
        badge={totalChanges}
        open={sidebarSections.changes}
        onToggle={() => toggleSection('changes')}
      >
        <ChangesSection />
      </Accordion>

      <Accordion
        title="History"
        open={sidebarSections.history}
        onToggle={handleHistoryToggle}
      >
        <div />
      </Accordion>
    </div>
  );
}
