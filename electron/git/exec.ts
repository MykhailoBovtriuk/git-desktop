import { execFile } from 'child_process';
import { promisify } from 'util';
import { recordCommand } from '../log/git-logger';

const run = promisify(execFile);

export async function runGit(args: string[], opts: { timeout?: number } = {}): Promise<string> {
  try {
    const { stdout, stderr } = await run('git', args, opts);
    recordCommand(['git', ...args], stdout, stderr);
    return stdout;
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    recordCommand(['git', ...args], e.stdout ?? '', e.stderr || e.message || '');
    throw err;
  }
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
export async function gitConfigUnset(scope: ConfigScope, key: string): Promise<boolean> {
  return runGit([...configArgs(scope), '--unset', key]).then(
    () => true,
    (err: { code?: number }) => {
      if (err.code !== 5) throw err;
      return false;
    },
  );
}
