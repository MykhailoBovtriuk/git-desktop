import { useTranslation } from 'react-i18next';
import type { LogEntry } from '../../types';
import { useCopy } from '../../hooks/use-copy';
import {
  cleanOutput,
  commandLine,
  formatDuration,
  formatEntry,
  formatTime,
} from '../../lib/format-log';
import {
  CheckIcon,
  ChevronRightIcon,
  CopyIcon,
  ErrorIcon,
  IconButton,
  SpinnerIcon,
  cn,
} from '../../shared/ui';

interface LogEntryRowProps {
  entry: LogEntry;
  expanded: boolean;
  onToggle: () => void;
  highlighted?: boolean;
}

export function LogEntryRow({ entry, expanded, onToggle, highlighted }: LogEntryRowProps) {
  const { t } = useTranslation('logs');
  const { copied, copy: copyText } = useCopy();
  const title = t(`op.${entry.op}`);
  const copy = () => copyText(formatEntry(entry, title));

  const errorShown =
    entry.error && !entry.commands.some(c => c.stderr.includes(entry.error!.trim()));

  return (
    <li
      data-entry-id={entry.id}
      className={cn('border-b border-surface0', highlighted && 'bg-surface0/60')}
    >
      <div className="group flex items-center gap-1.5 px-2 py-1 text-xs hover:bg-surface0">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="flex-1 min-w-0 flex items-center gap-1.5 text-left"
        >
          <ChevronRightIcon
            size={12}
            aria-hidden="true"
            className={cn('shrink-0 text-subtext transition-transform', expanded && 'rotate-90')}
          />
          <span className="font-mono text-subtext shrink-0">{formatTime(entry.ts)}</span>
          {entry.status === 'running' ? (
            <SpinnerIcon
              size={12}
              aria-label={t('running')}
              className="shrink-0 text-blue animate-spin"
            />
          ) : entry.status === 'error' ? (
            <ErrorIcon size={12} aria-hidden="true" className="shrink-0 text-red" />
          ) : (
            <CheckIcon size={12} aria-hidden="true" className="shrink-0 text-green" />
          )}
          <span className={cn('shrink-0', entry.status === 'error' ? 'text-red' : 'text-text')}>
            {title}
          </span>
          {entry.detail && <span className="truncate text-subtext">{entry.detail}</span>}
          <span className="ml-auto shrink-0 text-subtext font-mono">
            {formatDuration(entry.durationMs)}
          </span>
        </button>
        <IconButton
          icon={copied ? CheckIcon : CopyIcon}
          size="sm"
          onClick={copy}
          aria-label={copied ? t('copied') : t('copy')}
          title={copied ? t('copied') : t('copy')}
          className="opacity-0 group-hover:opacity-100 focus:opacity-100"
        />
      </div>
      {expanded && (
        <pre className="px-3 pb-2 pt-1 text-[11px] leading-4 font-mono whitespace-pre-wrap break-words select-text text-subtext">
          {entry.commands.length === 0 && !entry.error && (
            <span className="italic">
              {entry.status === 'running' ? t('running') : t('noOutput')}
            </span>
          )}
          {entry.commands.map((command, i) => {
            const out = cleanOutput(command.stdout);
            const err = cleanOutput(command.stderr);
            return (
              <span key={i} className="block">
                <span className="block text-blue">{commandLine(command)}</span>
                {out && <span className="block text-text">{out}</span>}
                {err && <span className="block">{err}</span>}
              </span>
            );
          })}
          {errorShown && <span className="block text-red">{entry.error!.trim()}</span>}
        </pre>
      )}
    </li>
  );
}
