import { create } from 'zustand';
import type { ActiveView, OverlayView, Toast, ToastVariant } from '../types';

export type SelectedFileArea = 'staged' | 'unstaged' | 'commit';
export const SETTINGS_CATEGORIES = [
  'general',
  'accounts',
  'git',
  'diff',
  'terminal',
  'logs',
  'updates',
] as const;
export type SettingsCategory = (typeof SETTINGS_CATEGORIES)[number];

export type RightPanelTab = 'logs' | 'terminal';

const OVERLAY_VIEWS = new Set<ActiveView>(['settings', 'about']);
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
  selectedCommit: string | null;
  selectedFile: string | null;
  selectedFileArea: SelectedFileArea | null;
  activeMergeFile: string | null;
  toasts: Toast[];
  selectedStash: number | null;
  /**
   * The new-branch dialog. Kept here rather than in the branch dropdown because
   * the dropdown closes the moment it is opened.
   */
  newBranchOpen: boolean;
  connectionOpen: boolean;
  rightPanel: RightPanelTab | null;
  /**
   * Set the first time the terminal tab opens and never cleared: from then on
   * its view stays mounted (hidden) so switching tabs never rebuilds xterm.
   */
  terminalMounted: boolean;
  settingsCategory: SettingsCategory;
  setSettingsCategory: (category: SettingsCategory) => void;
  openSettings: (category?: SettingsCategory) => void;
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  toggleRightPanel: (tab: RightPanelTab) => void;
  openRightPanel: (tab: RightPanelTab) => void;
  closeRightPanel: () => void;
  setActiveView: (view: ActiveView) => void;
  openOverlayView: (view: OverlayView) => void;
  closeOverlays: () => void;
  openNewBranch: () => void;
  closeNewBranch: () => void;
  openConnection: () => void;
  closeConnection: () => void;
  setSelectedCommit: (hash: string | null) => void;
  setSelectedFile: (path: string | null, area?: SelectedFileArea) => void;
  setActiveMergeFile: (path: string | null) => void;
  addToast: (toast: {
    variant: ToastVariant;
    title: string;
    message: string;
    action?: Toast['action'];
    details?: Toast['details'];
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
  newBranchOpen: false,
  connectionOpen: false,
  rightPanel: null,
  terminalMounted: false,
  settingsCategory: 'general',
  sidebarOpen: true,

  setActiveView: view => set({ activeView: view }),
  openOverlayView: view =>
    set(s =>
      isOverlayView(s.activeView)
        ? { activeView: view }
        : { activeView: view, previousView: s.activeView },
    ),
  setSettingsCategory: settingsCategory => set({ settingsCategory }),
  openSettings: category => {
    if (category) set({ settingsCategory: category });
    get().openOverlayView('settings');
  },
  closeOverlays: () =>
    set(s => (isOverlayView(s.activeView) ? { activeView: s.previousView } : {})),
  openNewBranch: () => set({ newBranchOpen: true }),
  closeNewBranch: () => set({ newBranchOpen: false }),
  openConnection: () => set({ connectionOpen: true }),
  closeConnection: () => set({ connectionOpen: false }),
  toggleSidebar: () =>
    set(s =>
      isOverlayView(s.activeView)
        ? { activeView: s.previousView, sidebarOpen: true }
        : { sidebarOpen: !s.sidebarOpen },
    ),
  toggleRightPanel: tab =>
    set(s => ({
      rightPanel: s.rightPanel === tab ? null : tab,
      terminalMounted: s.terminalMounted || tab === 'terminal',
    })),
  openRightPanel: tab =>
    set(s => ({ rightPanel: tab, terminalMounted: s.terminalMounted || tab === 'terminal' })),
  closeRightPanel: () => set({ rightPanel: null }),
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
