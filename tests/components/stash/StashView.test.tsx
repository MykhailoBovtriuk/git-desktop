// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('../../../src/stores/repo-store', () => ({
  useRepoStore: vi.fn(),
}));
vi.mock('../../../src/stores/ui-store', () => ({
  useUiStore: vi.fn(),
}));
vi.mock('../../../src/api/git-api', () => ({
  gitApi: { getStashDiff: vi.fn().mockResolvedValue('') },
}));
vi.mock('../../../src/components/stash/StashList', () => ({
  StashList: () => <div data-testid="stash-list" />,
}));
vi.mock('../../../src/components/stash/RawDiff', () => ({
  RawDiff: ({ raw }: { raw: string }) => <div data-testid="raw-diff">{raw}</div>,
}));

import { StashView } from '../../../src/components/stash/StashView';
import { useRepoStore } from '../../../src/stores/repo-store';
import { useUiStore } from '../../../src/stores/ui-store';

const baseRepo = {
  stashes: [],
  stashApply: vi.fn().mockResolvedValue(undefined),
  stashPop: vi.fn().mockResolvedValue(undefined),
  stashDrop: vi.fn().mockResolvedValue(undefined),
};
const baseUi = {
  selectedStash: null,
  setSelectedStash: vi.fn(),
  addToast: vi.fn(),
};

describe('StashView', () => {
  it('renders StashList panel', () => {
    vi.mocked(useRepoStore).mockReturnValue(baseRepo as any);
    vi.mocked(useUiStore).mockReturnValue(baseUi as any);
    render(<StashView />);
    expect(screen.getByTestId('stash-list')).toBeInTheDocument();
  });

  it('shows noStashesYet hint when list is empty and nothing selected', () => {
    vi.mocked(useRepoStore).mockReturnValue(baseRepo as any);
    vi.mocked(useUiStore).mockReturnValue(baseUi as any);
    render(<StashView />);
    expect(screen.getByText('noStashesYet')).toBeInTheDocument();
  });

  it('shows selectStashHint when stashes exist but none selected', () => {
    vi.mocked(useRepoStore).mockReturnValue({
      ...baseRepo,
      stashes: [{ index: 0, message: 'x', branch: 'main', date: new Date().toISOString() }],
    } as any);
    vi.mocked(useUiStore).mockReturnValue(baseUi as any);
    render(<StashView />);
    expect(screen.getByText('selectStashHint')).toBeInTheDocument();
  });
});
