// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { Toast } from '../../../src/components/common/Toast';
import { useUiStore } from '../../../src/stores/ui-store';

vi.mock('../../../src/stores/ui-store', () => ({ useUiStore: vi.fn() }));

type MockState = {
  toasts: Array<{ id: string; variant: 'success' | 'error' | 'info'; title: string; message: string }>;
  removeToast: ReturnType<typeof vi.fn>;
};

function setupMocks(state: Partial<MockState> = {}) {
  const mockRemoveToast = state.removeToast ?? vi.fn();
  const mockState: MockState = {
    toasts: state.toasts ?? [],
    removeToast: mockRemoveToast,
  };
  vi.mocked(useUiStore).mockImplementation((selector: any) => selector(mockState));
  return { mockRemoveToast, mockState };
}

describe('Toast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when toasts array is empty', () => {
    setupMocks({ toasts: [] });
    const { container } = render(<Toast />);
    expect(container.firstChild).toBeNull();
  });

  it('renders toast title and message when toasts exist', () => {
    setupMocks({
      toasts: [{ id: '1', variant: 'success', title: 'Done', message: 'All good' }],
    });
    render(<Toast />);
    expect(screen.getByText('Done')).toBeInTheDocument();
    expect(screen.getByText('All good')).toBeInTheDocument();
  });

  it('x button calls removeToast with correct id', () => {
    const { mockRemoveToast } = setupMocks({
      toasts: [{ id: 'abc-123', variant: 'info', title: 'Info', message: 'Details here' }],
    });
    render(<Toast />);
    const dismissButton = screen.getByRole('button', { name: '×' });
    fireEvent.click(dismissButton);
    expect(mockRemoveToast).toHaveBeenCalledWith('abc-123');
  });

  it('auto-dismisses after 5000ms', () => {
    vi.useFakeTimers();
    const { mockRemoveToast } = setupMocks({
      toasts: [{ id: 'toast-99', variant: 'success', title: 'Auto', message: 'Gone soon' }],
    });
    render(<Toast />);
    expect(mockRemoveToast).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(5000); });
    expect(mockRemoveToast).toHaveBeenCalledWith('toast-99');
    vi.useRealTimers();
  });

  it('renders multiple toasts', () => {
    setupMocks({
      toasts: [
        { id: '1', variant: 'success', title: 'First', message: 'Msg 1' },
        { id: '2', variant: 'error', title: 'Second', message: 'Msg 2' },
        { id: '3', variant: 'info', title: 'Third', message: 'Msg 3' },
      ],
    });
    render(<Toast />);
    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.getByText('Second')).toBeInTheDocument();
    expect(screen.getByText('Third')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: '×' })).toHaveLength(3);
  });
});
