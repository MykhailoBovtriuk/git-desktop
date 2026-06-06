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

import { Sidebar } from '../../../src/components/layout/Sidebar';
import { useRepoStore } from '../../../src/stores/repo-store';
import { useUiStore } from '../../../src/stores/ui-store';

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
  });

  it('shows stash count badge when stashes.length > 0', () => {
    vi.mocked(useRepoStore).mockReturnValue({ ...baseRepo, stashes: [{ index: 0 }, { index: 1 }] } as any);
    vi.mocked(useUiStore).mockReturnValue({ activeView: 'diff', setActiveView: vi.fn(), setSelectedStash: vi.fn() } as any);
    render(<Sidebar />);
    expect(screen.getByText('2')).toBeInTheDocument();
  });

    fireEvent.click(screen.getByText('stash:title').closest('button')!);
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
    expect(setActiveView).toHaveBeenCalledWith('diff');
  });
});
