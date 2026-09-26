// Extract one hunk from a single-file diff into a patch `git apply` accepts,
// for hunk-level staging. Sliced verbatim, since parse-diff drops byte-level
// details. `hunkIndex` is 0-based in DiffViewer order.
export function buildHunkPatch(rawDiff: string, hunkIndex: number): string {
  const lines = rawDiff.split('\n');

  const firstHunk = lines.findIndex(l => l.startsWith('@@ '));
  if (firstHunk === -1) {
    throw new Error('Cannot stage hunk: diff contains no hunks');
  }

  const preamble = lines.slice(0, firstHunk);

  const hunkStarts: number[] = [];
  for (let i = firstHunk; i < lines.length; i++) {
    if (lines[i].startsWith('@@ ')) hunkStarts.push(i);
  }

  if (hunkIndex < 0 || hunkIndex >= hunkStarts.length) {
    throw new Error(
      `Cannot stage hunk: index ${hunkIndex} out of range (${hunkStarts.length} hunks)`,
    );
  }

  const start = hunkStarts[hunkIndex];
  const end = hunkIndex + 1 < hunkStarts.length ? hunkStarts[hunkIndex + 1] : lines.length;
  const hunk = lines.slice(start, end);

  const patch = [...preamble, ...hunk].join('\n').replace(/\n*$/, '');
  return patch + '\n';
}
