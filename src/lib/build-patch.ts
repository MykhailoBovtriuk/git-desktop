// Extract a single hunk from a one-file unified diff into a minimal, valid
// patch that `git apply` can apply on its own — the basis for hunk-level
// staging.
//
// We slice the hunk verbatim from the original diff text rather than
// re-synthesising it from parsed DiffHunk/DiffLine data, because parse-diff
// intentionally drops the "\ No newline at end of file" marker and normalises
// away byte-level details (CRLF, tabs). Slicing preserves the diff exactly, so
// `git apply --cached` never rejects a reconstructed-but-subtly-wrong patch.
//
// `rawDiff` is the output of `git diff [--cached] -- <file>` for a single file
// (what DiffViewer already fetches). `hunkIndex` is the 0-based position of the
// hunk among that file's hunks — the same order DiffViewer renders them.
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
