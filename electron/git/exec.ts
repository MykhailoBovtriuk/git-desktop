import { execFile } from 'child_process';
import { promisify } from 'util';

const run = promisify(execFile);

/**
 * A one-off git command outside simple-git (config reads and writes, mostly),
 * resolving to its stdout. execFile, never a shell: arguments stay arguments.
 */
export async function runGit(args: string[], opts: { timeout?: number } = {}): Promise<string> {
  const { stdout } = await run('git', args, opts);
  return stdout;
}

export type ConfigScope =
  | { kind: 'global' }
  | { kind: 'local'; repoRoot: string }
  | { kind: 'effective'; repoRoot: string };

function configArgs(scope: ConfigScope): string[] {
  if (scope.kind === 'global') return ['config', '--global'];
  if (scope.kind === 'local') return ['-C', scope.repoRoot, 'config', '--local'];
  return ['-C', scope.repoRoot, 'config'];
}

export async function gitConfigGet(scope: ConfigScope, key: string): Promise<string> {
  try {
    return (await runGit([...configArgs(scope), '--get', key])).trim();
  } catch {
    return '';
  }
}

export async function gitConfigSet(scope: ConfigScope, key: string, value: string): Promise<void> {
  await runGit([...configArgs(scope), key, value]);
}

/** Exit code 5 means "was not set": the state the caller wants either way. */
export async function gitConfigUnset(scope: ConfigScope, key: string): Promise<void> {
  await runGit([...configArgs(scope), '--unset', key]).catch((err: { code?: number }) => {
    if (err.code !== 5) throw err;
  });
}
