# Architecture — git-desktop

A cross-platform desktop Git client built with Electron, React, and TypeScript. Designed for visual Git workflows — commit graph visualization, side-by-side conflict resolution, hunk-level staging, branch management — for developers who want a richer UI than the CLI but lighter weight than GitKraken or Tower.

This document explains:
- The technology choices and why each was made
- How the two Electron processes (main + renderer) communicate
- The layered architecture inside the renderer
- The file-by-file responsibilities
- The design system (Tailwind v4 + Catppuccin Mocha palette)
- Edge cases the codebase actively handles
- Build and test workflows

---

## 1. What this app is

A native desktop application that wraps the user's local `git` CLI with a polished UI. The user opens a folder on their machine that contains a Git repository, and the app provides:

- **Welcome screen** with recent repositories list
- **Sidebar navigation** between Changes / History / Graph views (Changes is at the top as an expandable accordion, History and Graph are nav buttons pinned to the bottom)
- **Changes view** with staged / unstaged file list, selective staging, discard, commit form
- **Diff viewer** for working-tree diffs, staged diffs, and commit diffs — including synthesized diffs for untracked files (which `git diff` would otherwise return empty)
- **History view** — paginated commit list with filter, commit details panel, per-file diff
- **Commit graph** — SVG-rendered lane-based visualization of branch topology
- **Branch operations** — checkout / merge / rebase / delete from a searchable dropdown, with confirm-before-delete
- **3-panel merge editor** — Current / Result / Incoming with "Use this" buttons; reads the real conflict sides from the Git index (`:2:path`, `:3:path`) and writes resolved content back to the working tree before marking resolved
- **Footer** — fetch / pull / push buttons with loading states and ahead/behind counters
- **Toast notifications** for operation results, positioned under the titlebar

The app remembers the last-opened repository and recent repos list across restarts (persisted via `localStorage`). It auto-refreshes the repo state every 30 seconds.

---

## 2. Technology stack and rationale

| Layer | Choice | Why |
|---|---|---|
| Runtime shell | **Electron 41** | Cross-platform desktop (macOS / Windows / Linux) with one codebase. Mature, well-documented. Brings full Node.js APIs to the main process (needed for filesystem and child-process access for Git). |
| Renderer framework | **React 19** | Mainstream component model with the largest ecosystem. Concurrent rendering, automatic batching, and `useTransition` help keep large file lists / graphs responsive. |
| Build tooling | **Vite 8** + `@vitejs/plugin-react` | Sub-second HMR for the renderer. ESM-native, zero config for TypeScript and JSX. Smaller bundle than Webpack with no plugin gymnastics. |
| Renderer language | **TypeScript 6** (strict) | Catches IPC contract mismatches at compile time. Shared types between `electron/` and `src/` ensure renderer and main agree on data shapes. |
| State management | **Zustand 5** with `persist` middleware | Tiny (1 KB), no boilerplate, no provider trees. Selectors prevent unnecessary re-renders. `persist` middleware syncs the slice we want (recent repos + last-open path) to `localStorage`. |
| Git backend | **simple-git 3** | Wraps the user's installed `git` CLI. Simpler than a native libgit2 binding, and respects the user's existing git config (credentials, hooks, SSH keys, etc.). Trade-off: requires the user to have Git installed. |
| Graph rendering | **SVG + D3 utilities** (custom layout) | SVG paths render Bezier curves between commits with crisp lines at any zoom. CSS-styleable. No canvas/WebGL setup. The lane layout is custom (see `src/components/graph/graph-layout.ts`) — D3 isn't actually invoked at runtime; only its types are pulled in. |
| Styling | **Tailwind v4** + custom `@theme` tokens | Utility-first keeps style colocated with markup. v4 generates colors from `@theme` directives in CSS — no JS config needed. Custom palette via `--color-*` tokens (see §6). |
| Internationalization | **i18next** + `react-i18next` + `i18next-browser-languagedetector` | Wired up for EN and UK with namespaced JSON resources. **Note:** translations exist but components currently hardcode English; the i18n setup is a placeholder for future activation. |
| Diff parsing | Custom parser in `src/components/diff/parse-diff.ts` | The output of `git diff` is well-specified (unified diff format) but standalone NPM parsers add weight. The custom parser handles `--- /dev/null` (new file), `+++ /dev/null` (deletion), `Binary files differ`, and multi-file diffs. |
| Testing | **Vitest 4** + `@testing-library/react` + `jsdom` | Same config and transformer as Vite, so tests run in the same module graph as production. Real Git is used for `GitService` tests (creates a temp repo via `execSync`) rather than mocks — catches real Git CLI behavior. |
| Packaging | **electron-builder** | Standard for shipping cross-platform Electron apps. Configured via `electron-builder.yml`. |

### Why this stack instead of alternatives

- **Tauri** would produce smaller binaries but the Rust learning curve and weaker frontend tooling work against shipping fast.
- **NW.js** is the older alternative to Electron; Electron has the bigger ecosystem and more battle-tested production deployments (VS Code, Slack, Discord).
- **libgit2** native bindings (e.g. `nodegit`) would remove the Git-CLI dependency, but require platform-specific native builds, ignore the user's existing credential helper / SSH config, and add maintenance burden. We pay a perf cost (each `simple-git` call shells out) in exchange for compatibility with whatever Git the user already has.
- **Redux** for state is overkill for an app of this size; **Jotai/Recoil** are similar in scope to Zustand but Zustand has less ceremony for the imperative actions we need (fetch, mutate, refresh).
- **CodeMirror / Monaco** as a diff editor would unlock syntax highlighting, but the current minimal HTML/CSS diff renderer is enough for MVP and keeps the bundle small (~280 KB JS gzipped at time of writing).

