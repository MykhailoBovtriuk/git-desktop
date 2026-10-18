import type { Commit } from '../../src/types';
import { GitContext, EMPTY_TREE } from './context';

export async function getLog(ctx: GitContext, limit: number, offset: number): Promise<Commit[]> {
  const git = ctx.ensureRepo();
  let result: string;
  try {
    result = await git.raw([
      'log',
      // Not --all: that includes refs/stash (plus its "index on ..." helper
      // commits), which are a drawer, not part of the project's history.
      '--branches',
      '--remotes',
      '--tags',
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

/** The commit HEAD points at. Not getLog()[0]: the log spans every branch. */
export async function getHeadCommit(ctx: GitContext): Promise<string | null> {
  if (!(await ctx.hasHead())) return null;
  const out = await ctx.ensureRepo().raw(['rev-parse', '--short', 'HEAD']);
  return out.trim() || null;
}

async function commitRange(ctx: GitContext, hash: string): Promise<[string, string]> {
  return (await ctx.hasParent(hash)) ? [`${hash}^`, hash] : [EMPTY_TREE, hash];
}

export async function getCommitDiff(
  ctx: GitContext,
  hash: string,
): Promise<{ path: string; status: string }[]> {
  const raw = await ctx
    .ensureRepo()
    .raw(['diff', '--name-status', '-z', ...(await commitRange(ctx, hash))]);
  const fields = raw.split('\0').filter(Boolean);
  const files: { path: string; status: string }[] = [];
  for (let i = 0; i < fields.length;) {
    const code = fields[i++];
    const status = code[0];
    // Renames and copies carry the old path first, then the new one.
    if (status === 'R' || status === 'C') i++;
    files.push({ path: fields[i++], status });
  }
  return files;
}

export async function getFileDiff(
  ctx: GitContext,
  hash: string,
  filePath: string,
  ignoreWhitespace = false,
): Promise<string> {
  const range = await commitRange(ctx, hash);
  return ctx.ensureRepo().diff([...(ignoreWhitespace ? ['-w'] : []), ...range, '--', filePath]);
}
