/**
 * The key an account is filed under: the host, and nothing else.
 *
 * `git credential` addresses a credential by `protocol` and `host`, and this
 * app never rewrites a remote URL to carry a username — so two accounts on the
 * same host would be two entries git cannot tell apart, and whichever the
 * helper answered with would win. Filing by host keeps the app's model and
 * git's model the same one, and signing in again simply replaces the account.
 *
 * Its own module so the token store and the sign-in flow can both use it
 * without importing each other — they already point the other way, and a cycle
 * between the two would be a trap for whoever touches them next.
 */
export const accountIdFor = (host: string): string => host;
