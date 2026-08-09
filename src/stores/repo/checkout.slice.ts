import { gitApi } from '../../api/git-api';
import type { RepoState, RepoSlice } from './types';

export class CheckoutConflictError extends Error {
  constructor() {
    super('checkout blocked: local changes would be overwritten');
    this.name = 'CheckoutConflictError';
  }
}

type CheckoutSlice = Pick<
  RepoState,
  | 'checkoutConflict'
  | 'checkout'
  | 'stashAndCheckout'
  | 'migrateCheckout'
  | 'forceCheckout'
  | 'cancelCheckout'
>;

export const createCheckoutSlice: RepoSlice<CheckoutSlice> = (set, get) => ({
  checkoutConflict: null,

  checkout: async branch =>
    get().runOperation('checkout', async () => {
      const known = get().branches.find(b => b.name === branch);
      const target = known?.remote ? branch.replace(/^[^/]+\//, '') : branch;
      try {
        await gitApi.checkout(target);
        await get().refresh();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // git aborts the checkout when uncommitted changes would be clobbered.
        // Surface a modal (via checkoutConflict) instead of a raw error toast.
        if (/overwritten by checkout|commit your changes or stash/i.test(msg)) {
          set({ checkoutConflict: { branch: target } });
          throw new CheckoutConflictError();
        }
        throw err;
      }
    }),

  // Set the blocked changes aside in a stash, then switch. Changes stay in the
  // stash (recoverable with stash pop later). refresh() in finally: a failure
  // after the stash was created still changed the repo, and the UI must show it.
  stashAndCheckout: async () =>
    get().runOperation('checkout', async () => {
      const conflict = get().checkoutConflict;
      if (!conflict) return;
      set({ checkoutConflict: null });
      try {
        await gitApi.stashSave(`WIP before switching to ${conflict.branch}`);
        await gitApi.checkout(conflict.branch);
      } finally {
        await get().refresh();
      }
    }),

  // Carry the blocked changes over to the target branch (stash → switch → pop).
  migrateCheckout: async () =>
    get().runOperation('checkout', async () => {
      const conflict = get().checkoutConflict;
      if (!conflict) return;
      set({ checkoutConflict: null });
      try {
        // Confirm a *new* stash was actually created before popping by index, so we
        // never pop a pre-existing/foreign stash if stashSave saved nothing.
        const before = await gitApi.getStashTop();
        await gitApi.stashSave(`Migrating changes to ${conflict.branch}`);
        const after = await gitApi.getStashTop();
        if (!after || after === before) {
          // Nothing was stashed — don't switch on a false premise.
          throw new Error('No changes to migrate');
        }
        await gitApi.checkout(conflict.branch);
        await gitApi.stashPop(0);
      } finally {
        // The failure can land anywhere along the way (branch already switched,
        // pop conflicted) — always resync so the UI shows the actual repo state.
        await get().refresh();
      }
    }),

  // Discard the blocked changes and switch anyway.
  forceCheckout: async () =>
    get().runOperation('checkout', async () => {
      const conflict = get().checkoutConflict;
      if (!conflict) return;
      set({ checkoutConflict: null });
      await gitApi.checkoutForce(conflict.branch);
      await get().refresh();
    }),

  cancelCheckout: () => set({ checkoutConflict: null }),
});
