import { describe, it, expect, beforeEach } from 'vitest';
import { useUiStore } from '../../src/stores/ui-store';

const INITIAL: Parameters<typeof useUiStore.setState>[0] = {
  activeView: 'changes',
  selectedCommit: null,
  selectedFile: null,
  sidebarSections: { changes: true, history: false },
  activeMergeFile: null,
  toasts: [],
};

describe('ui-store', () => {
  beforeEach(() => { useUiStore.setState(INITIAL); });

  it('has correct initial state', () => {
    const s = useUiStore.getState();
    expect(s.activeView).toBe('changes');
    expect(s.sidebarSections.changes).toBe(true);
    expect(s.sidebarSections.history).toBe(false);
    expect(s.toasts).toHaveLength(0);
  });

  it('setActiveView changes activeView', () => {
    useUiStore.getState().setActiveView('history');
    expect(useUiStore.getState().activeView).toBe('history');
  });

  it('toggleSection flips boolean', () => {
    useUiStore.getState().toggleSection('history');
    expect(useUiStore.getState().sidebarSections.history).toBe(true);
    useUiStore.getState().toggleSection('history');
    expect(useUiStore.getState().sidebarSections.history).toBe(false);
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
});
