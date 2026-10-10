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
  beforeEach(() => {
    useUiStore.setState(INITIAL);
  });

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

  // Promise-based confirm flow replacing window.confirm: a component awaits
  // requestConfirm(), the ConfirmDialog host resolves it via resolveConfirm().
  describe('confirm flow', () => {
    it('requestConfirm exposes the request and resolves true on confirm', async () => {
      const promise = useUiStore.getState().requestConfirm({
        title: 'Delete branch',
        message: 'Really?',
        confirmLabel: 'Delete',
        danger: true,
      });
      expect(useUiStore.getState().confirmRequest).toMatchObject({ title: 'Delete branch' });

      useUiStore.getState().resolveConfirm(true);
      await expect(promise).resolves.toBe(true);
      expect(useUiStore.getState().confirmRequest).toBeNull();
    });

    it('resolves false on cancel', async () => {
      const promise = useUiStore.getState().requestConfirm({
        title: 'T',
        message: 'M',
        confirmLabel: 'OK',
      });
      useUiStore.getState().resolveConfirm(false);
      await expect(promise).resolves.toBe(false);
    });

    it('a second request cancels the pending one', async () => {
      const first = useUiStore
        .getState()
        .requestConfirm({ title: '1', message: 'M', confirmLabel: 'OK' });
      const second = useUiStore
        .getState()
        .requestConfirm({ title: '2', message: 'M', confirmLabel: 'OK' });
      await expect(first).resolves.toBe(false);
      useUiStore.getState().resolveConfirm(true);
      await expect(second).resolves.toBe(true);
    });
  });
});

describe('overlay views', () => {
  beforeEach(() => {
    useUiStore.setState({ activeView: 'changes', previousView: 'changes', sidebarOpen: true });
  });

  it('switching between Settings and About replaces the page', () => {
    useUiStore.getState().setActiveView('graph');
    useUiStore.getState().openOverlayView('about');
    useUiStore.getState().openOverlayView('settings');
    expect(useUiStore.getState().activeView).toBe('settings');

    // Closing goes back to the work view, never to the page shown before.
    useUiStore.getState().closeOverlays();
    expect(useUiStore.getState().activeView).toBe('graph');
  });

  it('closes to where the user came from, however many times the pages were switched', () => {
    useUiStore.getState().setActiveView('history');
    useUiStore.getState().openOverlayView('settings');
    useUiStore.getState().openOverlayView('about');
    useUiStore.getState().openOverlayView('settings');
    useUiStore.getState().closeOverlays();
    expect(useUiStore.getState().activeView).toBe('history');
  });

  it('closing outside Settings/About changes nothing', () => {
    useUiStore.getState().setActiveView('stash');
    useUiStore.getState().closeOverlays();
    expect(useUiStore.getState().activeView).toBe('stash');
  });

  it('the sidebar toggle leaves Settings and shows the sidebar', () => {
    useUiStore.setState({ sidebarOpen: false });
    useUiStore.getState().openOverlayView('settings');
    useUiStore.getState().toggleSidebar();
    expect(useUiStore.getState().activeView).toBe('changes');
    expect(useUiStore.getState().sidebarOpen).toBe(true);
  });
});
