import type { Commit } from '../../types';

export interface Edge {
  fromLane: number;
  toLane: number;
  toRow: number;
  color: string;
}

export interface LayoutCommit {
  commit: Commit;
  lane: number;
  row: number;
  color: string;
  edges: Edge[];
}

// CSS variables rather than literals: SVG fill/stroke resolve them at paint
// time, so the graph follows the active theme without recomputing the layout.
const COLORS = [
  'var(--gd-graph-1)',
  'var(--gd-graph-2)',
  'var(--gd-graph-3)',
  'var(--gd-graph-4)',
  'var(--gd-graph-5)',
  'var(--gd-graph-6)',
  'var(--gd-graph-7)',
  'var(--gd-graph-8)',
];

export function computeLayout(commits: Commit[]): LayoutCommit[] {
  const rowByHash = new Map<string, number>();
  commits.forEach((c, i) => rowByHash.set(c.hash, i));

  const lanes: (string | null)[] = [];
  const result: LayoutCommit[] = [];

  const findLane = (hash: string): number => {
    const idx = lanes.indexOf(hash);
    if (idx !== -1) return idx;
    const free = lanes.indexOf(null);
    if (free !== -1) return free;
    return lanes.length;
  };

  const allocateLane = (hash: string): number => {
    const existing = lanes.indexOf(hash);
    if (existing !== -1) return existing;
    const free = lanes.indexOf(null);
    if (free !== -1) {
      lanes[free] = hash;
      return free;
    }
    lanes.push(hash);
    return lanes.length - 1;
  };

  for (let row = 0; row < commits.length; row++) {
    const commit = commits[row];
    const lane = findLane(commit.hash);

    while (lanes.length <= lane) lanes.push(null);
    for (let i = 0; i < lanes.length; i++) {
      if (lanes[i] === commit.hash) lanes[i] = null;
    }
    lanes[lane] = null;

    const color = COLORS[lane % COLORS.length];
    const edges: Edge[] = [];

    for (let p = 0; p < commit.parents.length; p++) {
      const parentHash = commit.parents[p];
      const parentRow = rowByHash.get(parentHash) ?? -1;
      if (parentRow === -1) continue;

      let targetLane: number;
      if (p === 0) {
        const existing = lanes.indexOf(parentHash);
        if (existing !== -1) {
          targetLane = existing;
        } else {
          targetLane = lane;
          lanes[lane] = parentHash;
        }
      } else {
        targetLane = allocateLane(parentHash);
      }

      edges.push({
        fromLane: lane,
        toLane: targetLane,
        toRow: parentRow,
        color: COLORS[targetLane % COLORS.length],
      });
    }

    result.push({ commit, lane, row, color, edges });
  }

  return result;
}
