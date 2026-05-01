import { describe, it, expect } from 'vitest';
import { parseDiff } from '../src/components/diff/parse-diff';

describe('parseDiff', () => {
  it('returns empty array for empty input', () => {
    expect(parseDiff('')).toEqual([]);
    expect(parseDiff('   ')).toEqual([]);
  });

  it('parses a simple modified file', () => {
    const raw = `diff --git a/src/foo.ts b/src/foo.ts
index abc..def 100644
--- a/src/foo.ts
+++ b/src/foo.ts
@@ -1,3 +1,4 @@
 line1
-line2
+line2 modified
+new line
 line3`;

    const diffs = parseDiff(raw);
    expect(diffs).toHaveLength(1);
    expect(diffs[0].path).toBe('src/foo.ts');
    expect(diffs[0].status).toBe('M');
    expect(diffs[0].additions).toBe(2);
    expect(diffs[0].deletions).toBe(1);
    expect(diffs[0].hunks).toHaveLength(1);
    expect(diffs[0].hunks[0].lines.some(l => l.type === 'add')).toBe(true);
    expect(diffs[0].hunks[0].lines.some(l => l.type === 'remove')).toBe(true);
  });

  it('parses a new file (--- /dev/null)', () => {
    const raw = `diff --git a/newfile.ts b/newfile.ts
new file mode 100644
index 0000000..abc1234
--- /dev/null
+++ b/newfile.ts
@@ -0,0 +1,2 @@
+line1
+line2`;

    const diffs = parseDiff(raw);
    expect(diffs).toHaveLength(1);
    expect(diffs[0].status).toBe('A');
    expect(diffs[0].additions).toBe(2);
    expect(diffs[0].deletions).toBe(0);
  });

  it('parses a deleted file (+++ /dev/null)', () => {
    const raw = `diff --git a/old.ts b/old.ts
deleted file mode 100644
index abc1234..0000000
--- a/old.ts
+++ /dev/null
@@ -1,2 +0,0 @@
-line1
-line2`;

    const diffs = parseDiff(raw);
    expect(diffs).toHaveLength(1);
    expect(diffs[0].status).toBe('D');
    expect(diffs[0].deletions).toBe(2);
    expect(diffs[0].additions).toBe(0);
  });

  it('assigns correct line numbers', () => {
    const raw = `diff --git a/a.ts b/a.ts
--- a/a.ts
+++ b/a.ts
@@ -5,3 +5,3 @@
 context
-removed
+added
 context2`;

    const diffs = parseDiff(raw);
    const lines = diffs[0].hunks[0].lines;
    expect(lines[0].type).toBe('context');
    expect(lines[0].oldLineNumber).toBe(5);
    expect(lines[0].newLineNumber).toBe(5);
    expect(lines[1].type).toBe('remove');
    expect(lines[1].oldLineNumber).toBe(6);
    expect(lines[2].type).toBe('add');
    expect(lines[2].newLineNumber).toBe(6);
  });
});
