import type { RepoState } from './types';

export async function whileCurrent<T>(
  get: () => RepoState,
  fetch: () => Promise<T>,
  apply: (value: T) => void,
): Promise<void> {
  const started = get().epoch;
  const value = await fetch();
  if (get().epoch === started) apply(value);
}
