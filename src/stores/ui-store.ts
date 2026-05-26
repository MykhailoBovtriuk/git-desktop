import { create } from 'zustand';
import type { ActiveView, Toast, ToastVariant } from '../types';

interface UiState {
  activeView: ActiveView;
  selectedCommit: string | null;
  selectedFile: string | null;
  activeMergeFile: string | null;
  toasts: Toast[];
  setActiveView: (view: ActiveView) => void;
  setSelectedCommit: (hash: string | null) => void;
  setSelectedFile: (path: string | null) => void;
  setActiveMergeFile: (path: string | null) => void;
  addToast: (toast: { variant: ToastVariant; title: string; message: string; action?: Toast['action'] }) => void;
  removeToast: (id: string) => void;
}

export const useUiStore = create<UiState>()((set) => ({
  activeView: 'changes',
  selectedCommit: null,
  selectedFile: null,
  activeMergeFile: null,
  toasts: [],

  setActiveView: (view) => set({ activeView: view }),
  setSelectedCommit: (hash) => set({ selectedCommit: hash }),
  setSelectedFile: (path) => set({ selectedFile: path }),
  setActiveMergeFile: (path) => set({ activeMergeFile: path }),
  addToast: (toast) =>
    set(s => ({
      toasts: [...s.toasts, { ...toast, id: crypto.randomUUID() }],
    })),
  removeToast: (id) => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),
}));
