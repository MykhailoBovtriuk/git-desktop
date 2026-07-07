import { describe, it, expect } from 'vitest';
import { parseConflicts, rebuild, type Segment } from '../../src/lib/merge-conflicts';

const conflictOf = (segs: Segment[]) => {
  const seg = segs.find(s => s.type === 'conflict');
  if (!seg || seg.type !== 'conflict') throw new Error('no conflict segment');
  return seg;
};

const resolve = (segs: Segment[], choice: 'ours' | 'theirs' | 'both') =>
  segs.map(s => (s.type === 'conflict' ? { ...s, choice } : s));

describe('parseConflicts', () => {
  it('splits common text and a conflict block', () => {
    const segs = parseConflicts('before\n<<<<<<< HEAD\nmine\n=======\ntheirs\n>>>>>>> feature\nafter');
    expect(segs).toHaveLength(3);
    expect(segs[0]).toMatchObject({ type: 'common', lines: ['before'] });
    expect(conflictOf(segs)).toMatchObject({ ours: ['mine'], theirs: ['theirs'], choice: null });
    expect(segs[2]).toMatchObject({ type: 'common', lines: ['after'] });
  });

  it('handles an empty side (delete/modify conflict)', () => {
    const segs = parseConflicts('<<<<<<< HEAD\n=======\nkept\n>>>>>>> feature');
    expect(conflictOf(segs).ours).toEqual([]);
    expect(conflictOf(segs).theirs).toEqual(['kept']);
  });

  it('skips the diff3 base section', () => {
    const segs = parseConflicts('<<<<<<< HEAD\nmine\n||||||| base\nold\n=======\ntheirs\n>>>>>>> feature');
    expect(conflictOf(segs)).toMatchObject({ ours: ['mine'], theirs: ['theirs'] });
  });

  // Regression: startsWith('=======') also matched content like a
  // "========================" comment ruler, silently corrupting the file.
  it('does not treat longer runs of marker chars as markers', () => {
    const content = '<<<<<<< HEAD\nmine\n========\nstill mine\n=======\ntheirs\n>>>>>>>> not-a-marker\nstill theirs\n>>>>>>> feature';
    const seg = conflictOf(parseConflicts(content));
    expect(seg.ours).toEqual(['mine', '========', 'still mine']);
    expect(seg.theirs).toEqual(['theirs', '>>>>>>>> not-a-marker', 'still theirs']);
  });

  it('requires a space or line end after <<<<<<<', () => {
    const segs = parseConflicts('<<<<<<<not-a-marker\ntext');
    expect(segs).toEqual([{ type: 'common', lines: ['<<<<<<<not-a-marker', 'text'] }]);
  });

  // Malformed input must never be silently reshuffled — keep it as plain text.
  it('treats an unterminated conflict block as common text', () => {
    const content = 'a\n<<<<<<< HEAD\nmine\n=======\ntheirs but no end';
    const segs = parseConflicts(content);
    expect(segs.every(s => s.type === 'common')).toBe(true);
    expect(rebuild(segs)).toBe(content);
  });

  it('treats a block missing ======= as common text', () => {
    const content = '<<<<<<< HEAD\nmine\n>>>>>>> feature';
    const segs = parseConflicts(content);
    expect(segs.every(s => s.type === 'common')).toBe(true);
    expect(rebuild(segs)).toBe(content);
  });

  it('parses CRLF files', () => {
    const segs = parseConflicts('before\r\n<<<<<<< HEAD\r\nmine\r\n=======\r\ntheirs\r\n>>>>>>> feature\r\nafter');
    const seg = conflictOf(segs);
    expect(seg.ours).toEqual(['mine\r']);
    expect(seg.theirs).toEqual(['theirs\r']);
  });
});

describe('rebuild', () => {
  const content = 'before\n<<<<<<< HEAD\nmine\n=======\ntheirs\n>>>>>>> feature\nafter';

  it('applies ours / theirs / both choices', () => {
    const segs = parseConflicts(content);
    expect(rebuild(resolve(segs, 'ours'))).toBe('before\nmine\nafter');
    expect(rebuild(resolve(segs, 'theirs'))).toBe('before\ntheirs\nafter');
    expect(rebuild(resolve(segs, 'both'))).toBe('before\nmine\ntheirs\nafter');
  });

  // Regression: joining string blocks with '\n' turned an empty side into a
  // spurious blank line ("a\n\nb" instead of "a\nb").
  it('choosing an empty side does not insert a blank line', () => {
    const segs = parseConflicts('before\n<<<<<<< HEAD\n=======\ntheirs\n>>>>>>> feature\nafter');
    expect(rebuild(resolve(segs, 'ours'))).toBe('before\nafter');
  });

  // Regression: unresolved blocks were re-serialized as "<<<<<<< HEAD ... >>>>>>>",
  // losing the real labels (and the diff3 base section entirely).
  it('keeps unresolved blocks verbatim, including labels and diff3 base', () => {
    const diff3 = 'a\n<<<<<<< ours-label\nmine\n||||||| base-label\nold\n=======\ntheirs\n>>>>>>> theirs-label\nb';
    expect(rebuild(parseConflicts(diff3))).toBe(diff3);
  });

  it('round-trips a file with a trailing newline', () => {
    const withTrailing = `${content}\n`;
    expect(rebuild(parseConflicts(withTrailing))).toBe(withTrailing);
  });
});