---

## 3. Process model — Electron's two halves

Electron has **two distinct Node-VM-like processes** that communicate over IPC. Understanding this boundary is critical to working in this codebase.

```
┌─────────────────────────────────────────────────────────────────────┐
│                         MAIN PROCESS (Node.js)                       │
│  electron/main.ts            ← entry; creates the BrowserWindow      │
│  electron/ipc-handlers.ts    ← registers ipcMain.handle('git:*', …)  │
│  electron/git-service.ts     ← simpleGit wrapper, owns repo state    │
│  electron/preload.ts         ← bridges to renderer (contextBridge)   │
│                                                                       │
│  Has: full Node.js APIs (fs, child_process, dialog, etc.)            │
│  Owns: the GitService singleton, the filesystem dialog, app lifecycle│
└─────────────────────────────────────────────────────────────────────┘
                                  ▲
                                  │  IPC (contextBridge)
                                  │  channel: "git:*"
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      RENDERER PROCESS (Chromium)                     │
│  src/main.tsx                ← React root                            │
│  src/App.tsx                 ← auto-refresh + auto-open persisted    │
│  src/api/git-api.ts          ← typed wrapper around window.electronAPI│
│  src/stores/*.ts             ← Zustand state                         │
│  src/components/**/*.tsx     ← React UI                              │
│                                                                       │
│  Has: DOM, React, browser APIs (localStorage), but NO direct Node    │
│  Owns: all UI state, the persistence layer (localStorage)            │
└─────────────────────────────────────────────────────────────────────┘
```

### Why this split matters

- The renderer **cannot** call `fs.readFile`, `child_process.exec`, or `git` directly. It can only ask the main process to do so via IPC.
- This is a hard security boundary set by `contextIsolation: true` and `nodeIntegration: false` in `electron/main.ts`. The renderer gets exactly one preload-injected object on `window.electronAPI` and nothing else.
- All Git operations (and untracked-file reads, conflict-side reads) live in `GitService` (main) and are exposed via IPC handlers. The renderer treats `gitApi` as if it were a remote HTTP API.

### The IPC handshake — anatomy of one call

User clicks "Stage All". The chain:

1. **`ChangesSection.tsx`** → `stageFiles(unstagedPaths)` (a store action)
2. **`repo-store.ts`** → `gitApi.stageFiles(paths)`
3. **`api/git-api.ts`** → `invoke<null>('git:stage-files', paths)` which calls `window.electronAPI.invoke('git:stage-files', paths)`
4. **`preload.ts`** → `ipcRenderer.invoke('git:stage-files', paths)` — crosses the process boundary
5. **`ipc-handlers.ts`** → matches the channel name, calls `gitService.stageFiles(paths)`, wraps result as `{ data }` or `{ error, code }`
6. **`git-service.ts`** → `simpleGit().add(paths)` → shells out to `git add ...`
7. Result bubbles back. `git-api.ts` checks for `'error' in result`, throws if present, else returns `result.data`.
8. The store then calls `loadStatus()` to refresh; the UI re-renders with the file moved to the staged list.

All channel names follow the pattern `git:<action>` — see `electron/ipc-handlers.ts` for the full registry.

### The preload bridge

`electron/preload.ts` is intentionally minimal:

```ts
contextBridge.exposeInMainWorld('electronAPI', {
  invoke: (channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args),
});
```

Only the generic `invoke` is exposed — not the channel list, not `ipcRenderer` directly. This means a compromised renderer can't fire arbitrary IPC events to channels the main process doesn't handle. The handler registry in `ipc-handlers.ts` is the gate.

---

## 4. Layered architecture inside the renderer

```
┌───────────────────────────────────────────────────────────┐
│  UI Components                                             │
│  src/components/{layout,staging,diff,history,graph,merge…}│
│  Responsibility: render markup, dispatch user intent       │
└───────────────────────────────────────────────────────────┘
                          │
                          ▼
┌───────────────────────────────────────────────────────────┐
│  Stores (Zustand)                                          │
│  src/stores/{repo-store,ui-store}.ts                       │
│  Responsibility: orchestrate actions, hold derived state   │
└───────────────────────────────────────────────────────────┘
                          │
                          ▼
┌───────────────────────────────────────────────────────────┐
│  API client (gitApi)                                       │
│  src/api/git-api.ts                                        │
│  Responsibility: typed wrapper over IPC, error unwrapping  │
└───────────────────────────────────────────────────────────┘
                          │  window.electronAPI.invoke()
                          ▼
                       [ IPC ]
                          ▼
                (main process — see §3)
```

**Why this layering matters:**
- Components never `await window.electronAPI.invoke(...)` directly — they call a store action.
- Stores never split work between IPC and DOM; they own the data flow.
- The `gitApi` module is the single place where IPC errors become JavaScript `Error` objects.

This makes the renderer reasoning local: a component knows it calls a store, the store knows it calls the API. Adding a new Git operation is a 4-step ritual:

1. Add a method to `GitService` (main).
2. Register the IPC channel in `ipc-handlers.ts`.
3. Add the typed wrapper in `git-api.ts`.
4. Add an action in `repo-store.ts` (if it mutates state).

The `MergeEditor` rewrite added three new methods this way (`readFile`, `writeFile`, `getConflictSides`).

---

## 5. State management — Zustand stores

There are two stores, separated by domain.

### `useRepoStore` — Git repository state

Lives in `src/stores/repo-store.ts`. Holds the **truth about the repo**:

