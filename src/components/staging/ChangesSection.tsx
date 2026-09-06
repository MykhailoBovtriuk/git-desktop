import { WorkingTreeFiles } from './WorkingTreeFiles';
import { CommitForm } from './CommitForm';

export function ChangesSection() {
  return (
    <div className="flex flex-col h-full">
      <WorkingTreeFiles />
      <CommitForm />
    </div>
  );
}
