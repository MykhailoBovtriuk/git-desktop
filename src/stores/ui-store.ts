import { create } from 'zustand';
import type { ActiveView, OverlayView, Toast, ToastVariant } from '../types';

export type SelectedFileArea = 'staged' | 'unstaged' | 'commit';
export type SettingsFocus = 'auth' | null;

const OVERLAY_VIEWS = new Set<ActiveView>(['settings', 'settings-account', 'about']);
export const isOverlayView = (view: ActiveView): boolean => OVERLAY_VIEWS.has(view);

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
}

interface UiState {
  activeView: ActiveView;
  previousView: ActiveView;
  /** Overlay screens sitting below the current one, oldest first. */
  overlayStack: OverlayView[];
  /** Section to scroll to on arrival; consumed once, then cleared. */
  settingsFocus: SettingsFocus;
  consumeSettingsFocus: () => SettingsFocus;
  selectedCommit: string | null;
  selectedFile: string | null;
  selectedFileArea: SelectedFileArea | null;
  activeMergeFile: string | null;
  toasts: Toast[];
  selectedStash: number | null;
  setActiveView: (view: ActiveView) => void;
  openOverlayView: (view: OverlayView, focus?: SettingsFocus) => void;
  overlayBack: () => void;
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
  overlayStack: [],
  settingsFocus: null,
  selectedCommit: null,
  selectedFile: null,
  selectedFileArea: null,
  activeMergeFile: null,
  toasts: [],
  selectedStash: null,

  setActiveView: view => set({ activeView: view }),
  // Settings/About cover the whole content area, so leaving them has to restore
  // whatever the user was looking at rather than dumping them on 'changes'.
  openOverlayView: (view, focus = null) =>
    set(s => {
      if (!isOverlayView(s.activeView)) {
        return {
          activeView: view,
          settingsFocus: focus,
          previousView: s.activeView,
          overlayStack: [],
        };
      }
      const current = s.activeView as OverlayView;
      // Navigating to a screen already below us (a breadcrumb, a link back up)
      // has to unwind the stack to it — pushing would make "back" loop between
      // the two screens forever.
      const depth = s.overlayStack.indexOf(view);
      const overlayStack =
        depth >= 0
          ? s.overlayStack.slice(0, depth)
          : view === current
            ? s.overlayStack
            : [...s.overlayStack, current];
      return { activeView: view, settingsFocus: focus, overlayStack };
    }),
  // One level up: to the overlay screen underneath, or out to the work view
  // when this is the top-level one.
  overlayBack: () =>
    set(s => {
      const stack = s.overlayStack;
      if (stack.length === 0) return { activeView: s.previousView, overlayStack: [] };
      return { activeView: stack[stack.length - 1], overlayStack: stack.slice(0, -1) };
    }),
  consumeSettingsFocus: () => {
    const focus = get().settingsFocus;
    if (focus) set({ settingsFocus: null });
    return focus;
  },
  closeOverlayView: () => set(s => ({ activeView: s.previousView, overlayStack: [] })),
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
