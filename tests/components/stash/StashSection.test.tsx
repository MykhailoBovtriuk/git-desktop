// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  // error.unknown is empty in the real footer namespace — unclassified errors
  // must fall back to the raw git message.
  useTranslation: () => ({ t: (k: string) => (k === 'error.unknown' ? '' : k) }),
}));
vi.mock('../../../src/stores/repo-store', () => ({
  useRepoStore: vi.fn(),
  CheckoutConflictError: class CheckoutConflictError extends Error {},
}));
vi.mock('../../../src/stores/ui-store', () => ({
  useUiStore: vi.fn(),
}));
vi.mock('../../../src/components/staging/FileList', () => ({
  FileList: ({ files, staged }: { files: any[]; staged: boolean }) => (
    <div data-testid={staged ? 'staged-list' : 'unstaged-list'}>
      {files.map(f => <div key={f.path}>{f.path}</div>)}
    </div>
  ),
}));
vi.mock('../../../src/components/stash/StashForm', () => ({
  StashForm: ({ listMode, onToggle, onStash, canStash }: any) => (
    <div data-testid="stash-form">
      <span data-testid="list-mode">{String(listMode)}</span>
      <button onClick={onToggle}>toggle</button>
      <button onClick={() => onStash('test msg')} disabled={!canStash}>stash</button>
    </div>
  ),
}));

import { StashSection } from '../../../src/components/stash/StashSection';
import { useRepoStore } from '../../../src/stores/repo-store';
import { useUiStore } from '../../../src/stores/ui-store';

// Selector-aware store mock: StashSection and useGitAction select slices, so
// the mock must apply the selector instead of returning the whole state.
const mockState = (store: unknown) => (state: unknown) =>
  vi.mocked(store as any).mockImplementation(((sel: any) => sel(state)) as any);

const baseRepo = {
  status: { staged: [], unstaged: [] },
  stageFiles: vi.fn().mockResolvedValue(undefined),
  unstageFiles: vi.fn().mockResolvedValue(undefined),
  discardChanges: vi.fn().mockResolvedValue(undefined),
  stashSave: vi.fn().mockResolvedValue(undefined),
};
const baseUi = {
  activeView: 'stash-create',
  setActiveView: vi.fn(),
  setSelectedStash: vi.fn(),
  selectedFile: null,
  setSelectedFile: vi.fn(),
  addToast: vi.fn(),
};

describe('StashSection', () => {
  it('shows unstaged and staged file lists in create mode', () => {
    mockState(useRepoStore)({
      ...baseRepo,
      status: {
        unstaged: [{ path: 'a.ts', status: 'M', staged: false }],
        staged: [{ path: 'b.ts', status: 'A', staged: true }],
      },
    } as any);
    mockState(useUiStore)(baseUi as any);
    render(<StashSection />);
    expect(screen.getByTestId('unstaged-list')).toBeInTheDocument();
    expect(screen.getByTestId('staged-list')).toBeInTheDocument();
  });

  it('hides file lists in list mode', () => {
    mockState(useRepoStore)({
      ...baseRepo,
      status: {
        unstaged: [{ path: 'a.ts', status: 'M', staged: false }],
        staged: [],
      },
    } as any);
    mockState(useUiStore)({ ...baseUi, activeView: 'stash' } as any);
    render(<StashSection />);
    expect(screen.queryByTestId('unstaged-list')).not.toBeInTheDocument();
  });

  it('passes listMode=false to StashForm when activeView=stash-create', () => {
    mockState(useRepoStore)(baseRepo as any);
    mockState(useUiStore)(baseUi as any);
    render(<StashSection />);
    expect(screen.getByTestId('list-mode').textContent).toBe('false');
  });

  it('passes listMode=true to StashForm when activeView=stash', () => {
    mockState(useRepoStore)(baseRepo as any);
    mockState(useUiStore)({ ...baseUi, activeView: 'stash' } as any);
    render(<StashSection />);
    expect(screen.getByTestId('list-mode').textContent).toBe('true');
  });

  it('toggle from create mode calls setActiveView(stash) and setSelectedStash(null)', () => {
    const setActiveView = vi.fn();
    const setSelectedStash = vi.fn();
    mockState(useRepoStore)(baseRepo as any);
    mockState(useUiStore)({ ...baseUi, activeView: 'stash-create', setActiveView, setSelectedStash } as any);
    render(<StashSection />);
    fireEvent.click(screen.getByRole('button', { name: 'toggle' }));
    expect(setActiveView).toHaveBeenCalledWith('stash');
    expect(setSelectedStash).toHaveBeenCalledWith(null);
  });

  it('toggle from list mode calls setActiveView(stash-create)', () => {
    const setActiveView = vi.fn();
    mockState(useRepoStore)(baseRepo as any);
    mockState(useUiStore)({ ...baseUi, activeView: 'stash', setActiveView } as any);
    render(<StashSection />);
    fireEvent.click(screen.getByRole('button', { name: 'toggle' }));
    expect(setActiveView).toHaveBeenCalledWith('stash-create');
  });

  it('calls stashSave and addToast on successful stash', async () => {
    const addToast = vi.fn();
    mockState(useRepoStore)({
      ...baseRepo,
      status: { staged: [{ path: 'a.ts', status: 'A', staged: true }], unstaged: [] },
    } as any);
    mockState(useUiStore)({ ...baseUi, addToast } as any);
    render(<StashSection />);
    fireEvent.click(screen.getByRole('button', { name: 'stash' }));
    await waitFor(() => expect(addToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'success' })));
  });

  it('calls addToast with error on stashSave failure', async () => {
    const addToast = vi.fn();
    mockState(useRepoStore)({
      ...baseRepo,
      stashSave: vi.fn().mockRejectedValue(new Error('git error')),
      status: { staged: [{ path: 'a.ts', status: 'A', staged: true }], unstaged: [] },
    } as any);
    mockState(useUiStore)({ ...baseUi, addToast } as any);
    render(<StashSection />);
    fireEvent.click(screen.getByRole('button', { name: 'stash' }));
    await waitFor(() => expect(addToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'error' })));
  });
});
