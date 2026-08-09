import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import type { GitStatus, FileStatus } from '../../src/types';
import { GitContext } from './context';
import { readFile } from './files';

export async function getStatus(
  ctx: GitContext,
): Promise<GitStatus & { ahead: number; behind: number }> {
  const status = await ctx.ensureRepo().status();

  const staged: FileStatus[] = [];
  const unstaged: FileStatus[] = [];
  const conflicted = new Set(status.conflicted);

  for (const file of status.files) {
    if (conflicted.has(file.path)) {
      unstaged.push({ path: file.path, status: 'U', staged: false });
      continue;
    }

    const stagedCode = file.index;
    const unstagedCode = file.working_dir;

    if (stagedCode && stagedCode !== ' ' && stagedCode !== '?') {
      staged.push({ path: file.path, status: mapStatus(stagedCode), staged: true });
    }

    if (unstagedCode && unstagedCode !== ' ') {
      unstaged.push({
        path: file.path,
        status: unstagedCode === '?' ? 'N' : mapStatus(unstagedCode),
        staged: false,
      });
    }
  }

  return { staged, unstaged, ahead: status.ahead, behind: status.behind };
}

function mapStatus(code: string): FileStatus['status'] {
  const map: Record<string, FileStatus['status']> = {
    A: 'A',
    M: 'M',
    D: 'D',
    R: 'R',
    C: 'C',
    U: 'U',
    '?': 'N',
  };
  return map[code] ?? 'M';
}

export async function stageFiles(ctx: GitContext, paths: string[]): Promise<void> {
  // `--` so a path like "-A" is never parsed as a flag.
  await ctx.ensureRepo().raw(['add', '--', ...paths]);
}

export async function unstageFiles(ctx: GitContext, paths: string[]): Promise<void> {
  const git = ctx.ensureRepo();
  try {
    await git.raw(['restore', '--staged', '--', ...paths]);
  } catch (err) {
    // `restore --staged` restores the index from HEAD, which does not exist
    // in an empty repo (unborn HEAD). Dropping the entries from the index
    // is the equivalent operation there; the working-tree files are kept.
    if (await ctx.hasHead()) throw err;
    await git.raw(['rm', '--cached', '--quiet', '--', ...paths]);
  }
}

export async function discardChanges(ctx: GitContext, paths: string[]): Promise<void> {
  const git = ctx.ensureRepo();
  const status = await git.status();
  const untracked = new Set(status.not_added);
  const trackedPaths = paths.filter(p => !untracked.has(p));
  const untrackedPaths = paths.filter(p => untracked.has(p));
  // Tracked changes/deletions are restored from HEAD; `git checkout` cannot
  // remove untracked files, so those are deleted with `clean` (-d to also
  // remove fully-untracked directories).
  if (trackedPaths.length) {
    await git.checkout(['--', ...trackedPaths]);
  }
  if (untrackedPaths.length) {
    await git.raw(['clean', '-f', '-d', '--', ...untrackedPaths]);
  }
}

export async function commit(ctx: GitContext, message: string): Promise<string> {
  const result = await ctx.ensureRepo().commit(message);
  return result.commit;
}

/**
 * Apply a unified-diff patch to the index (hunk-level staging). simple-git
 * cannot pipe a patch to `git apply` via stdin, so we write it to a temp file
 * and pass the path. `--cached` targets the index; `--reverse` unstages
 * (applying the staged hunk backwards). --whitespace=nowarn keeps intentional
 * whitespace-only hunks from being rejected.
 */
export async function applyPatch(
  ctx: GitContext,
  patch: string,
  opts: { cached?: boolean; reverse?: boolean } = {},
): Promise<void> {
  const git = ctx.ensureRepo();
  const tmpFile = path.join(os.tmpdir(), `git-desktop-${process.pid}-${Date.now()}.patch`);
  await fs.writeFile(tmpFile, patch, 'utf8');
  try {
    const args = ['apply'];
    if (opts.cached !== false) args.push('--cached');
    if (opts.reverse) args.push('--reverse');
    args.push('--whitespace=nowarn', tmpFile);
    await git.raw(args);
  } finally {
    await fs.unlink(tmpFile).catch(() => {});
  }
}

export async function getWorkingDiff(ctx: GitContext, filePath: string): Promise<string> {
  const git = ctx.ensureRepo();
  const status = await git.status();
  if (status.not_added.includes(filePath)) {
    return synthesizeUntrackedDiff(ctx, filePath);
  }
  return git.diff(['--', filePath]);
}

// Untracked files have no diff against the index, so build a synthetic "new
// file" patch (every line added) that the diff viewer can render and stage.
async function synthesizeUntrackedDiff(ctx: GitContext, filePath: string): Promise<string> {
  try {
    const content = await readFile(ctx, filePath);
    if (content.includes('\0')) {
      return [
        `diff --git a/${filePath} b/${filePath}`,
        `new file mode 100644`,
        `Binary files /dev/null and b/${filePath} differ`,
      ].join('\n');
    }
    const hasTrailingNewline = content.endsWith('\n');
    const all = content.split('\n');
    const lines = hasTrailingNewline ? all.slice(0, -1) : all;
    const lineCount = lines.length;
    if (lineCount === 0) {
      return [
        `diff --git a/${filePath} b/${filePath}`,
        `new file mode 100644`,
        `--- /dev/null`,
        `+++ b/${filePath}`,
      ].join('\n');
    }
    const header = [
      `diff --git a/${filePath} b/${filePath}`,
      `new file mode 100644`,
      `index 0000000..0000000`,
      `--- /dev/null`,
      `+++ b/${filePath}`,
      `@@ -0,0 +1,${lineCount} @@`,
    ].join('\n');
    const body = lines.map(l => `+${l}`).join('\n');
    return `${header}\n${body}`;
  } catch {
    return '';
  }
}

export async function getStagedDiff(ctx: GitContext, filePath: string): Promise<string> {
  return ctx.ensureRepo().diff(['--cached', '--', filePath]);
}
