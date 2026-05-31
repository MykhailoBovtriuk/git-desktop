interface RawDiffProps {
  raw: string;
}

function lineClass(line: string): string {
  if (line.startsWith('+++') || line.startsWith('---')) return 'text-subtext';
  if (line.startsWith('+')) return 'text-green';
  if (line.startsWith('-')) return 'text-red';
  if (line.startsWith('@@')) return 'text-blue';
  if (line.startsWith('diff --git')) return 'text-text font-semibold';
  return 'text-subtext';
}

export function RawDiff({ raw }: RawDiffProps) {
  if (!raw.trim()) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-subtext text-xs">No diff</p>
      </div>
    );
  }
  const lines = raw.split('\n');
  return (
    <div className="h-full overflow-auto p-3 font-mono text-xs leading-5">
      {lines.map((line, i) => (
        <div key={i} className={lineClass(line)}>
          {line || ' '}
        </div>
      ))}
    </div>
  );
}
