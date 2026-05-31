// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));
vi.mock('../../../src/stores/repo-store', () => ({
  useRepoStore: vi.fn(),
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
    vi.mocked(useRepoStore).mockReturnValue({
      ...baseRepo,
      status: {
        unstaged: [{ path: 'a.ts', status: 'M', staged: false }],
        staged: [{ path: 'b.ts', status: 'A', staged: true }],
      },
    } as any);
    vi.mocked(useUiStore).mockReturnValue(baseUi as any);
    render(<StashSection />);
    expect(screen.getByTestId('unstaged-list')).toBeInTheDocument();
    expect(screen.getByTestId('staged-list')).toBeInTheDocument();
  });

  it('hides file lists in list mode', () => {
    vi.mocked(useRepoStore).mockReturnValue({
      ...baseRepo,
      status: {
        unstaged: [{ path: 'a.ts', status: 'M', staged: false }],
        staged: [],
      },
    } as any);
    vi.mocked(useUiStore).mockReturnValue({ ...baseUi, activeView: 'stash' } as any);
    render(<StashSection />);
    expect(screen.queryByTestId('unstaged-list')).not.toBeInTheDocument();
  });

  it('passes listMode=false to StashForm when activeView=stash-create', () => {
    vi.mocked(useRepoStore).mockReturnValue(baseRepo as any);
    vi.mocked(useUiStore).mockReturnValue(baseUi as any);
    render(<StashSection />);
    expect(screen.getByTestId('list-mode').textContent).toBe('false');
  });

  it('passes listMode=true to StashForm when activeView=stash', () => {
    vi.mocked(useRepoStore).mockReturnValue(baseRepo as any);
    vi.mocked(useUiStore).mockReturnValue({ ...baseUi, activeView: 'stash' } as any);
    render(<StashSection />);
    expect(screen.getByTestId('list-mode').textContent).toBe('true');
  });

  it('toggle from create mode calls setActiveView(stash) and setSelectedStash(null)', () => {
    const setActiveView = vi.fn();
    const setSelectedStash = vi.fn();
    vi.mocked(useRepoStore).mockReturnValue(baseRepo as any);
    vi.mocked(useUiStore).mockReturnValue({ ...baseUi, activeView: 'stash-create', setActiveView, setSelectedStash } as any);
    render(<StashSection />);
    fireEvent.click(screen.getByRole('button', { name: 'toggle' }));
    expect(setActiveView).toHaveBeenCalledWith('stash');
    expect(setSelectedStash).toHaveBeenCalledWith(null);
  });

  it('toggle from list mode calls setActiveView(stash-create)', () => {
    const setActiveView = vi.fn();
    vi.mocked(useRepoStore).mockReturnValue(baseRepo as any);
    vi.mocked(useUiStore).mockReturnValue({ ...baseUi, activeView: 'stash', setActiveView } as any);
    render(<StashSection />);
    fireEvent.click(screen.getByRole('button', { name: 'toggle' }));
    expect(setActiveView).toHaveBeenCalledWith('stash-create');
  });

  it('calls stashSave and addToast on successful stash', async () => {
    const addToast = vi.fn();
    vi.mocked(useRepoStore).mockReturnValue({
      ...baseRepo,
      status: { staged: [{ path: 'a.ts', status: 'A', staged: true }], unstaged: [] },
    } as any);
    vi.mocked(useUiStore).mockReturnValue({ ...baseUi, addToast } as any);
    render(<StashSection />);
    fireEvent.click(screen.getByRole('button', { name: 'stash' }));
    await waitFor(() => expect(addToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'success' })));
  });

  it('calls addToast with error on stashSave failure', async () => {
    const addToast = vi.fn();
    vi.mocked(useRepoStore).mockReturnValue({
      ...baseRepo,
      stashSave: vi.fn().mockRejectedValue(new Error('git error')),
      status: { staged: [{ path: 'a.ts', status: 'A', staged: true }], unstaged: [] },
    } as any);
    vi.mocked(useUiStore).mockReturnValue({ ...baseUi, addToast } as any);
    render(<StashSection />);
    fireEvent.click(screen.getByRole('button', { name: 'stash' }));
    await waitFor(() => expect(addToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'error' })));
  });
});
