import type { FileDiff, DiffHunk, DiffLine } from '../../types';

export function parseDiff(raw: string): FileDiff[] {
  if (!raw.trim()) return [];

  const fileSections = raw.split(/^diff --git /m).filter(Boolean);
  const results: FileDiff[] = [];

  for (const section of fileSections) {
    const lines = section.split('\n');

    let path = '';
    let status: FileDiff['status'] = 'M';

    // Extract path from --- / +++ lines
    const minusLine = lines.find(l => l.startsWith('--- '));
    const plusLine = lines.find(l => l.startsWith('+++ '));

    if (minusLine && plusLine) {
      if (minusLine === '--- /dev/null') {
        status = 'A';
        path = plusLine.replace('+++ b/', '').replace('+++ ', '');
      } else if (plusLine === '+++ /dev/null') {
        status = 'D';
        path = minusLine.replace('--- a/', '').replace('--- ', '');
      } else {
        path = plusLine.replace('+++ b/', '').replace('+++ ', '');
      }
    } else {
      // Fallback: extract from "a/path b/path" header
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

      if (line.startsWith('+') && !line.startsWith('+++')) {
        const dl: DiffLine = { type: 'add', content: line.slice(1), newLineNumber: newLine++ };
        currentHunk.lines.push(dl);
        additions++;
      } else if (line.startsWith('-') && !line.startsWith('---')) {
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
