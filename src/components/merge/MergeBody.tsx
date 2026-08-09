import { useTranslation } from 'react-i18next';
import type { Choice, Segment } from '../../lib/merge-conflicts';

const gutter = 'w-9 shrink-0 flex items-center justify-center border-x border-surface0';

interface MergeBodyProps {
  segs: Segment[];
  setChoice: (idx: number, choice: Choice) => void;
}

// Single scroll container so the three columns stay aligned.
export function MergeBody({ segs, setChoice }: MergeBodyProps) {
  return (
    <div className="flex-1 overflow-auto bg-base font-mono text-xs">
      {segs.map((s, idx) =>
        s.type === 'common' ? (
          <CommonRow key={idx} lines={s.lines} />
        ) : (
          <ConflictRow
            key={idx}
            ours={s.ours}
            theirs={s.theirs}
            choice={s.choice}
            onChoose={choice => setChoice(idx, choice)}
          />
        ),
      )}
    </div>
  );
}

function CommonRow({ lines }: { lines: string[] }) {
  const text = lines.join('\n');
  return (
    <div className="flex">
      <pre className="flex-1 px-3 py-0.5 text-subtext whitespace-pre-wrap">{text}</pre>
      <div className="w-9 shrink-0" />
      <pre className="flex-1 px-3 py-0.5 text-text whitespace-pre-wrap border-x border-surface0">
        {text}
      </pre>
      <div className="w-9 shrink-0" />
      <pre className="flex-1 px-3 py-0.5 text-subtext whitespace-pre-wrap">{text}</pre>
    </div>
  );
}

interface ConflictRowProps {
  ours: string[];
  theirs: string[];
  choice: Choice;
  onChoose: (choice: Choice) => void;
}

function ConflictRow({ ours, theirs, choice, onChoose }: ConflictRowProps) {
  const { t } = useTranslation('merge');
  const merged = choice === 'ours' ? ours : choice === 'theirs' ? theirs : [...ours, ...theirs];
  return (
    <div className="flex items-stretch border-y border-surface0">
      <pre
        className={`flex-1 px-3 py-1 whitespace-pre-wrap text-text ${choice === 'ours' || choice === 'both' ? 'bg-green/10' : 'bg-red/10'}`}
      >
        {ours.join('\n')}
      </pre>
      <button
        onClick={() => onChoose('ours')}
        title={t('useCurrentBlock')}
        className={`${gutter} hover:bg-surface1 transition-colors ${choice === 'ours' ? 'text-blue bg-surface0' : 'text-subtext hover:text-text'}`}
      >
        »
      </button>
      <div
        className={`flex-1 px-3 py-1 whitespace-pre-wrap ${choice ? 'bg-green/10 text-text' : 'bg-red/15'}`}
      >
        {choice ? (
          <pre className="whitespace-pre-wrap">{merged.join('\n')}</pre>
        ) : (
          <span className="text-red">{t('unresolvedHint')}</span>
        )}
      </div>
      <button
        onClick={() => onChoose('theirs')}
        title={t('useIncomingBlock')}
        className={`${gutter} hover:bg-surface1 transition-colors ${choice === 'theirs' ? 'text-green bg-surface0' : 'text-subtext hover:text-text'}`}
      >
        «
      </button>
      <pre
        className={`flex-1 px-3 py-1 whitespace-pre-wrap text-text ${choice === 'theirs' || choice === 'both' ? 'bg-green/10' : 'bg-red/10'}`}
      >
        {theirs.join('\n')}
      </pre>
    </div>
  );
}
