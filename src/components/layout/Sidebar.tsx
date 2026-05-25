import { useRepoStore } from '../../stores/repo-store';
import { useUiStore } from '../../stores/ui-store';
import { Accordion } from '../common/Accordion';
import { ChangesSection } from '../staging/ChangesSection';

export function Sidebar() {
  const { status } = useRepoStore();
  const { activeView, setActiveView } = useUiStore();

  const totalChanges = status.staged.length + status.unstaged.length;

  return (
    <div className="w-56 bg-mantle border-r border-surface0 flex flex-col">

      {/* Top block — Changes accordion with triangle */}
      <Accordion
        title="Changes"
        badge={totalChanges}
        open={activeView === 'changes'}
        onToggle={() => setActiveView('changes')}
      >
        <ChangesSection />
      </Accordion>

      {/* Spacer pushes bottom block to the bottom */}
      <div className="flex-1" />

      {/* Bottom block — History + Graph nav buttons, no triangle */}
      <div className="border-t-2 border-surface1 flex flex-col">
        <button
          onClick={() => setActiveView('history')}
          className={`
            flex items-center w-full px-3 py-2 text-left
            border-l-2 transition-colors text-xs font-semibold uppercase tracking-wide
            ${activeView === 'history'
              ? 'bg-surface0 border-blue text-text'
              : 'border-transparent hover:bg-surface0 text-subtext hover:text-text'
            }
          `}
        >
          History
        </button>

        <div className="border-t border-surface0" />

        <button
          onClick={() => setActiveView('graph')}
          className={`
            flex items-center w-full px-3 py-2 text-left
            border-l-2 transition-colors text-xs font-semibold uppercase tracking-wide
            ${activeView === 'graph'
              ? 'bg-surface0 border-blue text-text'
              : 'border-transparent hover:bg-surface0 text-subtext hover:text-text'
            }
          `}
        >
          Graph
        </button>
      </div>

    </div>
  );
}
