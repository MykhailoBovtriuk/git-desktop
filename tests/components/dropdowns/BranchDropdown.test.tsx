// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));
vi.mock('../../../src/stores/repo-store', () => ({
  useRepoStore: vi.fn(),
  CheckoutConflictError: class CheckoutConflictError extends Error {},
}));
vi.mock('../../../src/stores/ui-store', () => ({ useUiStore: vi.fn() }));

import { BranchDropdown } from '../../../src/components/dropdowns/BranchDropdown';
import { useRepoStore } from '../../../src/stores/repo-store';
import { useUiStore } from '../../../src/stores/ui-store';

const repoState: any = {
  branches: [{ name: 'main', current: true, remote: false }],
  checkout: vi.fn(),
  merge: vi.fn(),
  rebase: vi.fn(),
  deleteBranch: vi.fn(),
  deleteRemoteBranch: vi.fn(),
  mergeState: null,
  merging: false,
};
const uiState: any = { addToast: vi.fn(), requestConfirm: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
  repoState.mergeState = null;
  repoState.merging = false;
  vi.mocked(useRepoStore).mockImplementation(((sel: any) => sel(repoState)) as any);
  vi.mocked(useUiStore).mockImplementation(((sel: any) => sel(uiState)) as any);
});

// The dropdown panel is the element carrying the branch actions; when a merge
// is in progress it must be inert so the user can't checkout mid-merge.
const panel = (container: HTMLElement) => container.querySelector('.p-2') as HTMLElement;

describe('BranchDropdown merge lock', () => {
  it('is interactive when idle', () => {
    const { container } = render(<BranchDropdown onClose={() => {}} />);
    expect(panel(container).className).not.toContain('pointer-events-none');
  });

  // Regression: after a restart mid-merge git has MERGE_HEAD (merging=true) but
  // the renderer-only mergeState is null — the dropdown must still be locked.
  it('is locked when merging even without a mergeState', () => {
    repoState.merging = true;
    repoState.mergeState = null;
    const { container } = render(<BranchDropdown onClose={() => {}} />);
    expect(panel(container).className).toContain('pointer-events-none');
  });

  it('is locked when a mergeState is present', () => {
    repoState.mergeState = { sourceBranch: 'f', targetBranch: 'main', conflictingFiles: ['a'] };
    const { container } = render(<BranchDropdown onClose={() => {}} />);
    expect(panel(container).className).toContain('pointer-events-none');
  });
});
