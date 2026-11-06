import type { SimpleGit } from 'simple-git';
import type {
  RepoIdentity,
  RepoTestResult,
  RepoTestSkip,
  RepoTestStep,
  RepoTestStepResult,
  SshCheckReason,
} from '../../src/types';
import {
  classifyGitError,
  type GitErrorContext,
  type GitErrorKind,
} from '../../src/lib/git-error-mapper';
import { errorMessage } from '../../src/lib/error-message';
import { GitContext, credentialSafeEnv } from '../git/context';
import { currentLogId, logEvent, logged, logIdOf, markErrorKind } from '../log/git-logger';
import { clearIdentityCache, resolveIdentity } from './repo-identity';
import { preferredRemote } from './remote-host';

const TIMEOUT_MS = 30_000;

class StepFailure extends Error {
  constructor(
    message: string,
    readonly kind: GitErrorKind,
    readonly sshReason?: SshCheckReason,
  ) {
    super(message);
  }
}

const SSH_FAILURE: Record<Exclude<SshCheckReason, 'ok'>, { kind: GitErrorKind; text: string }> = {
  'host-key': { kind: 'sshKey', text: 'The host key of this server is not trusted yet' },
  'key-rejected': { kind: 'sshKey', text: 'The server did not accept any SSH key' },
  unreachable: { kind: 'network', text: 'Could not reach the server over SSH' },
  unknown: { kind: 'unknown', text: 'Could not tell whether the SSH key works' },
};

const SKIP_TEXT: Record<RepoTestSkip, string> = {
  'no-commits': 'Skipped: the repository has no commits to test a push with',
  detached: 'Skipped: HEAD is detached, so there is no branch to test a push to',
};

export interface RepoTestDeps {
  git: Pick<SimpleGit, 'raw'>;
  identity: (repoPath: string) => Promise<RepoIdentity>;
}

/**
 * The same git setup as the app's own push, so the same credential helper and
 * ssh resolution apply; prompts are off so nothing can wait for input.
 */
export function testGit(repoPath: string): Pick<SimpleGit, 'raw'> {
  return new GitContext()
    .createGit(repoPath, { timeout: { block: TIMEOUT_MS } })
    .env({ ...credentialSafeEnv(), GCM_INTERACTIVE: 'never' });
}

function freshIdentity(repoPath: string): Promise<RepoIdentity> {
  clearIdentityCache();
  return resolveIdentity(repoPath);
}

async function out(git: RepoTestDeps['git'], args: string[]): Promise<string | null> {
  return (await git.raw(args).catch(() => '')).trim() || null;
}

async function runStep(
  step: RepoTestStep,
  repoPath: string,
  detail: string,
  fn: () => Promise<Partial<RepoTestStepResult> & { message: string }>,
  ctx?: GitErrorContext,
): Promise<RepoTestStepResult> {
  try {
    return await logged('auth-test', repoPath, `${step} · ${detail}`, async () => {
      try {
        return { step, ok: true, logId: currentLogId() ?? null, ...(await fn()) };
      } catch (err: unknown) {
        if (!(err instanceof StepFailure) && classifyGitError(err, ctx).kind === 'orgAccess') {
          markErrorKind('orgAccess');
        }
        throw err;
      }
    });
  } catch (err: unknown) {
    const failure = err instanceof StepFailure ? err : null;
    return {
      step,
      ok: false,
      reasonKind: failure?.kind ?? classifyGitError(err, ctx).kind,
      ...(failure?.sshReason ? { sshReason: failure.sshReason } : {}),
      message: errorMessage(err),
      logId: logIdOf(err) ?? null,
    };
  }
}

function skipStep(step: RepoTestStep, repoPath: string, why: RepoTestSkip): RepoTestStepResult {
  const logId = logEvent({
    op: 'auth-test',
    repoPath,
    status: 'info',
    detail: step,
    error: SKIP_TEXT[why],
  });
  return { step, ok: true, skipped: why, message: SKIP_TEXT[why], logId };
}

async function who(identity: RepoIdentity): Promise<{ message: string }> {
  if (identity.source === 'ssh') {
    const ssh = identity.ssh;
    if (!ssh?.ok) {
      const reason = ssh?.reason && ssh.reason !== 'ok' ? ssh.reason : 'unknown';
      throw new StepFailure(SSH_FAILURE[reason].text, SSH_FAILURE[reason].kind, reason);
    }
    return { message: identity.login ? `SSH key of @${identity.login}` : 'The SSH key works' };
  }
  if (identity.source === 'none') {
    throw new StepFailure(`Nothing signs this repository in to ${identity.host}`, 'auth');
  }
  if (identity.profile === 'rejected') {
    throw new StepFailure(`${identity.host} rejected the credential git has stored for it`, 'auth');
  }
  return {
    message: identity.login
      ? `Signed in as @${identity.login}`
      : 'Signed in; the service did not say as whom',
  };
}

/**
 * Who, read, write — each its own log entry. The write step is
 * `push --dry-run`: it proves the server accepts our credentials for a push
 * without sending anything; `--no-verify` because a dry run still runs the
 * pre-push hook (husky, git-lfs uploads).
 */
export async function runRepoTest(
  repoPath: string,
  deps: RepoTestDeps = { git: testGit(repoPath), identity: freshIdentity },
): Promise<RepoTestResult> {
  const { git } = deps;
  const remote = preferredRemote(await out(git, ['remote']));
  if (!remote) throw new Error('This repository has no remote to test');

  const seen: { identity: RepoIdentity | null } = { identity: null };
  const steps: RepoTestStepResult[] = [];
  steps.push(
    await runStep('who', repoPath, remote, async () => {
      seen.identity = await deps.identity(repoPath);
      return who(seen.identity);
    }),
  );
  const ctx: GitErrorContext = {
    host: seen.identity?.host ?? null,
    authSource: seen.identity?.source ?? null,
  };

  steps.push(
    await runStep(
      'read',
      repoPath,
      remote,
      async () => {
        await git.raw(['ls-remote', '--heads', remote]);
        return { message: 'Read access works' };
      },
      ctx,
    ),
  );

  const head = await out(git, ['rev-parse', '--verify', '--quiet', 'HEAD']);
  const branch = head ? await out(git, ['symbolic-ref', '--quiet', '--short', 'HEAD']) : null;
  if (!head) {
    steps.push(skipStep('write', repoPath, 'no-commits'));
  } else if (!branch) {
    steps.push(skipStep('write', repoPath, 'detached'));
  } else {
    steps.push(
      await runStep(
        'write',
        repoPath,
        `${remote} ${branch}`,
        async () => {
          const args = pushArgs(remote, branch);
          try {
            await git.raw(args);
            return { message: 'Write access works' };
          } catch (err: unknown) {
            // git only knows the branch is behind after the server let it in.
            if (/^!\t.*\t\[rejected\]/m.test(errorMessage(err))) {
              return {
                behind: true,
                message: 'Write access works; the branch is behind the remote',
              };
            }
            throw err;
          }
        },
        ctx,
      ),
    );
  }

  return {
    host: seen.identity?.host ?? null,
    login: seen.identity?.login ?? null,
    ok: steps.every(s => s.ok),
    steps,
    at: Date.now(),
  };
}

export function pushArgs(remote: string, branch: string): string[] {
  return ['push', '--dry-run', '--no-verify', '--porcelain', remote, `HEAD:refs/heads/${branch}`];
}
