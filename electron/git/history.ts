import type { Commit } from '../../src/types';
import { GitContext, EMPTY_TREE } from './context';

export async function getLog(ctx: GitContext, limit: number, offset: number): Promise<Commit[]> {
  const git = ctx.ensureRepo();
  let result: string;
  try {
    result = await git.raw([
      'log',
      '--all',
      '--topo-order',
      `--max-count=${limit}`,
      `--skip=${offset}`,
      '--format=%H%x00%s%x00%an%x00%aI%x00%P%x00%D',
    ]);
  } catch (err) {
    if (!(await ctx.hasHead())) return [];
    throw err;
  }

  return result
    .trim()
    .split('\n')
    .filter(Boolean)
    .map(line => {
      const [hash, message, author, date, parents, refs] = line.split('\x00');
      return {
        hash,
        abbreviatedHash: hash.slice(0, 7),
        message,
        author,
        date,
        parents: parents ? parents.split(' ').filter(Boolean) : [],
        refs: refs
          ? refs
              .split(',')
              .map(r => r.trim())
              .filter(Boolean)
          : [],
      };
    });
}

async function commitRange(ctx: GitContext, hash: string): Promise<[string, string]> {
  return (await ctx.hasParent(hash)) ? [`${hash}^`, hash] : [EMPTY_TREE, hash];
}

export async function getCommitDiff(
  ctx: GitContext,
  hash: string,
): Promise<{ path: string; status: string }[]> {
  const diff = await ctx.ensureRepo().diffSummary(await commitRange(ctx, hash));
  return diff.files.map(f => ({
    path: f.file,
    status: (f as { status?: string }).status || 'M',
  }));
}

export async function getFileDiff(
  ctx: GitContext,
  hash: string,
  filePath: string,
): Promise<string> {
  const range = await commitRange(ctx, hash);
  return ctx.ensureRepo().diff([...range, '--', filePath]);
}
