import { create } from 'zustand';
import type { ActiveView, Toast, ToastVariant } from '../types';

// Where the selected file was clicked. A partially staged file appears in
// both the staged and unstaged lists — the diff shown must follow the list
// the user clicked in, not just the path.
export type SelectedFileArea = 'staged' | 'unstaged' | 'commit';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
}

interface UiState {
  activeView: ActiveView;
  selectedCommit: string | null;
  selectedFile: string | null;
  selectedFileArea: SelectedFileArea | null;
  activeMergeFile: string | null;
  toasts: Toast[];
  selectedStash: number | null;
  setActiveView: (view: ActiveView) => void;
  setSelectedCommit: (hash: string | null) => void;
  setSelectedFile: (path: string | null, area?: SelectedFileArea) => void;
  setActiveMergeFile: (path: string | null) => void;
  addToast: (toast: { variant: ToastVariant; title: string; message: string; action?: Toast['action'] }) => void;
  removeToast: (id: string) => void;
  setSelectedStash: (index: number | null) => void;
  // Promise-based replacement for window.confirm: the caller awaits
  // requestConfirm(), the ConfirmDialog host (mounted in Shell) shows the
  // request and settles it via resolveConfirm().
  confirmRequest: (ConfirmOptions & { resolve: (ok: boolean) => void }) | null;
  requestConfirm: (opts: ConfirmOptions) => Promise<boolean>;
  resolveConfirm: (ok: boolean) => void;
}

export const useUiStore = create<UiState>()((set, get) => ({
  activeView: 'changes',
  selectedCommit: null,
  selectedFile: null,
  selectedFileArea: null,
  activeMergeFile: null,
  toasts: [],
  selectedStash: null,

  setActiveView: (view) => set({ activeView: view }),
  setSelectedCommit: (hash) => set({ selectedCommit: hash }),
  setSelectedFile: (path, area) =>
    set({ selectedFile: path, selectedFileArea: path ? area ?? null : null }),
  setActiveMergeFile: (path) => set({ activeMergeFile: path }),
  addToast: (toast) =>
    set(s => ({
      toasts: [...s.toasts, { ...toast, id: crypto.randomUUID() }],
    })),
  removeToast: (id) => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),
  setSelectedStash: (index) => set({ selectedStash: index }),

  confirmRequest: null,
  requestConfirm: (opts) =>
    new Promise<boolean>((resolve) => {
      // Only one dialog at a time — a newer request cancels the pending one.
      get().confirmRequest?.resolve(false);
      set({ confirmRequest: { ...opts, resolve } });
    }),
  resolveConfirm: (ok) => {
    const request = get().confirmRequest;
    if (!request) return;
    set({ confirmRequest: null });
    request.resolve(ok);
  },
}));
