import { create } from 'zustand';
import type { ActiveView, OverlayView, Toast, ToastVariant } from '../types';

export type SelectedFileArea = 'staged' | 'unstaged' | 'commit';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
}

interface UiState {
  activeView: ActiveView;
  previousView: ActiveView;
  selectedCommit: string | null;
  selectedFile: string | null;
  selectedFileArea: SelectedFileArea | null;
  activeMergeFile: string | null;
  toasts: Toast[];
  selectedStash: number | null;
  setActiveView: (view: ActiveView) => void;
  openOverlayView: (view: OverlayView) => void;
  closeOverlayView: () => void;
  setSelectedCommit: (hash: string | null) => void;
  setSelectedFile: (path: string | null, area?: SelectedFileArea) => void;
  setActiveMergeFile: (path: string | null) => void;
  addToast: (toast: {
    variant: ToastVariant;
    title: string;
    message: string;
    action?: Toast['action'];
  }) => void;
  removeToast: (id: string) => void;
  setSelectedStash: (index: number | null) => void;
  confirmRequest: (ConfirmOptions & { resolve: (ok: boolean) => void }) | null;
  requestConfirm: (opts: ConfirmOptions) => Promise<boolean>;
  resolveConfirm: (ok: boolean) => void;
}

export const useUiStore = create<UiState>()((set, get) => ({
  activeView: 'changes',
  previousView: 'changes',
  selectedCommit: null,
  selectedFile: null,
  selectedFileArea: null,
  activeMergeFile: null,
  toasts: [],
  selectedStash: null,

  setActiveView: view => set({ activeView: view }),
  // Settings/About cover the whole content area, so leaving them has to restore
  // whatever the user was looking at rather than dumping them on 'changes'.
  openOverlayView: view =>
    set(s => ({
      activeView: view,
      previousView:
        s.activeView === 'settings' || s.activeView === 'about' ? s.previousView : s.activeView,
    })),
  closeOverlayView: () => set(s => ({ activeView: s.previousView })),
  setSelectedCommit: hash => set({ selectedCommit: hash }),
  setSelectedFile: (path, area) =>
    set({ selectedFile: path, selectedFileArea: path ? (area ?? null) : null }),
  setActiveMergeFile: path => set({ activeMergeFile: path }),
  addToast: toast =>
    set(s => ({
      toasts: [...s.toasts, { ...toast, id: crypto.randomUUID() }],
    })),
  removeToast: id => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),
  setSelectedStash: index => set({ selectedStash: index }),

  confirmRequest: null,
  requestConfirm: opts =>
    new Promise<boolean>(resolve => {
      get().confirmRequest?.resolve(false);
      set({ confirmRequest: { ...opts, resolve } });
    }),
  resolveConfirm: ok => {
    const request = get().confirmRequest;
    if (!request) return;
    set({ confirmRequest: null });
    request.resolve(ok);
  },
}));
