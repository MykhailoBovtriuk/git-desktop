import type { GitIdentity, GitProfile } from '../types';

/**
 * Which saved profile the open repository is currently using. Matching on
 * name+email (rather than storing an "active id") keeps the answer honest when
 * the repo's config was changed outside the app.
 */
export function matchProfile(
  identity: GitIdentity | null,
  profiles: GitProfile[],
): GitProfile | null {
  if (!identity?.name || !identity.email) return null;
  const email = identity.email.toLowerCase();
  return profiles.find(p => p.name === identity.name && p.email.toLowerCase() === email) ?? null;
}

export function createProfileId(): string {
  return crypto.randomUUID();
}