```ts
{
  repoPath: string | null,           // persisted
  recentRepos: string[],             // persisted (last 10)
  commits: Commit[],                 // last 200 commits, `git log --all`
  branches: Branch[],                // local + remote (merged into one list)
  currentBranch: string,
  status: { staged, unstaged },      // file changes
  aheadBehind: { ahead, behind },    // vs upstream
  mergeState: MergeState | null,     // null = no merge in progress
  // actions: openRepo, refresh, stage, unstage, commit, fetch, pull, push,
  //          checkout, merge, rebase, deleteBranch, abortMerge, etc.
}
```

#### Persistence

The store is wrapped with Zustand's `persist` middleware:

```ts
{
  name: 'git-desktop-repo',
  storage: createJSONStorage(() => localStorage),
  partialize: (s) => ({ repoPath: s.repoPath, recentRepos: s.recentRepos }),
}
```

Only `repoPath` and `recentRepos` survive a restart. `commits`, `branches`, `status` etc. are fetched fresh on boot — they'd be stale anyway.

#### Bootstrap

`src/App.tsx` reads `repoPath` on mount and re-runs `openRepo` to re-initialize the backend `GitService` and pull fresh data:

```ts
useEffect(() => {
  if (repoPath) {
    useRepoStore.getState().openRepo(repoPath).catch(() => {
      useRepoStore.setState({ repoPath: null });
    });
  }
}, []);
```

The catch handler clears `repoPath` if the persisted path no longer exists (e.g. user deleted the folder).

#### Auto-refresh

`src/hooks/use-auto-refresh.ts` runs `refresh()` every 30 seconds. This catches external Git activity (e.g. `git commit` in a terminal) without manual reload. Disabled while no repo is open.

### `useUiStore` — Ephemeral UI state

Lives in `src/stores/ui-store.ts`. Holds the **current view**:

```ts
{
  activeView: 'changes' | 'history' | 'graph' | 'merge-editor',
  selectedCommit: string | null,
  selectedFile: string | null,
  activeMergeFile: string | null,
  toasts: Toast[],
  // actions: setActiveView, setSelectedCommit, setSelectedFile,
  //          setActiveMergeFile, addToast, removeToast
}
```

Not persisted. Fresh on every launch.

