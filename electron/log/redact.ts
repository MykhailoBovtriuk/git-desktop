// Logs end up pasted into chats and issue trackers, so anything that can carry
// a credential is masked before an entry leaves the git process handler.
const PATTERNS: [RegExp, string][] = [
  [/([a-z][a-z0-9+.-]*:\/\/)[^\s/@]+@/gi, '$1***@'],
  [/(authorization:\s*(?:basic|bearer|token)?\s*)\S+/gi, '$1***'],
  [/\bgh[pousr]_[A-Za-z0-9]{20,}\b/g, '***'],
  [/\bgithub_pat_[A-Za-z0-9_]{20,}\b/g, '***'],
  [/\bglpat-[A-Za-z0-9_-]{20,}\b/g, '***'],
  [/\bATBB[A-Za-z0-9]{20,}\b/g, '***'],
  [/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, '***'],
  [/([?&#](?:access_token|refresh_token|id_token|code|client_secret|token)=)[^&#\s]+/gi, '$1***'],
  [/("(?:access_token|refresh_token|id_token|client_secret|password)"\s*:\s*")[^"]+/gi, '$1***'],
  [/\b(Basic|Bearer)\s+[A-Za-z0-9+/=._-]{16,}/g, '$1 ***'],
  [/^password=.*$/gim, 'password=***'],
];

export function redact(text: string): string {
  let out = text;
  for (const [pattern, replacement] of PATTERNS) out = out.replace(pattern, replacement);
  return out;
}
