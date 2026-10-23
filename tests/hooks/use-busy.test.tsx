// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useBusy } from '../../src/hooks/use-busy';

describe('useBusy', () => {
  it('is busy while the task runs and returns its result', async () => {
    const { result } = renderHook(() => useBusy());
    let finish!: (v: number) => void;
    let pending!: Promise<number | undefined>;

    act(() => {
      pending = result.current[1](() => new Promise<number>(r => (finish = r)));
    });
    expect(result.current[0]).toBe(true);

    await act(async () => finish(7));
    await expect(pending).resolves.toBe(7);
    expect(result.current[0]).toBe(false);
  });

  it('ignores a second call while the first is in flight', async () => {
    const { result } = renderHook(() => useBusy());
    let calls = 0;
    let finish!: () => void;
    const task = () => {
      calls++;
      return new Promise<void>(r => (finish = r));
    };

    await act(async () => {
      void result.current[1](task);
      await expect(result.current[1](task)).resolves.toBeUndefined();
      finish();
    });
    expect(calls).toBe(1);
  });

  it('clears busy when the task fails', async () => {
    const { result } = renderHook(() => useBusy());
    await act(async () => {
      await expect(result.current[1](() => Promise.reject(new Error('x')))).rejects.toThrow('x');
    });
    expect(result.current[0]).toBe(false);
  });
});
