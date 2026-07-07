import type { FileDiff, DiffHunk, DiffLine } from '../../types';

// Strip the surrounding C-quotes (git quotes paths containing special chars)
// and the a// b/ prefix from a `---`/`+++`/`rename to` path token.
function cleanPath(raw: string): string {
  let p = raw.trim();
  if (p.length >= 2 && p.startsWith('"') && p.endsWith('"')) {
    p = p.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  if (p === '/dev/null') return p;
  return p.replace(/^[ab]\//, '');
}

export function parseDiff(raw: string): FileDiff[] {
  if (!raw.trim()) return [];

  const fileSections = raw.split(/^diff --git /m).filter(Boolean);
  const results: FileDiff[] = [];

  for (const section of fileSections) {
    const lines = section.split('\n');

    let path = '';
    let status: FileDiff['status'] = 'M';

    // Rename/copy metadata takes precedence for status; the "to" side is the
    // path we display.
    const renameTo = lines.find(l => l.startsWith('rename to '));
    const copyTo = lines.find(l => l.startsWith('copy to '));
    if (lines.some(l => l.startsWith('rename from '))) status = 'R';
    if (lines.some(l => l.startsWith('copy from '))) status = 'C';

    const minusLine = lines.find(l => l.startsWith('--- '));
    const plusLine = lines.find(l => l.startsWith('+++ '));

    if (minusLine && plusLine) {
      if (minusLine === '--- /dev/null') {
        status = 'A';
        path = cleanPath(plusLine.slice(4));
      } else if (plusLine === '+++ /dev/null') {
        status = 'D';
        path = cleanPath(minusLine.slice(4));
      } else {
        // Modified (or rename/copy with edits — status already set above).
        path = cleanPath(plusLine.slice(4));
      }
    } else if (renameTo) {
      // Pure rename (100% similarity): no ---/+++ hunk headers.
      path = cleanPath(renameTo.slice('rename to '.length));
    } else if (copyTo) {
      path = cleanPath(copyTo.slice('copy to '.length));
    } else {
      // Fallback: "a/path b/path" header. Best-effort and ambiguous when paths
      // contain spaces, but the ---/+++ lines above normally cover real diffs.
      const match = lines[0]?.match(/^a\/(.+?) b\/.+$/);
      if (match) path = match[1];
    }

    if (!path) continue;

    // Check for binary file
    if (lines.some(l => l.startsWith('Binary files'))) {
      results.push({ path, status, hunks: [], additions: 0, deletions: 0 });
      continue;
    }

    const hunks: DiffHunk[] = [];
    let additions = 0;
    let deletions = 0;
    let currentHunk: DiffHunk | null = null;
    let oldLine = 0;
    let newLine = 0;

    for (const line of lines) {
      // "\ No newline at end of file" is a marker, not content.
      if (line.startsWith('\\')) continue;

      const hunkMatch = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
      if (hunkMatch) {
        currentHunk = {
          oldStart: parseInt(hunkMatch[1], 10),
          oldCount: parseInt(hunkMatch[2] ?? '1', 10),
          newStart: parseInt(hunkMatch[3], 10),
          newCount: parseInt(hunkMatch[4] ?? '1', 10),
          lines: [],
        };
        hunks.push(currentHunk);
        oldLine = currentHunk.oldStart;
        newLine = currentHunk.newStart;
        continue;
      }

      if (!currentHunk) continue;

      // ---/+++ headers only appear before the first hunk (currentHunk is
      // null there), so inside a hunk the first char alone decides: a removed
      // line with content "--x" legitimately renders as "---x".
      if (line.startsWith('+')) {
        const dl: DiffLine = { type: 'add', content: line.slice(1), newLineNumber: newLine++ };
        currentHunk.lines.push(dl);
        additions++;
      } else if (line.startsWith('-')) {
        const dl: DiffLine = { type: 'remove', content: line.slice(1), oldLineNumber: oldLine++ };
        currentHunk.lines.push(dl);
        deletions++;
      } else if (line.startsWith(' ')) {
        const dl: DiffLine = { type: 'context', content: line.slice(1), oldLineNumber: oldLine++, newLineNumber: newLine++ };
        currentHunk.lines.push(dl);
      }
    }

    results.push({ path, status, hunks, additions, deletions });
  }

  return results;
}
