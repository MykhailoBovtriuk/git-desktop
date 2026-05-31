import { Button, Modal } from '../../shared/ui';

interface CheckoutModalProps {
  targetBranch: string;
  changeCount: number;
  onCancel: () => void;
  onForceSwitch: () => void;
}

export function CheckoutModal({ targetBranch, changeCount, onCancel, onForceSwitch }: CheckoutModalProps) {
  return (
    <Modal
      title="Switch Branch?"
      subtitle={
        <>
          You have {changeCount} uncommitted change{changeCount !== 1 ? 's' : ''}.
          Switching to <span className="text-text font-medium">{targetBranch}</span> will leave them behind.
        </>
      }
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button variant="danger" onClick={onForceSwitch}>Force Switch</Button>
        </>
      }
    >
      {null}
    </Modal>
  );
}
