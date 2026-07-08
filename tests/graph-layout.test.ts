import { describe, it, expect } from 'vitest';
import { computeLayout } from '../src/components/graph/graph-layout';
import type { Commit } from '../src/types';

const makeCommit = (hash: string, parents: string[]): Commit => ({
  hash, abbreviatedHash: hash.slice(0, 7), message: `Commit ${hash}`,
  author: 'Test', date: new Date().toISOString(), parents, refs: [],
});

describe('computeLayout', () => {
  it('returns empty array for empty input', () => {
    expect(computeLayout([])).toEqual([]);
  });

  it('output length matches input length', () => {
    const commits = [
      makeCommit('c', ['b']),
      makeCommit('b', ['a']),
      makeCommit('a', []),
    ];
    expect(computeLayout(commits)).toHaveLength(3);
  });

  it('linear commits all get lane 0', () => {
    const commits = [
      makeCommit('c', ['b']),
      makeCommit('b', ['a']),
      makeCommit('a', []),
    ];
    const layout = computeLayout(commits);
    expect(layout.every(l => l.lane === 0)).toBe(true);
  });

  it('assigns row index matching position', () => {
    const commits = [makeCommit('a', []), makeCommit('b', [])];
    const layout = computeLayout(commits);
    expect(layout[0].row).toBe(0);
    expect(layout[1].row).toBe(1);
  });

  it('all commits have a color', () => {
    const commits = [makeCommit('a', []), makeCommit('b', [])];
    const layout = computeLayout(commits);
    expect(layout.every(l => typeof l.color === 'string' && l.color.startsWith('#'))).toBe(true);
  });

  it('initial commit (no parents) has no edges', () => {
    const commits = [makeCommit('a', [])];
    const layout = computeLayout(commits);
    expect(layout[0].edges).toHaveLength(0);
  });

  it('merge commit (2 parents) produces 2 edges', () => {
    const commits = [
      makeCommit('merge', ['main', 'feature']),
      makeCommit('main', []),
      makeCommit('feature', []),
    ];
    const layout = computeLayout(commits);
    expect(layout[0].edges).toHaveLength(2);
  });

  describe('shared parent across branches (lane leak)', () => {
    // History: merge commit `m` joins `a` (first parent) and `b`;
    // `b` also descends from `a`. With the leak, `a` ends up occupying
    // two lanes at once: lane 0 (assigned by `m`) and lane 1 (assigned
    // unconditionally by `b` as its first parent).
    const commits = [
      makeCommit('m', ['a', 'b']),
      makeCommit('b', ['a']),
      makeCommit('a', ['z']),
      makeCommit('z', []),
    ];

    it('edges from all children converge to the lane where the parent dot is drawn', () => {
      const layout = computeLayout(commits);
      for (const parent of layout) {
        for (const child of layout) {
          for (const edge of child.edges) {
            if (edge.toRow === parent.row) {
              expect(edge.toLane).toBe(parent.lane);
            }
          }
        }
      }
    });

    it('no hash occupies two lanes: edges to the same row share one toLane', () => {
      const layout = computeLayout(commits);
      const lanesByRow = new Map<number, Set<number>>();
      for (const item of layout) {
        for (const edge of item.edges) {
          const set = lanesByRow.get(edge.toRow) ?? new Set<number>();
          set.add(edge.toLane);
          lanesByRow.set(edge.toRow, set);
        }
      }
      for (const set of lanesByRow.values()) {
        expect(set.size).toBe(1);
      }
    });

    it('lane count stays minimal after the branches rejoin', () => {
      // A second, independent merge after the first one has fully
      // resolved. With the leak, `a` still occupies lane 1, so `m2`
      // is pushed out to lane 2 even though lanes 0-1 suffice.
      const extended = [
        makeCommit('m', ['a', 'b']),
        makeCommit('b', ['a']),
        makeCommit('a', ['e']),
        makeCommit('m2', ['e', 'f']),
        makeCommit('e', []),
        makeCommit('f', []),
      ];
      const layout = computeLayout(extended);
      const maxLane = Math.max(
        ...layout.map(l => l.lane),
        ...layout.flatMap(l => l.edges.map(e => e.toLane)),
      );
      expect(maxLane).toBeLessThanOrEqual(1);
    });
  });
});
