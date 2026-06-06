// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react';
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
vi.mock('../../../src/components/staging/ChangesSection', () => ({
  ChangesSection: () => <div data-testid="changes-section" />,
}));
<<<<<<< Updated upstream
vi.mock('../../../src/components/stash/StashSection', () => ({
  StashSection: () => <div data-testid="stash-section" />,
}));
=======
>>>>>>> Stashed changes

import { Sidebar } from '../../../src/components/layout/Sidebar';
import { useRepoStore } from '../../../src/stores/repo-store';
import { useUiStore } from '../../../src/stores/ui-store';

<<<<<<< Updated upstream
const baseRepo = { status: { staged: [], unstaged: [] }, stashes: [] };

describe('Sidebar', () => {
  it('renders stash title', () => {
    vi.mocked(useRepoStore).mockReturnValue(baseRepo as any);
    vi.mocked(useUiStore).mockReturnValue({ activeView: 'diff', setActiveView: vi.fn() } as any);
    render(<Sidebar />);
    expect(screen.getByText('stash:title')).toBeInTheDocument();
=======
const baseRepo = {
  status: { staged: [], unstaged: [] },
  stashes: [],
};

describe('Sidebar', () => {
  it('renders STASH title and List toggle button', () => {
    vi.mocked(useRepoStore).mockReturnValue(baseRepo as any);
    vi.mocked(useUiStore).mockReturnValue({ activeView: 'diff', setActiveView: vi.fn(), setSelectedStash: vi.fn() } as any);
    render(<Sidebar />);
    expect(screen.getByText('stash:title')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'stash:list' })).toBeInTheDocument();
>>>>>>> Stashed changes
  });

  it('shows stash count badge when stashes.length > 0', () => {
    vi.mocked(useRepoStore).mockReturnValue({ ...baseRepo, stashes: [{ index: 0 }, { index: 1 }] } as any);
<<<<<<< Updated upstream
    vi.mocked(useUiStore).mockReturnValue({ activeView: 'diff', setActiveView: vi.fn() } as any);
=======
    vi.mocked(useUiStore).mockReturnValue({ activeView: 'diff', setActiveView: vi.fn(), setSelectedStash: vi.fn() } as any);
>>>>>>> Stashed changes
    render(<Sidebar />);
    expect(screen.getByText('2')).toBeInTheDocument();
  });

<<<<<<< Updated upstream
  it('stash accordion is open when activeView is stash-create', () => {
    vi.mocked(useRepoStore).mockReturnValue(baseRepo as any);
    vi.mocked(useUiStore).mockReturnValue({ activeView: 'stash-create', setActiveView: vi.fn() } as any);
    render(<Sidebar />);
    expect(screen.getByTestId('stash-section')).toBeInTheDocument();
  });

  it('stash accordion is open when activeView is stash', () => {
    vi.mocked(useRepoStore).mockReturnValue(baseRepo as any);
    vi.mocked(useUiStore).mockReturnValue({ activeView: 'stash', setActiveView: vi.fn() } as any);
    render(<Sidebar />);
    expect(screen.getByTestId('stash-section')).toBeInTheDocument();
  });

  it('stash accordion is closed when activeView is diff', () => {
    vi.mocked(useRepoStore).mockReturnValue(baseRepo as any);
    vi.mocked(useUiStore).mockReturnValue({ activeView: 'diff', setActiveView: vi.fn() } as any);
    render(<Sidebar />);
    expect(screen.queryByTestId('stash-section')).not.toBeInTheDocument();
  });

  it('shows list toggle action in stash header when activeView is stash', () => {
    vi.mocked(useRepoStore).mockReturnValue(baseRepo as any);
    vi.mocked(useUiStore).mockReturnValue({ activeView: 'stash', setActiveView: vi.fn() } as any);
    render(<Sidebar />);
    expect(screen.getByRole('button', { name: 'stash:list' })).toBeInTheDocument();
  });

  it('does not show list toggle action when activeView is stash-create', () => {
    vi.mocked(useRepoStore).mockReturnValue(baseRepo as any);
    vi.mocked(useUiStore).mockReturnValue({ activeView: 'stash-create', setActiveView: vi.fn() } as any);
    render(<Sidebar />);
    expect(screen.queryByRole('button', { name: 'stash:list' })).not.toBeInTheDocument();
  });

  it('clicking stash accordion header calls setActiveView(stash-create) when closed', () => {
    const setActiveView = vi.fn();
    vi.mocked(useRepoStore).mockReturnValue(baseRepo as any);
    vi.mocked(useUiStore).mockReturnValue({ activeView: 'diff', setActiveView } as any);
    render(<Sidebar />);
    fireEvent.click(screen.getByText('stash:title').closest('button')!);
    expect(setActiveView).toHaveBeenCalledWith('stash-create');
  });

  it('clicking stash accordion header calls setActiveView(diff) when open', () => {
    const setActiveView = vi.fn();
    vi.mocked(useRepoStore).mockReturnValue(baseRepo as any);
    vi.mocked(useUiStore).mockReturnValue({ activeView: 'stash-create', setActiveView } as any);
    render(<Sidebar />);
    fireEvent.click(screen.getByText('stash:title').closest('button')!);
=======
  it('clicking List toggle calls setActiveView("stash") when not active', () => {
    const setActiveView = vi.fn();
    const setSelectedStash = vi.fn();
    vi.mocked(useRepoStore).mockReturnValue(baseRepo as any);
    vi.mocked(useUiStore).mockReturnValue({ activeView: 'diff', setActiveView, setSelectedStash } as any);
    render(<Sidebar />);
    fireEvent.click(screen.getByRole('button', { name: 'stash:list' }));
    expect(setActiveView).toHaveBeenCalledWith('stash');
  });

  it('clicking List toggle calls setActiveView("diff") when stash is active', () => {
    const setActiveView = vi.fn();
    vi.mocked(useRepoStore).mockReturnValue(baseRepo as any);
    vi.mocked(useUiStore).mockReturnValue({ activeView: 'stash', setActiveView, setSelectedStash: vi.fn() } as any);
    render(<Sidebar />);
    fireEvent.click(screen.getByRole('button', { name: 'stash:list' }));
>>>>>>> Stashed changes
    expect(setActiveView).toHaveBeenCalledWith('diff');
  });
});
