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
        if (/overwritten by checkout|commit your changes or stash/i.test(msg)) {
          set({ checkoutConflict: { branch: target } });
          throw new CheckoutConflictError();
        }
        throw err;
      }
    }),

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

  migrateCheckout: async () =>
    get().runOperation('checkout', async () => {
      const conflict = get().checkoutConflict;
      if (!conflict) return;
      set({ checkoutConflict: null });
      try {
        const before = await gitApi.getStashTop();
        await gitApi.stashSave(`Migrating changes to ${conflict.branch}`);
        const after = await gitApi.getStashTop();
        if (!after || after === before) {
          throw new Error('No changes to migrate');
        }
        await gitApi.checkout(conflict.branch);
        await gitApi.stashPop(0);
      } finally {
        await get().refresh();
      }
    }),

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
