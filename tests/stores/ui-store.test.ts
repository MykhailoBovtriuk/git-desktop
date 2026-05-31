import { describe, it, expect, beforeEach } from 'vitest';
import { useUiStore } from '../../src/stores/ui-store';

const INITIAL = {
  activeView: 'changes' as const,
  selectedCommit: null,
  selectedFile: null,
  activeMergeFile: null,
  toasts: [] as never[],
  selectedStash: null,
};

describe('ui-store', () => {
  beforeEach(() => { useUiStore.setState(INITIAL); });

  it('has correct initial state', () => {
    const s = useUiStore.getState();
    expect(s.activeView).toBe('changes');
    expect(s.toasts).toHaveLength(0);
  });

  it('setActiveView changes activeView', () => {
    useUiStore.getState().setActiveView('history');
    expect(useUiStore.getState().activeView).toBe('history');
  });

  it('addToast adds to toasts with generated id', () => {
    useUiStore.getState().addToast({ variant: 'success', title: 'Done', message: 'OK' });
    const { toasts } = useUiStore.getState();
    expect(toasts).toHaveLength(1);
    expect(toasts[0].id).toBeDefined();
    expect(toasts[0].variant).toBe('success');
  });

  it('removeToast removes by id', () => {
    useUiStore.getState().addToast({ variant: 'info', title: 'A', message: 'B' });
    const { id } = useUiStore.getState().toasts[0];
    useUiStore.getState().removeToast(id);
    expect(useUiStore.getState().toasts).toHaveLength(0);
  });

  it('setSelectedCommit sets selectedCommit', () => {
    useUiStore.getState().setSelectedCommit('abc123');
    expect(useUiStore.getState().selectedCommit).toBe('abc123');
  });

  it('setSelectedFile sets selectedFile', () => {
    useUiStore.getState().setSelectedFile('src/foo.ts');
    expect(useUiStore.getState().selectedFile).toBe('src/foo.ts');
  });

  it('setSelectedFile accepts null', () => {
    useUiStore.getState().setSelectedFile('src/foo.ts');
    useUiStore.getState().setSelectedFile(null);
    expect(useUiStore.getState().selectedFile).toBeNull();
  });

  it('setActiveMergeFile sets activeMergeFile', () => {
    useUiStore.getState().setActiveMergeFile('src/conflict.ts');
    expect(useUiStore.getState().activeMergeFile).toBe('src/conflict.ts');
  });

  it('removeToast with unknown id leaves toasts unchanged', () => {
    useUiStore.getState().addToast({ variant: 'info', title: 'A', message: 'B' });
    const before = useUiStore.getState().toasts.length;
    useUiStore.getState().removeToast('non-existent-id');
    expect(useUiStore.getState().toasts).toHaveLength(before);
  });

  it('setSelectedStash sets selectedStash index', () => {
    useUiStore.getState().setSelectedStash(2);
    expect(useUiStore.getState().selectedStash).toBe(2);
  });

  it('setSelectedStash accepts null', () => {
    useUiStore.getState().setSelectedStash(1);
    useUiStore.getState().setSelectedStash(null);
    expect(useUiStore.getState().selectedStash).toBeNull();
  });
});
