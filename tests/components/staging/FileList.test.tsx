// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { FileList } from '../../../src/components/staging/FileList';
import type { FileStatus } from '../../../src/types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

const files: FileStatus[] = [
  { path: 'src/app.ts', status: 'M', staged: false },
  { path: 'src/deep/other.ts', status: 'M', staged: false },
];

function setup(props: Partial<React.ComponentProps<typeof FileList>> = {}) {
  const onCopyPath = vi.fn();
  const onSelect = vi.fn();
  const onStage = vi.fn();
  render(
    <FileList
      files={files}
      staged={false}
      onStage={onStage}
      onCopyPath={onCopyPath}
      onSelect={onSelect}
      selectedFile={null}
      {...props}
    />,
  );
  return { onCopyPath, onSelect, onStage };
}

const copyButtons = () => screen.getAllByTitle('copyPath');

beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
afterEach(() => vi.useRealTimers());

describe('FileList copy path', () => {
  it('hands the row path to the caller, which knows the repository root', () => {
    const { onCopyPath } = setup();

    fireEvent.click(copyButtons()[1]);
    expect(onCopyPath).toHaveBeenCalledWith('src/deep/other.ts');
  });

  // The whole icon group rests on stopPropagation; copying a path is not a
  // reason to change which file the diff pane is showing.
  it('does not change the selected file', () => {
    const { onSelect } = setup();

    fireEvent.click(copyButtons()[0]);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('offers the action on staged rows too', () => {
    const { onCopyPath } = setup({
      staged: true,
      onStage: undefined,
      onUnstage: vi.fn(),
      files: [{ path: 'src/app.ts', status: 'M', staged: true }],
    });

    fireEvent.click(copyButtons()[0]);
    expect(onCopyPath).toHaveBeenCalledWith('src/app.ts');
  });

  // Copying moves nothing on screen, so the mark is the only sign the click
  // landed at all.
  it('marks the row it copied, and only that row', () => {
    setup();

    fireEvent.click(copyButtons()[0]);
    expect(screen.getByTitle('copied')).toBeTruthy();
    expect(screen.getAllByTitle('copyPath')).toHaveLength(1);
  });

  it('lets the mark fade back to the copy icon', () => {
    setup();

    fireEvent.click(copyButtons()[0]);
    act(() => void vi.advanceTimersByTime(1300));

    expect(screen.queryByTitle('copied')).toBeNull();
    expect(screen.getAllByTitle('copyPath')).toHaveLength(2);
  });

  // The list is used elsewhere without a copy handler; it must not sprout a
  // button that would do nothing.
  it('shows no copy button when no handler is given', () => {
    setup({ onCopyPath: undefined });
    expect(screen.queryByTitle('copyPath')).toBeNull();
  });
});
