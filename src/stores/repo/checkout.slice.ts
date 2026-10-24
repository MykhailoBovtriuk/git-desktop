import { gitApi } from '../../api/git-api';
import type { RepoState, RepoSlice } from './types';
import { classifyGitError } from '../../lib/git-error-mapper';

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

export const createCheckoutSlice: RepoSlice<CheckoutSlice> = (set, get) => {
  const takeConflict = (): string | null => {
    const conflict = get().checkoutConflict;
    if (conflict) set({ checkoutConflict: null });
    return conflict?.branch ?? null;
  };

  return {
    checkoutConflict: null,

    checkout: async branch =>
      get().runOperation(async () => {
        const known = get().branches.find(b => b.name === branch);
        const target = known?.remote ? branch.replace(/^[^/]+\//, '') : branch;
        try {
          await gitApi.checkout(target);
          await get().refresh();
        } catch (err) {
          if (classifyGitError(err).kind === 'uncommitted') {
            set({ checkoutConflict: { branch: target } });
            throw new CheckoutConflictError();
          }
          throw err;
        }
      }),

    stashAndCheckout: async () =>
      get().runOperation(async () => {
        const branch = takeConflict();
        if (!branch) return;
        try {
          await gitApi.stashSave(`WIP before switching to ${branch}`);
          await gitApi.checkout(branch);
        } finally {
          await get().refresh();
        }
      }),

    migrateCheckout: async () =>
      get().runOperation(async () => {
        const branch = takeConflict();
        if (!branch) return;
        try {
          const before = await gitApi.getStashTop();
          await gitApi.stashSave(`Migrating changes to ${branch}`);
          const after = await gitApi.getStashTop();
          if (!after || after === before) {
            throw new Error('No changes to migrate');
          }
          await gitApi.checkout(branch);
          await gitApi.stashPop(0);
        } finally {
          await get().refresh();
        }
      }),

    forceCheckout: async () =>
      get().runOperation(async () => {
        const branch = takeConflict();
        if (!branch) return;
        await gitApi.checkoutForce(branch);
        await get().refresh();
      }),

    cancelCheckout: () => set({ checkoutConflict: null }),
  };
};
