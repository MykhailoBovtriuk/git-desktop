/**
 * Accounts are keyed by host alone: `git credential` addresses by protocol and
 * host, so two accounts on one host could not be told apart.
 */
export const accountIdFor = (host: string): string => host;
