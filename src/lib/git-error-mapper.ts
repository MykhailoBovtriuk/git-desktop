export type GitErrorKind =
  | 'auth'
  | 'sshKey'
  | 'noUpstream'
  | 'conflict'
  | 'uncommitted'
  | 'notRepo'
  | 'network'
  | 'hook'
  | 'unknown';

export type GitErrorAction = 'publishBranch' | 'signIn';

export interface ClassifiedGitError {
  kind: GitErrorKind;
  action?: GitErrorAction;
}

const RULES: Array<{ kind: GitErrorKind; action?: GitErrorAction; re: RegExp }> = [
  { kind: 'notRepo', re: /not a git repository/i },
  // Before `auth`, and deliberately without a sign-in action: an ssh remote
  // authenticates with a key, so a stored token cannot fix any of these. The
  // app used to offer sign-in here anyway, sending people through a dialog
  // that could not have helped. A locked or deleted key surfaces on fetch and
  // push and, because commits are signed with the same key, on commit too.
  {
    kind: 'sshKey',
    re: /permission denied \(publickey\)|enter passphrase for|incorrect passphrase|couldn't load public key|identity file .* not accessible|host key verification failed/i,
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

export function classifyGitError(input: string | Error | unknown): ClassifiedGitError {
  const text =
    input instanceof Error ? input.message : typeof input === 'string' ? input : String(input);

  for (const rule of RULES) {
    if (rule.re.test(text)) {
      return rule.action ? { kind: rule.kind, action: rule.action } : { kind: rule.kind };
    }
  }
  return { kind: 'unknown' };
}
