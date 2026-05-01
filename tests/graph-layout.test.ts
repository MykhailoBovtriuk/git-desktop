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
});
