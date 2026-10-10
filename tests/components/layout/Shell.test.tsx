// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Only the layout is under test; every screen and dialog is a stub.
vi.mock('../../../src/components/layout/Titlebar', () => ({ Titlebar: () => null }));
vi.mock('../../../src/components/layout/BareTitlebar', () => ({ BareTitlebar: () => null }));
vi.mock('../../../src/components/layout/Footer', () => ({ Footer: () => null }));
vi.mock('../../../src/components/welcome/WelcomeScreen', () => ({ WelcomeScreen: () => null }));
vi.mock('../../../src/components/common/Toast', () => ({ Toast: () => null }));
vi.mock('../../../src/components/diff/DiffViewer', () => ({ DiffViewer: () => null }));
vi.mock('../../../src/components/graph/CommitGraph', () => ({ CommitGraph: () => null }));
vi.mock('../../../src/components/history/HistoryView', () => ({ HistoryView: () => null }));
vi.mock('../../../src/components/merge/MergeEditor', () => ({ MergeEditor: () => null }));
vi.mock('../../../src/components/merge/MergeConflictModal', () => ({
  MergeConflictModal: () => null,
}));
vi.mock('../../../src/components/rebase/RebaseBanner', () => ({ RebaseBanner: () => null }));
vi.mock('../../../src/components/checkout/CheckoutConflictModal', () => ({
  CheckoutConflictModal: () => null,
}));
vi.mock('../../../src/components/branches/NewBranchModal', () => ({ NewBranchModal: () => null }));
vi.mock('../../../src/components/common/ConfirmDialog', () => ({ ConfirmDialog: () => null }));
vi.mock('../../../src/components/stash/StashView', () => ({ StashView: () => null }));
vi.mock('../../../src/components/settings/SettingsView', () => ({ SettingsView: () => null }));
vi.mock('../../../src/components/about/AboutView', () => ({ AboutView: () => null }));
vi.mock('../../../src/components/account/SignInModal', () => ({ SignInModal: () => null }));
vi.mock('../../../src/components/account/ConnectionModal', () => ({ ConnectionModal: () => null }));
vi.mock('../../../src/components/update/UpdateModal', () => ({ UpdateModal: () => null }));
vi.mock('../../../src/components/panel/RightPanel', () => ({ RightPanel: () => null }));
vi.mock('../../../src/components/layout/Sidebar', () => ({
  Sidebar: () => <textarea aria-label="commit message" defaultValue="" />,
}));

const { Shell } = await import('../../../src/components/layout/Shell');
const { useUiStore } = await import('../../../src/stores/ui-store');
const { useRepoStore } = await import('../../../src/stores/repo-store');

beforeEach(() => {
  useRepoStore.setState({ repoPath: '/repo' });
  useUiStore.setState({ activeView: 'changes', sidebarOpen: true });
});

describe('Shell', () => {
  it('hides the sidebar without unmounting it, so an unsent commit message survives', () => {
    const { rerender } = render(<Shell />);
    const box = screen.getByLabelText('commit message') as HTMLTextAreaElement;
    box.value = 'half a message';
    expect(box.parentElement).toHaveClass('contents');

    useUiStore.setState({ sidebarOpen: false });
    rerender(<Shell />);
    const hidden = screen.getByLabelText('commit message', {
      selector: 'textarea',
    }) as HTMLTextAreaElement;
    expect(hidden).toBe(box);
    expect(hidden.parentElement).toHaveClass('hidden');

    useUiStore.setState({ sidebarOpen: true });
    rerender(<Shell />);
    expect((screen.getByLabelText('commit message') as HTMLTextAreaElement).value).toBe(
      'half a message',
    );
  });
});
