// Logs end up pasted into chats and issue trackers, so anything that can carry
// a credential is masked before an entry leaves the git process handler.
const PATTERNS: [RegExp, string][] = [
  // https://user:token@host and https://token@host
  [/([a-z][a-z0-9+.-]*:\/\/)[^\s/@]+@/gi, '$1***@'],
  // `-c http.extraheader=Authorization: Bearer …` and plain header echoes
  [/(authorization:\s*(?:basic|bearer|token)?\s*)\S+/gi, '$1***'],
  // Provider token shapes: GitHub, GitLab, Bitbucket app passwords, generic JWTs
  [/\bgh[pousr]_[A-Za-z0-9]{20,}\b/g, '***'],
  [/\bgithub_pat_[A-Za-z0-9_]{20,}\b/g, '***'],
  [/\bglpat-[A-Za-z0-9_-]{20,}\b/g, '***'],
  [/\bATBB[A-Za-z0-9]{20,}\b/g, '***'],
  [/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, '***'],
];

export function redact(text: string): string {
  let out = text;
  for (const [pattern, replacement] of PATTERNS) out = out.replace(pattern, replacement);
  return out;
}
