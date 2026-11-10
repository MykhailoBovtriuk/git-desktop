import type { AuthSource } from '../types';

export type GitErrorKind =
  | 'orgAccess'
  | 'auth'
  | 'sshKey'
  | 'noUpstream'
  | 'conflict'
  | 'uncommitted'
  | 'notRepo'
  | 'network'
  | 'hook'
  | 'unknown';

export type GitErrorAction = 'publishBranch' | 'signIn' | 'requestOrgAccess';

interface ClassifiedGitError {
  kind: GitErrorKind;
  action?: GitErrorAction;
}

export interface GitErrorContext {
  host: string | null;
  authSource: AuthSource | null;
}

interface Rule {
  kind: GitErrorKind;
  action?: GitErrorAction;
  re: RegExp;
  when?: (ctx: GitErrorContext) => boolean;
}

const RULES: Rule[] = [
  { kind: 'notRepo', re: /not a git repository/i },
  // Before `auth` and without a sign-in action: a token cannot fix an ssh key
  // problem.
  {
    kind: 'sshKey',
    re: /permission denied \(publickey\)|enter passphrase for|incorrect passphrase|couldn't load public key|identity file .* not accessible|host key verification failed/i,
  },
  // An organization that has not approved our OAuth app answers our token with
  // 403, or with 404 for a private repo; signing in again cannot fix either. A
  // repo that really is gone also gives 404, so the hint must not assert why.
  {
    kind: 'orgAccess',
    action: 'requestOrgAccess',
    when: ctx => ctx.authSource === 'account' && ctx.host?.toLowerCase() === 'github.com',
    re: /returned error: 40[34]|repository not found|remote: permission to .* denied/i,
  },
  {
    kind: 'auth',
    action: 'signIn',
    re: /authentication failed|could not read (username|password)|invalid username or password|remote: (invalid|forbidden)|returned error: 40[13]|terminal prompts disabled/i,
  },
  {
    kind: 'noUpstream',
    action: 'publishBranch',
    re: /no upstream branch|has no upstream|--set-upstream|no tracking information/i,
  },
  {
    kind: 'uncommitted',
    re: /would be overwritten by (checkout|merge|rebase)|commit your changes or stash|local changes to the following/i,
  },
  { kind: 'conflict', re: /conflict|automatic merge failed|needs merge|fix conflicts/i },
  {
    kind: 'hook',
    re: /hook (declined|failed|returned)|pre-commit|pre-push|prepare-commit-msg|commit-msg hook/i,
  },
  {
    kind: 'network',
    re: /could not resolve host|failed to connect|connection timed out|unable to access|network is unreachable|ssl certificate|proxy/i,
  },
];

export function classifyGitError(
  input: string | Error | unknown,
  ctx?: GitErrorContext,
): ClassifiedGitError {
  const text =
    input instanceof Error ? input.message : typeof input === 'string' ? input : String(input);

  for (const rule of RULES) {
    if (rule.when && !(ctx && rule.when(ctx))) continue;
    if (rule.re.test(text)) {
      return rule.action ? { kind: rule.kind, action: rule.action } : { kind: rule.kind };
    }
  }
  return { kind: 'unknown' };
}
