import { describe, it, expect } from 'vitest';
import { buildHunkPatch } from '../../src/lib/build-patch';

// A modified file with two hunks.
const TWO_HUNK = [
  'diff --git a/f.txt b/f.txt',
  'index 1111111..2222222 100644',
  '--- a/f.txt',
  '+++ b/f.txt',
  '@@ -1,3 +1,3 @@',
  ' line1',
  '-line2',
  '+LINE2',
  ' line3',
  '@@ -10,2 +10,3 @@',
  ' lineA',
  '+inserted',
  ' lineB',
  '',
].join('\n');

const header = ['diff --git a/f.txt b/f.txt', 'index 1111111..2222222 100644', '--- a/f.txt', '+++ b/f.txt'];

describe('buildHunkPatch', () => {
  it('keeps the file header for the selected hunk', () => {
    const patch = buildHunkPatch(TWO_HUNK, 0);
    for (const line of header) expect(patch).toContain(line);
    expect(patch).toContain('@@ -1,3 +1,3 @@');
  });

  it('extracts only the requested hunk (drops the others)', () => {
    const first = buildHunkPatch(TWO_HUNK, 0);
    expect(first).toContain('-line2');
    expect(first).toContain('+LINE2');
    // Second hunk content must be absent.
    expect(first).not.toContain('@@ -10,2 +10,3 @@');
    expect(first).not.toContain('+inserted');

    const second = buildHunkPatch(TWO_HUNK, 1);
    expect(second).toContain('@@ -10,2 +10,3 @@');
    expect(second).toContain('+inserted');
    expect(second).not.toContain('@@ -1,3 +1,3 @@');
    expect(second).not.toContain('+LINE2');
  });

  it('always ends with a trailing newline', () => {
    expect(buildHunkPatch(TWO_HUNK, 0).endsWith('\n')).toBe(true);
  });

  it('preserves the "\\ No newline at end of file" marker verbatim', () => {
    const raw = [
      'diff --git a/f.txt b/f.txt',
      'index 1111111..2222222 100644',
      '--- a/f.txt',
      '+++ b/f.txt',
      '@@ -1 +1 @@',
      '-old',
      '+new',
      '\\ No newline at end of file',
      '',
    ].join('\n');
    const patch = buildHunkPatch(raw, 0);
    expect(patch).toContain('\\ No newline at end of file');
  });

  it('preserves CRLF carriage returns in content lines', () => {
    const raw = [
      'diff --git a/f.txt b/f.txt',
      'index 1111111..2222222 100644',
      '--- a/f.txt',
      '+++ b/f.txt',
      '@@ -1 +1 @@',
      '-old\r',
      '+new\r',
      '',
    ].join('\n');
    const patch = buildHunkPatch(raw, 0);
    expect(patch).toContain('-old\r');
    expect(patch).toContain('+new\r');
  });

  it('handles an add-only hunk (new file)', () => {
    const raw = [
      'diff --git a/n.txt b/n.txt',
      'new file mode 100644',
      'index 0000000..3333333',
      '--- /dev/null',
      '+++ b/n.txt',
      '@@ -0,0 +1,2 @@',
      '+alpha',
      '+beta',
      '',
    ].join('\n');
    const patch = buildHunkPatch(raw, 0);
    expect(patch).toContain('--- /dev/null');
    expect(patch).toContain('+++ b/n.txt');
    expect(patch).toContain('+alpha');
    expect(patch).toContain('+beta');
  });

  it('throws when the hunk index is out of range', () => {
    expect(() => buildHunkPatch(TWO_HUNK, 2)).toThrow();
    expect(() => buildHunkPatch(TWO_HUNK, -1)).toThrow();
  });

  it('throws when the diff has no hunks', () => {
    const noHunk = ['diff --git a/f b/f', 'index 1..2 100644', 'Binary files differ', ''].join('\n');
    expect(() => buildHunkPatch(noHunk, 0)).toThrow();
  });
});
