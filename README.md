# Git Desktop

A cross-platform Git desktop client with a visual commit graph, side-by-side conflict resolution, and a polished UI for everyday Git workflows.

> Built with Electron · React 19 · TypeScript · Vite · Zustand · Tailwind v4 · simple-git

---

## 📦 For Users — Install the app

### Requirements

- **Git must be installed on your system** and available in your `PATH`.
  - macOS: `brew install git`
  - Windows: [git-scm.com/download/win](https://git-scm.com/download/win)
  - Linux: `sudo apt install git` (Ubuntu/Debian) or your distro's equivalent

### macOS

#### Apple Silicon (M1 / M2 / M3 / M4)

1. Download **`Git Desktop-1.0.0-arm64.dmg`** from [Releases](https://github.com/MykhailoBovtriuk/git-desktop/releases).
2. Double-click the `.dmg` file to mount it.
3. Drag **Git Desktop.app** into the **Applications** folder.
4. Eject the disk image (right-click → Eject).
5. Open the app from **Launchpad** or **Spotlight** (`⌘ + Space` → "Git Desktop").

#### Intel Macs

Same steps as above, but download **`Git Desktop-1.0.0-x64.dmg`** instead.

> **⚠️ "App is from an unidentified developer" warning on first launch**
>
> Because the app is not code-signed with a paid Apple Developer certificate, macOS will block the first launch. To bypass it:
>
> 1. **Right-click** (or Control + click) **Git Desktop.app** in the Applications folder.
> 2. Choose **Open** from the context menu.
> 3. In the dialog, click **Open** again.
>
> You only need to do this **once** — subsequent launches work normally from Launchpad.

---

### Windows 10 / 11

1. Download **`Git Desktop-1.0.0-x64.zip`** from [Releases](https://github.com/MykhailoBovtriuk/git-desktop/releases).
2. Right-click the zip → **Extract All** → choose a folder like `C:\Program Files\Git Desktop` (or anywhere convenient).
3. Open the extracted folder and double-click **`Git Desktop.exe`**.
4. Optional: pin to taskbar — right-click the running app icon in the taskbar → **Pin to taskbar**.

> **⚠️ Windows SmartScreen warning on first launch**
>
> SmartScreen will say *"Windows protected your PC"* because the executable isn't code-signed.
>
> 1. Click **More info**.
> 2. Click **Run anyway**.

---

### Linux

1. Download **`Git Desktop-1.0.0-x86_64.AppImage`** from [Releases](https://github.com/MykhailoBovtriuk/git-desktop/releases).
2. Make it executable:
   ```bash
   chmod +x "Git Desktop-1.0.0-x86_64.AppImage"
   ```
3. Run it:
   ```bash
   ./"Git Desktop-1.0.0-x86_64.AppImage"
   ```

> AppImages are self-contained — no installation needed. To integrate with your app menu, use a tool like [AppImageLauncher](https://github.com/TheAssassin/AppImageLauncher).

---

## 🛠 For Developers — Build from source

### Prerequisites

You'll need:

- **Node.js 20+** — [nodejs.org](https://nodejs.org) (or via [nvm](https://github.com/nvm-sh/nvm))
- **npm** (comes with Node)
- **Git** — [git-scm.com](https://git-scm.com/)
- **Platform-specific tools** for packaging (see [Build per platform](#build-per-platform) below)

### Clone and install

```bash
git clone https://github.com/MykhailoBovtriuk/git-desktop.git
cd git-desktop
npm install
```

### Run in development mode

```bash
npm run dev:electron
```

This:
- Starts Vite dev server on `http://localhost:5173` with **hot module reload** for the renderer
- Compiles the Electron main process via `tsc`
- Launches the Electron window
- Opens DevTools in a detached window for debugging

Changes to files in `src/` reload instantly. Changes to files in `electron/` (main process) require restarting the command.

### Run tests

```bash
npm test              # one-shot vitest run
npm run test:watch    # watch mode
```

Tests cover:
- `GitService` with a real Git repo (creates a temp dir + actual `git init`)
- Diff parser
- Commit graph layout
- Zustand stores

---

### Build per platform

The script `npm run build:electron` produces a distributable installer for **your current platform** (auto-detected).

```bash
npm run build:electron
```

Output goes to **`release/`**:

| Platform | Output file | Size (approx) |
|---|---|---|
| macOS Apple Silicon | `release/Git Desktop-1.0.0-arm64.dmg` | ~110 MB |
| macOS Intel | `release/Git Desktop-1.0.0-x64.dmg` | ~115 MB |
| Windows | `release/Git Desktop-1.0.0-x64.zip` | ~620 MB |
| Linux | `release/Git Desktop-1.0.0-x86_64.AppImage` | ~130 MB |

#### Building for a specific platform / architecture

```bash
# macOS — both architectures
npm run build:electron -- --mac --arm64
npm run build:electron -- --mac --x64

# Windows
npm run build:electron -- --win --x64

# Linux
npm run build:electron -- --linux --x64
```

#### Cross-platform building (build for OS X from OS Y)

| Building on... | macOS DMG | Windows ZIP | Windows EXE installer | Linux AppImage |
|---|:---:|:---:|:---:|:---:|
| **macOS** | ✅ | ✅ | ⚠️ needs [Wine](https://www.winehq.org/) | ✅ |
| **Windows** | ❌ | ✅ | ✅ | ✅ via WSL |
| **Linux** | ❌ | ✅ | ⚠️ needs Wine | ✅ |

> **For a proper NSIS Windows installer (`.exe`) from macOS:**
>
> ```bash
> brew install --cask wine-stable
> # change `target: zip` to `target: nsis` in electron-builder.yml
> npm run build:electron -- --win
> ```
>
> The default config uses `zip` for Windows because it doesn't require Wine.

---

### Project structure

```
git-desktop/
├── electron/                    # Main process (Node.js + Electron APIs)
│   ├── main.ts                  # App entry, window creation
│   ├── preload.ts               # Secure IPC bridge to renderer
│   ├── ipc-handlers.ts          # All git:* IPC channels
│   └── git-service.ts           # simple-git wrapper, owns repo state
├── src/                         # Renderer process (React + browser APIs)
│   ├── main.tsx                 # React root
│   ├── App.tsx                  # Auto-refresh + auto-reopen last repo
│   ├── types.ts                 # Shared types (used by main + renderer)
│   ├── api/git-api.ts           # Typed IPC wrapper
│   ├── stores/                  # Zustand state (repo-store, ui-store)
│   ├── hooks/                   # use-auto-refresh
│   ├── lib/                     # relative-time util
│   ├── i18n/                    # i18next setup (EN, UK) — scaffolded
│   ├── styles/globals.css       # Tailwind v4 @theme tokens
│   └── components/              # All React UI
│       ├── layout/              # Shell, Titlebar, Sidebar, Footer
│       ├── welcome/             # First-launch screen
│       ├── staging/             # File list, commit form
│       ├── diff/                # Diff viewer, unified-diff parser
│       ├── history/             # Commit list, commit details
│       ├── graph/               # SVG commit graph + lane layout
│       ├── merge/               # 3-panel merge editor, conflict modal
│       ├── dropdowns/           # Branch picker, repo picker
│       └── common/              # Accordion, Toast
├── tests/                       # Vitest test suite
├── build/                       # App icon assets (svg / png / icns)
├── dist/                        # Vite renderer build output (auto-gen)
├── dist-electron/               # Compiled main process (auto-gen)
├── release/                     # electron-builder output (auto-gen)
├── ARCHITECTURE.md              # Deep dive: how the code is organized
├── AUDIT.md                     # Known bugs and planned fixes
├── electron-builder.yml         # Packaging config
├── vite.config.ts               # Vite + Tailwind plugins
├── vitest.config.ts             # Test runner config
├── tsconfig.json                # TS for editor + Vite (no emit)
└── tsconfig.node.json           # TS for main process (CJS, emits to dist-electron/)
```

### Available npm scripts

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server only (no Electron — useful for renderer-only iteration in a browser) |
| `npm run dev:electron` | Full dev — Vite + Electron with HMR + DevTools |
| `npm run build` | Type-check + build renderer (Vite) + compile main process (tsc) |
| `npm run build:electron` | Run `build`, then package via electron-builder |
| `npm test` | Run all tests once |
| `npm run test:watch` | Run tests in watch mode |

---

## ✨ Features

- **Changes view** — staged / unstaged files with status badges, selective staging, discard, commit with `Cmd / Ctrl + Enter`
- **History view** — searchable commit list with per-file diffs, including the very first commit (no-parent diff against empty tree)
- **Commit graph** — SVG visualization of branch topology with colored lanes
- **Branch management** — checkout, merge, rebase, delete via a searchable dropdown; confirmation prompt before delete
- **3-panel merge editor** — CURRENT / RESULT / INCOMING panes reading real conflict sides from the Git index (`:2:path`, `:3:path`), "Use this" buttons, write-back to disk before marking resolved
- **Untracked file diff** — synthesized against `/dev/null` so new files actually render content (instead of empty diff like raw `git diff`)
- **Auto-refresh** — picks up external `git` activity every 30 seconds
- **Persistent state** — remembers last-opened repo and the recent repos list across restarts
- **Catppuccin Mocha** dark palette out of the box

---

## 📚 Deeper documentation

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** — Full architectural breakdown: process model, layered renderer, IPC contract, design system, edge cases handled, build workflow.
- **[AUDIT.md](./AUDIT.md)** — Catalog of bugs found and planned fixes (P0 / P1 / P2 with concrete patches).

---

## 🤝 Contributing

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/my-improvement`)
3. Make your changes, add tests, ensure `npm test` and `npx tsc --noEmit` pass
4. Commit and open a pull request

See [ARCHITECTURE.md → §15 Adding a new feature](./ARCHITECTURE.md) for the four-step ritual when adding a new Git operation (backend → IPC → API → store → UI).

---

## 📜 License

ISC
