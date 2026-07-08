import { create } from 'zustand';
import type { ActiveView, Toast, ToastVariant } from '../types';

// Where the selected file was clicked. A partially staged file appears in
// both the staged and unstaged lists — the diff shown must follow the list
// the user clicked in, not just the path.
export type SelectedFileArea = 'staged' | 'unstaged' | 'commit';

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
}

export const useUiStore = create<UiState>()((set) => ({
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
}));
