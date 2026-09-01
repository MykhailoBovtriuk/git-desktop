export type GitErrorKind =
  'auth' | 'noUpstream' | 'conflict' | 'uncommitted' | 'notRepo' | 'network' | 'hook' | 'unknown';

export type GitErrorAction = 'publishBranch' | 'signIn';

export interface ClassifiedGitError {
  kind: GitErrorKind;
  action?: GitErrorAction;
}

const RULES: Array<{ kind: GitErrorKind; action?: GitErrorAction; re: RegExp }> = [
  { kind: 'notRepo', re: /not a git repository/i },
  {
    kind: 'auth',
    action: 'signIn',
    // The passphrase and key-file clauses cover a locked or deleted SSH key.
    // Both surface on fetch/push and, because commits are signed with the same
    // key, on commit as well — a deleted signing key stops commits outright.
    // Without these a user whose key vanished gets an error with no way forward.
    re: /authentication failed|could not read (username|password)|permission denied \(publickey\)|invalid username or password|remote: (invalid|forbidden)|returned error: 40[13]|terminal prompts disabled|enter passphrase for|incorrect passphrase|couldn't load public key|identity file .* not accessible/i,
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
