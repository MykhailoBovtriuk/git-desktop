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

  // Regression: inside a hunk, a removed line whose content starts with "--"
  // renders in the diff as "---…" and was dropped by the header guards,
  // shifting all following line numbers by one. Same for added "++…" lines.
  it('keeps removed lines whose content starts with --', () => {
    const raw = `diff --git a/counter.c b/counter.c
index abc..def 100644
--- a/counter.c
+++ b/counter.c
@@ -1,3 +1,2 @@
 int i = 10;
---i;
 return i;`;

    const diffs = parseDiff(raw);
    const lines = diffs[0].hunks[0].lines;
    expect(lines).toHaveLength(3);
    expect(lines[1]).toEqual({ type: 'remove', content: '--i;', oldLineNumber: 2 });
    expect(lines[2]).toEqual({
      type: 'context',
      content: 'return i;',
      oldLineNumber: 3,
      newLineNumber: 2,
    });
    expect(diffs[0].deletions).toBe(1);
  });

  it('keeps added lines whose content starts with ++', () => {
    const raw = `diff --git a/counter.c b/counter.c
index abc..def 100644
--- a/counter.c
+++ b/counter.c
@@ -1,2 +1,3 @@
 int i = 10;
+++counter;
 return i;`;

    const diffs = parseDiff(raw);
    const lines = diffs[0].hunks[0].lines;
    expect(lines).toHaveLength(3);
    expect(lines[1]).toEqual({ type: 'add', content: '++counter;', newLineNumber: 2 });
    expect(lines[2]).toEqual({
      type: 'context',
      content: 'return i;',
      oldLineNumber: 2,
      newLineNumber: 3,
    });
    expect(diffs[0].additions).toBe(1);
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

  it('parses a pure rename (100% similarity, no hunks)', () => {
    const raw = `diff --git a/old-name.ts b/new-name.ts
similarity index 100%
rename from old-name.ts
rename to new-name.ts`;

    const diffs = parseDiff(raw);
    expect(diffs).toHaveLength(1);
    expect(diffs[0].status).toBe('R');
    expect(diffs[0].path).toBe('new-name.ts');
    expect(diffs[0].additions).toBe(0);
    expect(diffs[0].deletions).toBe(0);
  });

  it('parses a rename with modifications, reporting the new path and R status', () => {
    const raw = `diff --git a/old.ts b/new.ts
similarity index 80%
rename from old.ts
rename to new.ts
index abc..def 100644
--- a/old.ts
+++ b/new.ts
@@ -1,2 +1,2 @@
 keep
-was
+now`;

    const diffs = parseDiff(raw);
    expect(diffs[0].status).toBe('R');
    expect(diffs[0].path).toBe('new.ts');
    expect(diffs[0].additions).toBe(1);
    expect(diffs[0].deletions).toBe(1);
  });

  it('parses a copied file as status C', () => {
    const raw = `diff --git a/src.ts b/copy.ts
similarity index 100%
copy from src.ts
copy to copy.ts`;

    const diffs = parseDiff(raw);
    expect(diffs[0].status).toBe('C');
    expect(diffs[0].path).toBe('copy.ts');
  });

  it('unquotes a C-quoted path with a space', () => {
    const raw = `diff --git "a/has space.ts" "b/has space.ts"
--- "a/has space.ts"
+++ "b/has space.ts"
@@ -1 +1 @@
-a
+b`;

    const diffs = parseDiff(raw);
    expect(diffs[0].path).toBe('has space.ts');
  });

  it('does not count "\\ No newline at end of file" as a content line', () => {
    const raw = `diff --git a/a.txt b/a.txt
--- a/a.txt
+++ b/a.txt
@@ -1 +1 @@
-old
\\ No newline at end of file
+new
\\ No newline at end of file`;

    const diffs = parseDiff(raw);
    expect(diffs[0].additions).toBe(1);
    expect(diffs[0].deletions).toBe(1);
    expect(diffs[0].hunks[0].lines.every(l => !l.content.includes('No newline'))).toBe(true);
  });

  it('parses multiple files in one diff', () => {
    const raw = `diff --git a/one.ts b/one.ts
--- a/one.ts
+++ b/one.ts
@@ -1 +1 @@
-a
+b
diff --git a/two.ts b/two.ts
--- a/two.ts
+++ b/two.ts
@@ -1 +1 @@
-c
+d`;

    const diffs = parseDiff(raw);
    expect(diffs).toHaveLength(2);
    expect(diffs.map(d => d.path)).toEqual(['one.ts', 'two.ts']);
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
