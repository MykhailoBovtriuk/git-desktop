// Classifies a raw git error string into a small set of actionable kinds, so
// the UI can show a human-friendly message (and offer a follow-up action)
// instead of dumping the raw stderr into a toast.
//
// Pure classifier: it returns a `kind` + optional `action` id. Translation of
// title/message lives in the UI layer (i18n `errors` namespace), keyed by kind.

export type GitErrorKind =
  'auth' | 'noUpstream' | 'conflict' | 'uncommitted' | 'notRepo' | 'network' | 'hook' | 'unknown';

export type GitErrorAction = 'publishBranch' | 'credentialHelp';

export interface ClassifiedGitError {
  kind: GitErrorKind;
  action?: GitErrorAction;
}

// Ordered most-specific → most-generic. Auth is checked before network because
// an HTTPS auth failure ("The requested URL returned error: 403") also matches
// the generic "unable to access" network wording.
const RULES: Array<{ kind: GitErrorKind; action?: GitErrorAction; re: RegExp }> = [
  { kind: 'notRepo', re: /not a git repository/i },
  {
    kind: 'auth',
    action: 'credentialHelp',
    re: /authentication failed|could not read (username|password)|permission denied \(publickey\)|invalid username or password|remote: (invalid|forbidden)|returned error: 40[13]|terminal prompts disabled/i,
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
