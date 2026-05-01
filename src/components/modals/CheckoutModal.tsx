interface CheckoutModalProps {
  targetBranch: string;
  changeCount: number;
  onCancel: () => void;
  onForceSwitch: () => void;
}

export function CheckoutModal({ targetBranch, changeCount, onCancel, onForceSwitch }: CheckoutModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface0 rounded-xl p-6 w-96 shadow-xl">
        <h2 className="text-text text-lg font-semibold mb-2">Switch Branch?</h2>
        <p className="text-subtext text-sm mb-6">
          You have {changeCount} uncommitted change{changeCount !== 1 ? 's' : ''}.
          Switching to <span className="text-text font-medium">{targetBranch}</span> will leave them behind.
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-sm text-subtext hover:text-text transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onForceSwitch}
            className="px-3 py-1.5 text-sm bg-red/20 text-red rounded hover:bg-red/30 transition-colors"
          >
            Force Switch
          </button>
        </div>
      </div>
    </div>
  );
}
