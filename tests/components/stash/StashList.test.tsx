// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { StashList } from '../../../src/components/stash/StashList';
import { useUiStore } from '../../../src/stores/ui-store';
import type { StashEntry } from '../../../src/types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: any) => (opts ? `${key}(${JSON.stringify(opts)})` : key),
    i18n: { language: 'en' },
  }),
}));

beforeEach(() => {
  useUiStore.setState({ confirmRequest: null });
});

const STASHES: StashEntry[] = [
  { index: 0, message: 'WIP on main: fix nav', branch: 'main', date: new Date(Date.now() - 60_000).toISOString() },
  { index: 1, message: 'custom stash message', branch: null, date: new Date(Date.now() - 3_600_000).toISOString() },
];

const NOOP = () => {};

describe('StashList', () => {
  it('renders stash messages', () => {
    render(<StashList stashes={STASHES} selectedIndex={null} onSelect={NOOP} onApply={NOOP} onPop={NOOP} onDrop={NOOP} />);
    expect(screen.getByText('WIP on main: fix nav')).toBeInTheDocument();
    expect(screen.getByText('custom stash message')).toBeInTheDocument();
  });

  it('renders branch separator · when branch is not null', () => {
    render(<StashList stashes={[STASHES[0]]} selectedIndex={null} onSelect={NOOP} onApply={NOOP} onPop={NOOP} onDrop={NOOP} />);
    expect(document.body.textContent).toContain('main ·');
  });

  it('does not render "null" text when branch is null', () => {
    render(<StashList stashes={[STASHES[1]]} selectedIndex={null} onSelect={NOOP} onApply={NOOP} onPop={NOOP} onDrop={NOOP} />);
    expect(document.body.textContent).not.toContain('null');
  });

  it('calls onSelect with index when entry clicked', () => {
    const onSelect = vi.fn();
    render(<StashList stashes={STASHES} selectedIndex={null} onSelect={onSelect} onApply={NOOP} onPop={NOOP} onDrop={NOOP} />);
    fireEvent.click(screen.getByText('WIP on main: fix nav'));
    expect(onSelect).toHaveBeenCalledWith(0);
  });

  it('calls onPop when pop button clicked', () => {
    const onPop = vi.fn();
    render(<StashList stashes={STASHES} selectedIndex={null} onSelect={NOOP} onApply={NOOP} onPop={onPop} onDrop={NOOP} />);
    const popBtns = screen.getAllByTitle('actions.pop');
    fireEvent.click(popBtns[0]);
    expect(onPop).toHaveBeenCalledWith(0);
  });

  it('calls onApply when apply button clicked', () => {
    const onApply = vi.fn();
    render(<StashList stashes={STASHES} selectedIndex={null} onSelect={NOOP} onApply={onApply} onPop={NOOP} onDrop={NOOP} />);
    const applyBtns = screen.getAllByTitle('actions.apply');
    fireEvent.click(applyBtns[0]);
    expect(onApply).toHaveBeenCalledWith(0);
  });

  it('calls onDrop when drop button clicked and confirmed', async () => {
    const onDrop = vi.fn();
    render(<StashList stashes={STASHES} selectedIndex={null} onSelect={NOOP} onApply={NOOP} onPop={NOOP} onDrop={onDrop} />);
    fireEvent.click(screen.getAllByTitle('actions.drop')[0]);

    // The click opens the in-app confirm dialog — approve it via the store.
    await waitFor(() => expect(useUiStore.getState().confirmRequest).not.toBeNull());
    useUiStore.getState().resolveConfirm(true);

    await waitFor(() => expect(onDrop).toHaveBeenCalledWith(0));
  });

  it('does NOT call onDrop when drop is cancelled', async () => {
    const onDrop = vi.fn();
    render(<StashList stashes={STASHES} selectedIndex={null} onSelect={NOOP} onApply={NOOP} onPop={NOOP} onDrop={onDrop} />);
    fireEvent.click(screen.getAllByTitle('actions.drop')[0]);

    await waitFor(() => expect(useUiStore.getState().confirmRequest).not.toBeNull());
    useUiStore.getState().resolveConfirm(false);

    await waitFor(() => expect(useUiStore.getState().confirmRequest).toBeNull());
    expect(onDrop).not.toHaveBeenCalled();
  });

  it('renders empty state when no stashes', () => {
    render(<StashList stashes={[]} selectedIndex={null} onSelect={NOOP} onApply={NOOP} onPop={NOOP} onDrop={NOOP} />);
    expect(screen.getByText('noStashes')).toBeInTheDocument();
  });
});
