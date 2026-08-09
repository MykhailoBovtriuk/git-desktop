export type Choice = 'ours' | 'theirs' | 'both' | null;

export type Segment =
  | { type: 'common'; lines: string[] }
  | {
      type: 'conflict';
      ours: string[];
      theirs: string[];
      choice: Choice;
      startMarker: string;
      midMarker: string;
      endMarker: string;
      baseMarker?: string;
      base?: string[];
    };

const START = /^<{7}( .*)?\r?$/;
const BASE = /^\|{7}( .*)?\r?$/;
const MID = /^={7}\r?$/;
const END = /^>{7}( .*)?\r?$/;

type ConflictSegment = Extract<Segment, { type: 'conflict' }>;

function tryParseBlock(
  lines: string[],
  start: number,
): { segment: ConflictSegment; next: number } | null {
  let i = start + 1;
  const ours: string[] = [];
  while (i < lines.length && !MID.test(lines[i]) && !BASE.test(lines[i])) {
    if (START.test(lines[i])) return null;
    ours.push(lines[i]);
    i++;
  }
  if (i >= lines.length) return null;

  let baseMarker: string | undefined;
  const base: string[] = [];
  if (BASE.test(lines[i])) {
    baseMarker = lines[i];
    i++;
    while (i < lines.length && !MID.test(lines[i])) {
      if (START.test(lines[i])) return null;
      base.push(lines[i]);
      i++;
    }
    if (i >= lines.length) return null;
  }

  const midMarker = lines[i];
  i++;
  const theirs: string[] = [];
  while (i < lines.length && !END.test(lines[i])) {
    if (START.test(lines[i]) || MID.test(lines[i])) return null;
    theirs.push(lines[i]);
    i++;
  }
  if (i >= lines.length) return null;

  const segment: ConflictSegment = {
    type: 'conflict',
    ours,
    theirs,
    choice: null,
    startMarker: lines[start],
    midMarker,
    endMarker: lines[i],
  };
  if (baseMarker !== undefined) {
    segment.baseMarker = baseMarker;
    segment.base = base;
  }
  return { segment, next: i + 1 };
}

export function parseConflicts(content: string): Segment[] {
  const lines = content.split('\n');
  const segs: Segment[] = [];
  let common: string[] = [];
  const flush = () => {
    if (common.length) {
      segs.push({ type: 'common', lines: common });
      common = [];
    }
  };

  let i = 0;
  while (i < lines.length) {
    const block = START.test(lines[i]) ? tryParseBlock(lines, i) : null;
    if (block) {
      flush();
      segs.push(block.segment);
      i = block.next;
    } else {
      common.push(lines[i]);
      i++;
    }
  }
  flush();
  return segs;
}

export function rebuild(segs: Segment[]): string {
  const out: string[] = [];
  for (const s of segs) {
    if (s.type === 'common') {
      out.push(...s.lines);
    } else if (s.choice === 'ours') {
      out.push(...s.ours);
    } else if (s.choice === 'theirs') {
      out.push(...s.theirs);
    } else if (s.choice === 'both') {
      out.push(...s.ours, ...s.theirs);
    } else {
      out.push(s.startMarker, ...s.ours);
      if (s.baseMarker !== undefined) out.push(s.baseMarker, ...(s.base ?? []));
      out.push(s.midMarker, ...s.theirs, s.endMarker);
    }
  }
  return out.join('\n');
}
