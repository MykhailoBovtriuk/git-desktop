// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StashList } from '../../../src/components/stash/StashList';
import type { StashEntry } from '../../../src/types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, opts?: any) => opts ? `${key}(${JSON.stringify(opts)})` : key }),
}));

const STASHES: StashEntry[] = [
  { index: 0, message: 'WIP on main: fix nav', branch: 'main', date: new Date(Date.now() - 60_000).toISOString() },
  { index: 1, message: 'custom stash message', branch: null, date: new Date(Date.now() - 3_600_000).toISOString() },
];

const NOOP = () => {};

describe('StashList', () => {
  it('renders stash messages', () => {
<<<<<<< Updated upstream
    render(<StashList stashes={STASHES} selectedIndex={null} onSelect={NOOP} onApply={NOOP} onPop={NOOP} onDrop={NOOP} />);
=======
    render(<StashList stashes={STASHES} selectedIndex={null} canSave onSelect={NOOP} onApply={NOOP} onPop={NOOP} onDrop={NOOP} onSave={NOOP} />);
>>>>>>> Stashed changes
    expect(screen.getByText('WIP on main: fix nav')).toBeInTheDocument();
    expect(screen.getByText('custom stash message')).toBeInTheDocument();
  });

  it('renders branch separator · when branch is not null', () => {
<<<<<<< Updated upstream
    render(<StashList stashes={[STASHES[0]]} selectedIndex={null} onSelect={NOOP} onApply={NOOP} onPop={NOOP} onDrop={NOOP} />);
=======
    render(<StashList stashes={[STASHES[0]]} selectedIndex={null} canSave onSelect={NOOP} onApply={NOOP} onPop={NOOP} onDrop={NOOP} onSave={NOOP} />);
>>>>>>> Stashed changes
    expect(document.body.textContent).toContain('main ·');
  });

  it('does not render "null" text when branch is null', () => {
<<<<<<< Updated upstream
    render(<StashList stashes={[STASHES[1]]} selectedIndex={null} onSelect={NOOP} onApply={NOOP} onPop={NOOP} onDrop={NOOP} />);
=======
    render(<StashList stashes={[STASHES[1]]} selectedIndex={null} canSave onSelect={NOOP} onApply={NOOP} onPop={NOOP} onDrop={NOOP} onSave={NOOP} />);
>>>>>>> Stashed changes
    expect(document.body.textContent).not.toContain('null');
  });

  it('calls onSelect with index when entry clicked', () => {
    const onSelect = vi.fn();
<<<<<<< Updated upstream
    render(<StashList stashes={STASHES} selectedIndex={null} onSelect={onSelect} onApply={NOOP} onPop={NOOP} onDrop={NOOP} />);
=======
    render(<StashList stashes={STASHES} selectedIndex={null} canSave onSelect={onSelect} onApply={NOOP} onPop={NOOP} onDrop={NOOP} onSave={NOOP} />);
>>>>>>> Stashed changes
    fireEvent.click(screen.getByText('WIP on main: fix nav'));
    expect(onSelect).toHaveBeenCalledWith(0);
  });

  it('calls onPop when pop button clicked', () => {
    const onPop = vi.fn();
<<<<<<< Updated upstream
    render(<StashList stashes={STASHES} selectedIndex={null} onSelect={NOOP} onApply={NOOP} onPop={onPop} onDrop={NOOP} />);
=======
    render(<StashList stashes={STASHES} selectedIndex={null} canSave onSelect={NOOP} onApply={NOOP} onPop={onPop} onDrop={NOOP} onSave={NOOP} />);
>>>>>>> Stashed changes
    const popBtns = screen.getAllByTitle('actions.pop');
    fireEvent.click(popBtns[0]);
    expect(onPop).toHaveBeenCalledWith(0);
  });

  it('calls onApply when apply button clicked', () => {
    const onApply = vi.fn();
<<<<<<< Updated upstream
    render(<StashList stashes={STASHES} selectedIndex={null} onSelect={NOOP} onApply={onApply} onPop={NOOP} onDrop={NOOP} />);
=======
    render(<StashList stashes={STASHES} selectedIndex={null} canSave onSelect={NOOP} onApply={onApply} onPop={NOOP} onDrop={NOOP} onSave={NOOP} />);
>>>>>>> Stashed changes
    const applyBtns = screen.getAllByTitle('actions.apply');
    fireEvent.click(applyBtns[0]);
    expect(onApply).toHaveBeenCalledWith(0);
  });

  it('calls onDrop when drop button clicked and confirmed', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const onDrop = vi.fn();
<<<<<<< Updated upstream
    render(<StashList stashes={STASHES} selectedIndex={null} onSelect={NOOP} onApply={NOOP} onPop={NOOP} onDrop={onDrop} />);
=======
    render(<StashList stashes={STASHES} selectedIndex={null} canSave onSelect={NOOP} onApply={NOOP} onPop={NOOP} onDrop={onDrop} onSave={NOOP} />);
>>>>>>> Stashed changes
    const dropBtns = screen.getAllByTitle('actions.drop');
    fireEvent.click(dropBtns[0]);
    expect(onDrop).toHaveBeenCalledWith(0);
  });

  it('does NOT call onDrop when drop is cancelled', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const onDrop = vi.fn();
<<<<<<< Updated upstream
    render(<StashList stashes={STASHES} selectedIndex={null} onSelect={NOOP} onApply={NOOP} onPop={NOOP} onDrop={onDrop} />);
=======
    render(<StashList stashes={STASHES} selectedIndex={null} canSave onSelect={NOOP} onApply={NOOP} onPop={NOOP} onDrop={onDrop} onSave={NOOP} />);
>>>>>>> Stashed changes
    const dropBtns = screen.getAllByTitle('actions.drop');
    fireEvent.click(dropBtns[0]);
    expect(onDrop).not.toHaveBeenCalled();
  });

  it('renders empty state when no stashes', () => {
<<<<<<< Updated upstream
    render(<StashList stashes={[]} selectedIndex={null} onSelect={NOOP} onApply={NOOP} onPop={NOOP} onDrop={NOOP} />);
    expect(screen.getByText('noStashes')).toBeInTheDocument();
  });
=======
    render(<StashList stashes={[]} selectedIndex={null} canSave onSelect={NOOP} onApply={NOOP} onPop={NOOP} onDrop={NOOP} onSave={NOOP} />);
    expect(screen.getByText('noStashes')).toBeInTheDocument();
  });

  it('Stash Changes button disabled when canSave=false', () => {
    render(<StashList stashes={[]} selectedIndex={null} canSave={false} onSelect={NOOP} onApply={NOOP} onPop={NOOP} onDrop={NOOP} onSave={NOOP} />);
    expect(screen.getByRole('button', { name: /stashChanges/i })).toBeDisabled();
  });
>>>>>>> Stashed changes
});
