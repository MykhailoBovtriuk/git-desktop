/**
 * The key an account is filed under.
 *
 * Its own module so the token store and the sign-in flow can both use it
 * without importing each other — they already point the other way, and a cycle
 * between the two would be a trap for whoever touches them next.
 */
export const accountIdFor = (host: string, login: string): string => `${host}|${login}`;