Toast IDs use `crypto.randomUUID()` (available in Electron's Chromium renderer ≥ 92) to avoid collisions.

### Why two stores

`useRepoStore` is async-heavy (every action is an IPC round-trip). `useUiStore` is sync only (`setActiveView`, `addToast`). Keeping them separate means UI components subscribing only to `useUiStore` don't re-render when the repo refreshes, and vice versa.

---

## 6. Design system

### Color palette — Catppuccin Mocha

Defined as CSS custom properties in `src/styles/globals.css` via Tailwind v4's `@theme` directive:

```css
@theme {
  --color-base: #1e1e2e;       /* app background */
  --color-mantle: #181825;     /* surfaces (sidebar, footer) */
  --color-surface0: #313244;   /* hover backgrounds */
  --color-surface1: #45475a;   /* selected backgrounds */
  --color-surface2: #585b70;   /* borders */
  --color-text: #cdd6f4;       /* foreground */
  --color-subtext: #a6adc8;    /* secondary text */
  --color-blue: #89b4fa;       /* primary accent */
  --color-green: #a6e3a1;      /* additions, success */
  --color-yellow: #f9e2af;     /* modifications */
  --color-red: #f38ba8;        /* deletions, errors */
  --color-peach: #fab387;      /* copies, warnings */
}
```

Tailwind v4 auto-generates utilities from these tokens: `bg-base`, `text-text`, `border-surface0`, `bg-blue/10`, etc. Each token produces both `bg-*`, `text-*`, and `border-*` utilities.

**Why these names?** They map to the Catppuccin Mocha theme's semantic role names. "Base" is the deepest layer, "mantle" wraps it, "surface0/1/2" are progressively brighter contrast layers. This naming is easier to reason about than raw color values when designing new components.

**Watch out for the `text-base` collision:** Tailwind v4's default theme defines `.text-base` as `font-size: 1rem`. Because we also define `--color-base`, v4 *would* generate a color utility of the same name — but they collide. The codebase resolves this by using `text-mantle` (`#181825`) for "dark text on blue button" instead of `text-base`. If you add a new button on a blue background, use `text-mantle`.

### Layout primitives

The chrome is composed in `src/components/layout/Shell.tsx`:

```
┌──────────────────────────────────────────────────────────┐
│ Titlebar (h-10, hiddenInset titlebar with drag region)   │
├──────────┬───────────────────────────────────────────────┤
│ Sidebar  │  MainContent (via activeView switch)          │
│ (w-56)   │                                                │
│          │                                                │
│ Changes  │  ⇒ DiffViewer (when activeView='changes')     │
│ ──────   │  ⇒ HistoryView (when activeView='history')    │
│  files   │  ⇒ CommitGraph (when activeView='graph')      │
│          │  ⇒ MergeEditor (when activeView='merge-editor')│
│  CommitF │                                                │
│          │                                                │
│ (spacer) │                                                │
│ ──────   │                                                │
│ History  │                                                │
│ Graph    │                                                │
├──────────┴───────────────────────────────────────────────┤
│ Footer (h-10, hash + branch + ↑↓ + fetch/pull/push)     │
└──────────────────────────────────────────────────────────┘
```

**Sidebar composition** (current design): two visual blocks.
- **Top block** — Changes accordion. Click toggles open/close. When open, shows the file list and commit form inline.
- **Bottom block** — History + Graph nav buttons. Pinned to the bottom via a `flex-1` spacer. No accordion triangle — they're tab-like buttons. Active button has a 2px blue left border and `bg-surface0`.

### Window chrome

- macOS: `titleBarStyle: 'hiddenInset'` — the OS traffic-light buttons appear over the custom Titlebar. The first 80px is reserved as drag region.
- The CSS for the body sets `overflow: hidden` and `user-select: none` to prevent the app from feeling like a webpage.

---

## 7. View routing — how the main content switches

There is no React Router. The current view is a single field on `useUiStore`:

```ts
type ActiveView = 'changes' | 'history' | 'graph' | 'merge-editor';
```

`Shell.tsx`'s `MainContent` component is a `switch` statement over `activeView`. The sidebar buttons just call `setActiveView('history' | 'graph' | 'changes')`. A merge conflict programmatically sets `activeView` to `'merge-editor'` when the user clicks "Resolve Conflicts" in the `MergeConflictModal`.

**Selection state is shared across views but contextualized:**
- `selectedCommit` is set when clicking in `CommitList` (history view) or `CommitGraph`.
- `selectedFile` is set when clicking a file row in `ChangesSection` (changes view) or in the commit's changed-files list (history view).
- The `DiffViewer` uses both, but **only treats `selectedCommit` as authoritative when `activeView === 'history' || 'graph'`**. In `'changes'` view, it always falls back to working/staged diff. This prevents a stale commit selection from corrupting the changes view (a bug class fixed in this codebase).

---

## 8. Git operations reference

| User intent | Component | Store action | `gitApi` call | IPC channel | `GitService` method | `simple-git` op |
|---|---|---|---|---|---|---|
| Open repo dialog | `WelcomeScreen` / `RepoDropdown` | `openDialog` | `openDialog()` | `git:open-dialog` | `openRepo(picked)` | (filesystem dialog + new `simpleGit(path)`) |
| List branches | `Titlebar` (on mount) | `loadBranches` | `getBranches()` | `git:get-branches` | `getBranches()` | `git.branch(['-a'])` |
| Read log | `Sidebar` / `HistoryView` | `loadLog` | `getLog(200, 0)` | `git:get-log` | `getLog(limit, offset)` | `git.raw(['log', '--all', '--topo-order', ...])` with `%H%x00%s%x00...` format |
| Get status | All | `loadStatus` | `getStatus()` | `git:get-status` | `getStatus()` | `git.status()` — returns staged, unstaged, **ahead, behind** in one call |
| Stage file | `FileList` `+` button | `stageFiles([path])` | `stageFiles(paths)` | `git:stage-files` | `stageFiles(paths)` | `git.add(paths)` |
| Unstage file | `FileList` `−` button | `unstageFiles([path])` | `unstageFiles(paths)` | `git:unstage-files` | `unstageFiles(paths)` | `git.reset(['HEAD', '--', ...paths])` |
| Discard | `FileList` `×` button | `discardChanges([path])` | `discardChanges(paths)` | `git:discard-changes` | `discardChanges(paths)` | `git.checkout(['--', ...paths])` |
| Commit | `CommitForm` | `commit(msg)` | `commit(msg)` | `git:commit` | `commit(msg)` | `git.commit(msg)` |
| Fetch | `Footer` | `fetch` | `fetch()` | `git:fetch` | `fetch()` | `git.fetch()` |
| Pull | `Footer` | `pull` | `pull()` | `git:pull` | `pull()` | `git.pull()` (with `'Already up to date'` fallback) |
| Push | `Footer` | `push` | `push()` | `git:push` | `push()` | `git.push()` |
| Checkout | `BranchDropdown` | `checkout(name)` | `checkout(name)` | `git:checkout` | `checkout(name)` | `git.checkout(name)` |
| Merge | `BranchDropdown` | `merge(name)` | `merge(name)` | `git:merge` | `merge(name)` | `git.merge([name])` — returns `{ success, conflicts[] }` |
| Rebase | `BranchDropdown` | `rebase(name)` | `rebase(name)` | `git:rebase` | `rebase(name)` | `git.rebase([name])` |
| Delete branch | `BranchDropdown` | `deleteBranch(name)` | `deleteBranch(name)` | `git:delete-branch` | `deleteBranch(name)` | `git.deleteLocalBranch(name, true)` |
| Commit diff | `HistoryView` | (effect) | `getCommitDiff(hash)` | `git:get-commit-diff` | `getCommitDiff(hash)` | `git.diffSummary([hash^, hash])` or `[EMPTY_TREE, hash]` for root commit |
| File diff in commit | `DiffViewer` (history mode) | (effect) | `getFileDiff(hash, p)` | `git:get-file-diff` | `getFileDiff(hash, p)` | `git.diff([hash^, hash, '--', p])` or empty-tree fallback |
| Working diff | `DiffViewer` (changes mode) | (effect) | `getWorkingDiff(p)` | `git:get-working-diff` | `getWorkingDiff(p)` | `git.diff(['--', p])` or **synthesized untracked diff** (see §9) |
| Staged diff | `DiffViewer` (changes mode, staged) | (effect) | `getStagedDiff(p)` | `git:get-staged-diff` | `getStagedDiff(p)` | `git.diff(['--cached', '--', p])` |
| Conflict sides | `MergeEditor` | (effect) | `getConflictSides(p)` | `git:get-conflict-sides` | `getConflictSides(p)` | `git.show([':2:p'])` (ours), `:3:p` (theirs), `:1:p` (base) |
| Read file | `MergeEditor` | (effect) | `readFile(p)` | `git:read-file` | `readFile(p)` | `fs.readFile(path.join(repo, p))` |
| Write file | `MergeEditor` (save) | (effect) | `writeFile(p, c)` | `git:write-file` | `writeFile(p, c)` | `fs.writeFile(path.join(repo, p), c)` |
| Mark resolved | `MergeEditor` | — | `markResolved(p)` | `git:mark-resolved` | `markResolved(p)` | `git.add([p])` |
| Abort merge | `MergeConflictModal` / `MergeEditor` | `abortMerge` | `abortMerge()` | `git:abort-merge` | `abortMerge()` | `git.merge(['--abort'])` |

---

## 9. Edge cases the codebase actively handles

These are non-obvious cases where naive code would fail. The handling is deliberate.

### Root commit has no parent

`git diff HASH^ HASH` fails on the first commit (no parent ref). `GitService.hasParent(hash)` does `git rev-parse --verify HASH^` and falls back to git's well-known **empty tree SHA** `4b825dc642cb6eb9a060e54bf8d69288fbee4904` when no parent exists. Diffing against the empty tree produces a diff that shows the full file as additions — which is exactly what you want for the initial commit. Applied in both `getCommitDiff` and `getFileDiff`.

### Conflicted files (`UU` status)

Simple-git reports unmerged files with index/working_dir = `U`. The default flow would push them into both staged and unstaged buckets with status mapped to fallback `'M'` — silently hiding the conflict. Fix: check `status.conflicted` first; conflicted files are routed only to `unstaged` with explicit status `'U'`. `FileList.tsx` colors `'U'` in red. The `MergeConflictModal` auto-shows when `mergeState` is set.

### Untracked files

`git diff -- newfile.txt` returns empty for untracked files. The naive flow would show an empty diff viewer when the user clicks an untracked file. Fix: `getWorkingDiff` checks `status.not_added` and **synthesizes a unified-diff string** against `/dev/null`, including the full file content prefixed with `+`. Binary files (containing `\0`) get the `Binary files differ` shape instead. The synthesized output parses normally through `parseDiff` and renders as if it were a real diff — green additions for every line.

### DiffViewer race conditions

When the user clicks files rapidly, the diff for file A might complete *after* the diff for file B. Without protection, B's diff gets overwritten by A's stale response. Fix: the `useEffect` captures a `cancelled` boolean in its cleanup. Every async operation checks `if (!cancelled)` before calling `setState`. The boolean flips when the effect re-runs or the component unmounts.

### Stale `selectedCommit` leaking into Changes view

If the user selects a commit in History, then clicks "Changes" and selects a file there, the naive flow would still call `getFileDiff(staleCommit, currentFile)` — which usually returns empty because the file wasn't changed in that commit. Fix: `DiffViewer` reads `activeView` from `useUiStore` and only honors `selectedCommit` when `activeView === 'history' || 'graph'`.

### `pull` returning undefined summary

`simple-git`'s `pull()` returns `result.summary.changes` as `undefined` if the pull was a no-op fast-forward. The naive `${result.summary.changes} changes…` template produces `undefined changes, undefined insertions…`. Fix: defaults via nullish coalescing, and an explicit `'Already up to date'` return when all three are zero.

### `BranchItem` re-instantiation

In the previous version, `BranchItem` was declared *inside* `BranchDropdown`'s render function. Each render created a new component identity → React unmounted and remounted every list item → context-menu state was lost on every keystroke in the search box. Fix: hoist to module scope, pass all needed props explicitly.

### Destructive actions

`BranchDropdown`'s context menu has a "Delete branch" action. Previously triggered by `onMouseEnter` — trivially fires by mousing over the row. Now requires:
1. Click the explicit `⋯` button.
2. Click "Delete branch" in the menu.
3. Confirm via `window.confirm()`.

Three clicks instead of accidental hover.

### Untracked-file diff hits a closure trap

`synthesizeUntrackedDiff` splits on `\n`. If the file ends with a trailing newline, the last array element is `''`. We trim it (`hasTrailingNewline ? all.slice(0, -1) : all`) so we don't render a phantom empty `+` line. Empty files (0 lines) get a header-only diff with no `@@` hunk.

---

## 10. Build and dev workflow

### Scripts

```json
{
  "dev": "vite",                                           // renderer only, no electron
  "dev:electron": "concurrently \"vite\" \"wait-on http://localhost:5173 && tsc -p tsconfig.node.json && VITE_DEV_SERVER_URL=http://localhost:5173 electron .\"",
  "build": "tsc && vite build && tsc -p tsconfig.node.json",
  "build:electron": "npm run build && electron-builder",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

### `npm run dev:electron` — the development loop

1. `concurrently` runs two commands in parallel.
2. **Stream A** — `vite` boots the renderer dev server on port 5173 with HMR.
3. **Stream B** — `wait-on http://localhost:5173` blocks until Vite is ready, then:
   - `tsc -p tsconfig.node.json` compiles `electron/*.ts` to `dist-electron/electron/*.js` (CommonJS, because Electron's main process uses CommonJS).
   - `VITE_DEV_SERVER_URL=http://localhost:5173 electron .` launches Electron with that env var.
4. `electron/main.ts` reads `process.env.VITE_DEV_SERVER_URL` and calls `mainWindow.loadURL(it)` instead of loading the bundled HTML. This is what enables HMR — the renderer's bundle comes from the dev server, not a static file.
5. In dev mode, DevTools open automatically in a detached window (set up in `electron/main.ts`).

**Important caveat:** changes to `electron/*.ts` (main process code) require a full restart of `dev:electron` — there is no HMR for the main process. Renderer changes (everything in `src/`) hot-reload instantly.

### `npm run build` — production build

1. `tsc` — type-checks the entire project (`src/` + `electron/`, no emit; the `noEmit` flag in `tsconfig.json` keeps the renderer output to Vite).
2. `vite build` — bundles the renderer to `dist/` (HTML + JS + CSS).
3. `tsc -p tsconfig.node.json` — emits CommonJS for the main process to `dist-electron/`.

Both bundles together: ~280 KB JS (gzipped ~86 KB), ~18 KB CSS (gzipped ~4 KB).

### `npm run build:electron` — distributable

Runs `build`, then `electron-builder` packages the app per the `electron-builder.yml` config (macOS .dmg / Windows .exe / Linux .AppImage).

### Two `tsconfig` files — why

`tsconfig.json` covers `src/` and `electron/` with `module: "ESNext"`, `moduleResolution: "bundler"`, `noEmit: true`. Used by the editor for type-checking everywhere. Vite handles the renderer emit.

`tsconfig.node.json` covers `electron/` only with `module: "CommonJS"`, `moduleResolution: "node"`, `outDir: "dist-electron"`. Used to emit the actual main-process JS.

The duplicate compile of `electron/*.ts` (once for type-check, once for emit) is intentional — Vite doesn't compile main-process code, and `tsc -p tsconfig.node.json` doesn't type-check `src/`.

### `electron/preload.ts` path resolution

`main.ts` references the preload as `path.join(__dirname, 'preload.js')`. After `tsc -p tsconfig.node.json`, `__dirname` resolves to `dist-electron/electron/`, and `preload.js` exists alongside `main.js`. The `package.json` `"main": "dist-electron/electron/main.js"` agrees.

---

## 11. Testing

`vitest run` executes 36+ tests across 5 files:

- `tests/git-service.test.ts` — **real Git** integration tests. `beforeEach` creates a temp directory via `os.tmpdir()` + `fs.mkdtempSync`, `execSync('git init')`, sets test user, writes a file, commits. Then each test runs against this real repo. Covers: openRepo, log, branches, status, stage/unstage, commit, discard, checkout, working diff, **root commit diff**, **untracked file diff synthesis**.

- `tests/graph-layout.test.ts` — pure unit tests of the lane-allocation algorithm. Linear chain → lane 0. Merge commit → 2 edges. Empty input → empty output.

- `tests/parse-diff.test.ts` — unit tests of the unified-diff parser. Modified file, new file (`--- /dev/null`), deleted file (`+++ /dev/null`), line-number correctness.

- `tests/stores/ui-store.test.ts` — direct calls into the Zustand store. Initial state, `setActiveView`, toast add/remove.

- `tests/stores/repo-store.test.ts` — mocks `gitApi` via `vi.mock(...)`, then drives store actions. Tests `openRepo` deduplication, `merge` setting `mergeState` on conflicts, `abortMerge` clearing it.

### Testing philosophy

- **GitService gets real Git, not mocks.** A mocked simple-git would let bugs (e.g. status code mapping) slip past tests but break in production. The tradeoff: tests are slightly slower (~1.5s total) because they shell out.
- **Stores get mocked API.** We're testing store logic, not Git logic.
- **Pure functions get unit tests.** `computeLayout`, `parseDiff`, `relativeTime`.

The test runner uses `environment: 'node'` (set in `vitest.config.ts`). For the store tests that import React-via-Zustand bindings, this works because Zustand's vanilla API doesn't require a DOM. If we add component tests, we'll need to add `environment: 'jsdom'` per-file via the `// @vitest-environment jsdom` pragma.

---

## 12. Module-by-module — what each file does

### `electron/` (main process)

- **`main.ts`** — App entry. Creates a `BrowserWindow` with `titleBarStyle: 'hiddenInset'`, `contextIsolation: true`. Registers IPC handlers. Loads either the Vite dev URL or the bundled `dist/index.html`. Opens DevTools in dev.
- **`preload.ts`** — Exposes exactly one thing: `window.electronAPI.invoke(channel, ...args)`.
- **`ipc-handlers.ts`** — Registers all `git:*` channels. Each handler wraps the `GitService` call in `wrap()`, which converts thrown errors to `{ error, code }` and successes to `{ data }`. This is the renderer ↔ main contract.
- **`git-service.ts`** — Stateful service. Owns the `simpleGit` instance and the open repo path. All methods assume `openRepo` was called first. Beyond standard ops, also handles: root-commit diff fallback, untracked diff synthesis, conflict sides via `git show :N:path`, raw file read/write.

### `src/api/`

- **`git-api.ts`** — One typed wrapper per IPC channel. The `invoke<T>` helper unwraps `{ data }` → `T` or throws if `error` is present. This is the only file in `src/` that touches `window.electronAPI`.

### `src/stores/`

- **`repo-store.ts`** — All Git state and async actions. Wrapped with Zustand `persist` (localStorage backend, partializes only `repoPath` + `recentRepos`).
- **`ui-store.ts`** — Ephemeral UI state. View routing, selection state, toasts.

### `src/hooks/`

- **`use-auto-refresh.ts`** — `setInterval(refresh, 30_000)` while a repo is open. Cleanup on unmount or `repoPath` change.

### `src/lib/`

- **`relative-time.ts`** — `"5m ago"`, `"3h ago"`, `"2d ago"`, `"4mo ago"`, `"1y ago"`, with `"just now"` for < 60s and future dates.

### `src/components/layout/`

- **`Shell.tsx`** — Top-level layout. Welcome screen if no repo; otherwise Titlebar / Sidebar / MainContent / Footer / Toast / MergeConflictModal.
- **`Titlebar.tsx`** — macOS-style title bar with drag region. Hosts the branch dropdown (center) and repo dropdown (right). Click-outside handlers close the dropdowns.
- **`Sidebar.tsx`** — Two-block sidebar. Top: Changes accordion (expandable, shows the file list inline). Bottom (pinned via `flex-1` spacer): History and Graph nav buttons with a 2px-blue left border when active.
- **`Footer.tsx`** — Current HEAD short hash, branch name, ahead/behind indicators, fetch/pull/push buttons with loading states.

### `src/components/staging/`

- **`ChangesSection.tsx`** — Renders the "Unstaged" / "Staged" headers, the `FileList` for each bucket, "Stage All" / "Unstage All" actions, and the `CommitForm`. Hides empty buckets.
- **`FileList.tsx`** — Per-file row: status letter (colored by `STATUS_COLOR` map), filename, on hover shows +/−/× action buttons. Click selects the file (sets `selectedFile`).
- **`CommitForm.tsx`** — Textarea + char counter (red past 72) + Commit button. Cmd/Ctrl+Enter submits. Disabled when nothing staged or message empty.

### `src/components/diff/`

- **`DiffViewer.tsx`** — The right-hand panel for changes view (and embedded inside HistoryView for commit diffs). Reads `selectedFile`, `selectedCommit`, `activeView`, and `status.staged` to decide which API call to make. Uses cancellation guard for race-safety. Renders the parsed `FileDiff[]` with hunks and line numbers.
- **`parse-diff.ts`** — Splits raw `git diff` output on `^diff --git ` boundaries, then for each section parses the file paths, the binary-file marker, and the hunks (`@@ -a,b +c,d @@`).

### `src/components/history/`

- **`HistoryView.tsx`** — Two-pane layout. Left: filter input + `CommitList`. Right: commit details + per-file diff list + embedded `DiffViewer`.
- **`CommitList.tsx`** — Scrollable commit list. Filter searches by message and abbreviated hash. Click toggles selection.

### `src/components/graph/`

- **`CommitGraph.tsx`** — SVG layer (Bezier paths between commits + circles for each commit) + text layer (hash, message, refs, relative time). The SVG is absolutely positioned over the text rows; both share a fixed row height of 28px.
- **`graph-layout.ts`** — Pure function `computeLayout(commits)` → array of `{ commit, lane, row, color, edges }`. Maintains a sparse `lanes` array where each slot holds the hash of the next expected commit in that lane. First parent continues in the same lane; additional parents allocate new lanes. Uses a `hash → row` Map for O(1) parent lookups.

### `src/components/merge/`

- **`MergeConflictModal.tsx`** — Auto-shown when `mergeState` is set and we're not already in the merge editor. Lists conflicting files. "Resolve" → opens MergeEditor. "Abort" → `git merge --abort`.
- **`MergeEditor.tsx`** — 3-panel layout. Left: CURRENT (read-only, from `git show :2:path`). Middle: RESULT (editable, starts as the working-tree file). Right: INCOMING (read-only, from `git show :3:path`). "Use this" buttons replace RESULT. "Save & Mark Resolved" writes RESULT to disk, then `git add path`, advances to the next conflicting file or completes the merge.

### `src/components/dropdowns/`

- **`BranchDropdown.tsx`** — Searchable list, separated into Local / Remote sections. `BranchItem` (module-scope component) shows a `⋯` button that toggles a context menu (Checkout / Merge / Rebase / Delete). Delete shows a `window.confirm` prompt.
- **`RepoDropdown.tsx`** — Recent repos list + "Add Repository…" entry that calls `openDialog`.

### `src/components/welcome/`

- **`WelcomeScreen.tsx`** — Shown when `repoPath` is null. Big "Open Repository" button + recent repos list.

### `src/components/common/`

- **`Accordion.tsx`** — Reusable expandable section. Active state: `bg-surface0` + 2px blue left border + `text-text`. Inactive: transparent + `text-subtext`. Used in the Changes section of the sidebar.
- **`Toast.tsx`** — Fixed-position toast container under the titlebar (`top-12`). Each toast auto-dismisses after 5 seconds. Variant colors: success=green, error=red, info=blue.

### `src/components/modals/`

- **`CheckoutModal.tsx`** — "You have uncommitted changes — force switch?" modal. **Currently orphaned** (defined but not rendered anywhere). Wire-in candidate: when `checkout` fails because of uncommitted changes, show this.
- **`CredentialModal.tsx`** — Username/password prompt for HTTPS remotes. **Currently orphaned** too. Wire-in candidate: when push/pull fails with an auth error.

### `src/i18n/`

- **`config.ts`** — Initializes i18next with EN and UK resources, browser language detection, localStorage caching of language choice.
- **`en/*.json` + `uk/*.json`** — Namespaced translations: `common`, `staging`, `graph`, `diff`, `footer`, `branches`, `merge`.
- **Note:** no component currently calls `useTranslation`. This is scaffolding for future multilingual work.

### `src/types.ts`

The shared type definitions. Imported by both renderer and main (the main process imports from `'../src/types'`). Defines:

- Git data shapes: `Commit`, `Branch`, `FileStatus`, `GitStatus`, `AheadBehind`, `MergeState`
- Diff shapes: `DiffHunk`, `DiffLine`, `FileDiff`
- IPC shapes: `IpcError`, `IpcResult<T>`
- UI types: `ActiveView`, `Toast`, `ToastVariant`
- Window typing: `ElectronAPI` and the `Window.electronAPI` declaration

---

## 13. Notable trade-offs and known limitations

- **Hard dependency on a system Git binary.** No bundled Git. Users without `git` on `PATH` will see "command not found" errors. Acceptable for a developer-targeted tool.
- **i18n is scaffolded but inactive.** All UI text is hardcoded English. The translation JSON files exist for EN and UK but no component calls `useTranslation`. Either delete the i18n setup or wire it up — decided per release.
- **No hunk-level / line-level staging yet.** The current "Stage" button stages the whole file via `git add`. Hunk-level staging would require parsing the diff into hunks (we already do) and using `git apply --cached`.
- **The 3-panel merge editor is not PhpStorm-grade.** It shows real conflict sides and lets you edit the result manually, but it doesn't yet auto-detect conflict regions or offer per-region "accept ours / accept theirs / both" controls.
- **Drag-and-drop merge/rebase/cherry-pick** is on the roadmap (Project memory) but not implemented.
- **Commit graph lane allocation is approximate** for repos with very wide branching topology. The lane algorithm doesn't currently re-pack lanes after a branch terminates, so deep merges can leave lane drift. Fine for typical day-to-day usage.
- **No virtualization.** The commit list and graph render up to 200 commits. For repos with 10k+ commits we'd want windowing (e.g. `@tanstack/react-virtual`).
- **DevTools opens automatically in dev.** Disable in `electron/main.ts` if you find it annoying.

---

## 14. Quick reference — file map

```
git-desktop/
├── electron/                        # Main process (Node)
│   ├── main.ts                      # Entry, BrowserWindow creation
│   ├── preload.ts                   # window.electronAPI bridge
│   ├── ipc-handlers.ts              # All git:* IPC channels
│   └── git-service.ts               # simple-git wrapper + repo state
├── src/                             # Renderer (Chromium)
│   ├── main.tsx                     # React root
│   ├── App.tsx                      # Auto-refresh + auto-open last repo
│   ├── index.html                   # Vite HTML entry
│   ├── types.ts                     # Shared types (used by main + renderer)
│   ├── vite-env.d.ts                # Vite env typing
│   ├── api/
│   │   └── git-api.ts               # Typed IPC wrapper
│   ├── stores/
│   │   ├── repo-store.ts            # Git state (persisted)
│   │   └── ui-store.ts              # UI state (ephemeral)
│   ├── hooks/
│   │   └── use-auto-refresh.ts      # 30s interval refresh
│   ├── lib/
│   │   └── relative-time.ts         # "5m ago" formatter
│   ├── i18n/
│   │   ├── config.ts                # i18next setup (currently inactive)
│   │   ├── en/{common,staging,...}.json
│   │   └── uk/{common,staging,...}.json
│   ├── styles/
│   │   └── globals.css              # @theme tokens + body / scrollbar
│   └── components/
│       ├── layout/{Shell,Titlebar,Sidebar,Footer}.tsx
│       ├── welcome/WelcomeScreen.tsx
│       ├── staging/{ChangesSection,FileList,CommitForm}.tsx
│       ├── diff/{DiffViewer,parse-diff}.{tsx,ts}
│       ├── history/{HistoryView,CommitList}.tsx
│       ├── graph/{CommitGraph,graph-layout}.{tsx,ts}
│       ├── merge/{MergeEditor,MergeConflictModal}.tsx
│       ├── dropdowns/{BranchDropdown,RepoDropdown}.tsx
│       ├── modals/{CheckoutModal,CredentialModal}.tsx  # orphaned
│       └── common/{Accordion,Toast}.tsx
├── tests/                           # Vitest
│   ├── git-service.test.ts          # Real Git integration tests
│   ├── graph-layout.test.ts         # Pure unit tests
│   ├── parse-diff.test.ts           # Pure unit tests
│   └── stores/
│       ├── repo-store.test.ts       # Store with mocked gitApi
│       └── ui-store.test.ts         # Plain store tests
├── dist/                            # Vite build output (renderer)
├── dist-electron/                   # tsc output (main process)
├── package.json                     # Scripts + deps
├── tsconfig.json                    # Type-check for editor + Vite
├── tsconfig.node.json               # Emit CJS for electron/
├── vite.config.ts                   # Vite + Tailwind plugins
├── vitest.config.ts                 # Test runner config
├── tailwind.config.ts               # Legacy v3 config (Tailwind v4 ignores it; kept for reference)
├── electron-builder.yml             # Packaging config
├── AUDIT.md                         # Bug audit (P0–P2 catalog + fixes)
└── ARCHITECTURE.md                  # This file
```

---

## 15. Adding a new feature — checklist

Want to add, say, a "create branch" feature?

1. **Backend.** Add `createBranch(name: string)` to `GitService` → `git.checkoutBranch(name, 'HEAD')`.
2. **IPC.** Register `'git:create-branch'` in `ipc-handlers.ts`.
3. **API.** Add `createBranch: (name: string) => invoke<null>('git:create-branch', name)` to `git-api.ts`.
4. **Store.** Add `createBranch: async (name) => { await gitApi.createBranch(name); await get().loadBranches(); }` to `repo-store.ts`.
5. **UI.** Add an input + button in `BranchDropdown.tsx` (or a new modal) that calls the store action.
6. **Test.** Add `it('createBranch creates and switches', ...)` to `tests/git-service.test.ts` (real Git) and optionally a store test.

That's the four-step ritual referenced in §4 plus UI and tests.

---

End of document. For known bugs and their planned fixes, see `AUDIT.md`. For the current branch's work-in-progress notes, run `git log` — this file does not duplicate transient state.
