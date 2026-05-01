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

const COLORS = [
  '#89b4fa', '#a6e3a1', '#f9e2af', '#f38ba8',
  '#fab387', '#cba6f7', '#94e2d5', '#89dceb',
];

export function computeLayout(commits: Commit[]): LayoutCommit[] {
  // lanes[i] = hash of commit expected next in lane i (null = free)
  const lanes: (string | null)[] = [];
  const result: LayoutCommit[] = [];

  const findLane = (hash: string): number => {
    const idx = lanes.indexOf(hash);
    if (idx !== -1) return idx;
    // Find first free lane
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

    // Ensure lanes array is large enough
    while (lanes.length <= lane) lanes.push(null);
    lanes[lane] = null; // this commit is now processed

    const color = COLORS[lane % COLORS.length];
    const edges: Edge[] = [];

    for (let p = 0; p < commit.parents.length; p++) {
      const parentHash = commit.parents[p];
      const parentRow = commits.findIndex(c => c.hash === parentHash);
      if (parentRow === -1) continue;

      let targetLane: number;
      if (p === 0) {
        // First parent continues in the same lane
        targetLane = lane;
        lanes[lane] = parentHash;
      } else {
        // Additional parents get their own lane
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
