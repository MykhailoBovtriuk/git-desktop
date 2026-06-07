import { useRepoStore } from '../../stores/repo-store';
import { useUiStore } from '../../stores/ui-store';
import { Button, Modal } from '../../shared/ui';

export function CheckoutConflictModal() {
  const {
    checkoutConflict,
    stashAndCheckout,
    migrateCheckout,
    forceCheckout,
    cancelCheckout,
  } = useRepoStore();
  const { addToast } = useUiStore();

  if (!checkoutConflict) return null;
  const { branch } = checkoutConflict;

  const run = (action: () => Promise<void>, successMsg: string) => async () => {
    try {
      await action();
      addToast({ variant: 'success', title: 'Done', message: successMsg });
    } catch (err: unknown) {
      addToast({
        variant: 'error',
        title: 'Checkout failed',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  return (
    <Modal
      title="Local changes would be overwritten"
      titleVariant="danger"
      level="high"
      width="w-[75%] max-w-xl"
      subtitle={
        <>
          Switching to <span className="text-blue">{branch}</span> would overwrite your
          uncommitted changes. Choose how to proceed:
        </>
      }
    >
      <div className="flex flex-col gap-3 mt-2">
        <div>
          <p className="text-subtext text-xs mb-1">Set changes aside in a stash, then switch.</p>
          <Button variant="primary" fullWidth onClick={run(stashAndCheckout, `Stashed changes, switched to ${branch}`)}>
            Stash &amp; Checkout
          </Button>
        </div>

        <div>
          <p className="text-subtext text-xs mb-1">Carry your changes over to {branch} (may conflict).</p>
          <Button variant="neutral" fullWidth onClick={run(migrateCheckout, `Brought your changes to ${branch}`)}>
            Migrate Changes
          </Button>
        </div>

        <div>
          <p className="text-subtext text-xs mb-1">Discard your changes and switch anyway.</p>
          <Button variant="danger" fullWidth onClick={run(forceCheckout, `Switched to ${branch}, discarded changes`)}>
            Force Checkout
          </Button>
        </div>

        <Button variant="secondary" fullWidth onClick={cancelCheckout}>
          Cancel
        </Button>
      </div>
    </Modal>
  );
}
