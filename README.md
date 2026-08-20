# Git Desktop

[![CI](https://github.com/MykhailoBovtriuk/git-desktop/actions/workflows/ci.yml/badge.svg)](https://github.com/MykhailoBovtriuk/git-desktop/actions/workflows/ci.yml) [![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](LICENSE)

A cross-platform Git desktop client with a visual commit graph, side-by-side conflict resolution, and a polished UI for everyday Git workflows.

> Built with Electron · React 19 · TypeScript · Vite · Zustand · Tailwind v4 · simple-git

---

## 📦 For Users — Install the app

**[⬇ Download page](https://mykhailobovtriuk.github.io/git-desktop/)** — picks the right file for your OS. Or grab any build straight from [Releases](https://github.com/MykhailoBovtriuk/git-desktop/releases).

### Requirements

- **Git must be installed on your system** and available in your `PATH`.
  - macOS: `brew install git`
  - Windows: [git-scm.com/download/win](https://git-scm.com/download/win)
  - Linux: `sudo apt install git` (Ubuntu/Debian) or your distro's equivalent

### macOS

#### Apple Silicon (M1 / M2 / M3 / M4)

1. Download **`Git-Desktop-arm64.dmg`** from [Releases](https://github.com/MykhailoBovtriuk/git-desktop/releases).
2. Double-click the `.dmg` file to mount it.
3. Drag **Git Desktop.app** into the **Applications** folder.
4. Eject the disk image (right-click → Eject).
5. Open the app from **Launchpad** or **Spotlight** (`⌘ + Space` → "Git Desktop").

#### Intel Macs

Same steps as above, but download **`Git-Desktop-x64.dmg`** instead.

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

1. Download the installer for your CPU from [Releases](https://github.com/MykhailoBovtriuk/git-desktop/releases):
   - **`Git-Desktop-Setup-x64.exe`** — regular 64-bit PCs
   - **`Git-Desktop-Setup-arm64.exe`** — Windows on ARM (Snapdragon, Surface Pro X)
   - **`Git-Desktop-Setup-ia32.exe`** — legacy 32-bit Windows 10
2. Run the installer and follow the wizard — you can choose the install folder.
3. Launch **Git Desktop** from the Start menu or the desktop shortcut.

> Installs per user, so no administrator rights are required.

> **⚠️ Windows SmartScreen warning on first launch**
>
> SmartScreen will say *"Windows protected your PC"* because the installer isn't code-signed.
>
> 1. Click **More info**.
> 2. Click **Run anyway**.

---

### Linux

**AppImage** — works on any distro, no installation:

```bash
chmod +x git-desktop-x86_64.AppImage
./git-desktop-x86_64.AppImage
```

> To integrate an AppImage with your app menu, use a tool like [AppImageLauncher](https://github.com/TheAssassin/AppImageLauncher).

**Debian / Ubuntu** — installs with a menu entry:

```bash
sudo dpkg -i git-desktop-amd64.deb
```

`arm64` builds of both formats are published alongside the x64 ones.

---

## 🛠 For Developers — Build from source

### Prerequisites

You'll need:

- **Node.js 20+** — [nodejs.org](https://nodejs.org) (or via [nvm](https://github.com/nvm-sh/nvm)); CI builds and tests on Node 22
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
| macOS Apple Silicon | `release/Git-Desktop-arm64.dmg` | ~110 MB |
| macOS Intel | `release/Git-Desktop-x64.dmg` | ~115 MB |
| Windows | `release/Git-Desktop-Setup-x64.exe` | ~95 MB |
| Linux | `release/git-desktop-x86_64.AppImage` | ~130 MB |

Artifact names deliberately carry **no version number** — that keeps
`releases/latest/download/<name>` URLs valid across releases, so the download
page never needs editing.

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

#### Releasing all platforms — GitHub Actions

Cross-building Windows installers **does not work from macOS**: electron-builder
writes the icon and version info into the `.exe` with ResourceHacker under Wine,
and the bundled Wine is 32-bit — which modern macOS cannot execute at all.

So releases are built in CI instead, one runner per OS
([`.github/workflows/release.yml`](.github/workflows/release.yml)):

```bash
# Publish a release with all 9 artifacts attached
npm version patch        # or edit package.json
git push --follow-tags
```

Pushing a `v*` tag builds Windows (x64 / arm64 / ia32), macOS (x64 / arm64) and
Linux (AppImage + deb, x64 / arm64), then attaches everything to a GitHub
Release. The workflow can also be run manually from the **Actions** tab, which
leaves the installers as run artifacts without publishing a release.

The download page at
[mykhailobovtriuk.github.io/git-desktop](https://mykhailobovtriuk.github.io/git-desktop/)
lives in [`site/`](site/) and deploys via
[`.github/workflows/pages.yml`](.github/workflows/pages.yml). It reads the
latest release from the GitHub API, so it needs no changes when you ship.

> Builds are **unsigned**: Windows shows a SmartScreen prompt and macOS a
> Gatekeeper prompt on first launch. Removing those needs paid certificates
> (an OV/EV cert for Windows, an Apple Developer ID plus notarization for macOS)
> wired in through `win.certificateFile` / `CSC_LINK` GitHub secrets.

---

### Project structure

```
git-desktop/
├── electron/                    # Main process (Node.js + Electron APIs)
│   ├── main.ts                  # App entry, window creation
│   ├── preload.ts               # Secure IPC bridge to renderer
│   ├── ipc-handlers.ts          # All git:* IPC channels
│   ├── repo-watcher.ts          # fs.watch on the repo → emits git-changed events
│   └── git-service.ts           # simple-git wrapper, owns repo state
├── src/                         # Renderer process (React + browser APIs)
│   ├── main.tsx                 # React root
│   ├── App.tsx                  # Auto-refresh + auto-reopen last repo
│   ├── types.ts                 # Shared types (used by main + renderer)
│   ├── api/git-api.ts           # Typed IPC wrapper
│   ├── stores/                  # Zustand state (repo-store, ui-store)
│   ├── hooks/                   # use-auto-refresh
│   ├── lib/                     # relative-time util
│   ├── i18n/                    # i18next setup (EN, UK) — active
│   ├── styles/globals.css       # Tailwind v4 @theme tokens
│   └── components/              # All React UI
│       ├── layout/              # Shell, Titlebar, Sidebar, Footer
│       ├── welcome/             # First-launch screen
│       ├── staging/             # File list, commit form, hunk staging
│       ├── diff/                # Diff viewer, unified-diff parser, Shiki highlighter
│       ├── history/             # Virtualized commit list, commit details
│       ├── graph/               # SVG commit graph + lane layout
│       ├── merge/               # 3-panel merge editor, conflict modal
│       ├── checkout/            # Checkout conflict modal
│       ├── rebase/              # Rebase conflict banner
│       ├── stash/               # Stash list, form, section, diff preview
│       ├── dropdowns/           # Branch picker, repo picker
│       └── common/              # Accordion, Toast
├── tests/                       # Vitest test suite
├── site/                        # Download page (GitHub Pages, static HTML)
├── build/                       # App icon assets (svg / png / icns)
├── dist/                        # Vite renderer build output (auto-gen)
├── dist-electron/               # Compiled main process (auto-gen)
├── release/                     # electron-builder output (auto-gen)
├── ARCHITECTURE.md              # Deep dive: how the code is organized
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

- **Changes view** — staged / unstaged files with status badges, selective staging down to individual **hunks**, discard, commit with `Cmd / Ctrl + Enter`
- **History view** — searchable, **virtualized** commit list (stays fast on large repos) with per-file diffs, including the very first commit (no-parent diff against empty tree)
- **Syntax-highlighted diffs** — powered by [Shiki](https://shiki.style/), with language auto-detection from file extension
- **Commit graph** — SVG visualization of branch topology with colored lanes
- **Branch management** — checkout, merge, rebase, delete via a searchable dropdown; confirmation prompt before delete
- **3-panel merge editor** — CURRENT / RESULT / INCOMING panes reading real conflict sides from the Git index (`:2:path`, `:3:path`), "Use this" buttons, write-back to disk before marking resolved
- **Untracked file diff** — synthesized against `/dev/null` so new files actually render content (instead of empty diff like raw `git diff`)
- **Stash** — stash staged changes, browse/apply/pop/drop the stash list, preview stash diffs
- **Localization** — English and Ukrainian, auto-detected from the browser and remembered across restarts
- **Auto-refresh** — event-driven via `fs.watch` (debounced 300 ms), so external `git` activity shows up almost instantly; a 60-second poll acts as a safety-net fallback
- **Persistent state** — remembers last-opened repo and the recent repos list across restarts
- **Catppuccin Mocha** dark palette out of the box

---

## 📚 Deeper documentation

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** — Full architectural breakdown: process model, layered renderer, IPC contract, design system, edge cases handled, build workflow.

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
