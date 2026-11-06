import type { AuthSource, ProviderAccount, RemoteProtocol, RepoIdentity } from '../../types';

interface SourceInput {
  protocol: RemoteProtocol | null;
  host: string | null;
  account: ProviderAccount | null;
  authSource: AuthSource | null;
  identity: RepoIdentity | null;
}

/**
 * The identity is resolved in the background and may still describe the
 * remote from before a protocol switch; it only counts once it matches.
 */
export function freshIdentity({ protocol, host, identity }: SourceInput): RepoIdentity | null {
  if (!identity || !host || identity.host !== host) return null;
  if ((identity.source === 'ssh') !== (protocol === 'ssh')) return null;
  return identity;
}

export function connectionSource(input: SourceInput): AuthSource | null {
  if (input.account && input.account.host === input.host) return 'account';
  if (input.protocol === 'ssh') return 'ssh';
  const identity = freshIdentity(input);
  if (identity && identity.source !== 'account') return identity.source;
  return input.authSource === 'account' ? null : input.authSource;
}
