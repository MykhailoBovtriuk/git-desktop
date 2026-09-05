# How to use Git Desktop

A practical guide to everyday work in the app. It assumes Git is installed and
you have used version control at least a little; for installation see the
[README](./README.md).

---

## 1. First launch

The welcome screen has one action: **Open Repository**. Point it at a folder
that is already a Git repository (it contains a `.git` directory).

- Opening a folder that is *not* a repository shows an error toast and nothing
  breaks — pick another folder.
- The app does **not** create or clone repositories yet. Run `git init` or
  `git clone` in a terminal first, then open the folder.
- The last opened repository reopens automatically on the next launch. Recent
  repositories are listed on the welcome screen and in the repository dropdown
  (top-right corner of the titlebar).

## 2. Who you commit as (identity)

Git refuses to commit without an author (`user.name` / `user.email`). The app
checks this per repository and disables the **Commit** button with an
explanation when identity is missing.

Identity comes from your normal git config — global (`~/.gitconfig`) or local
to the repository. When you sign in to a hosting service (below) and your
global identity is empty, the app fills it in from the account once; it never
overwrites values you have already set.

## 3. Signing in (authentication)

When you open a repository whose remote points at a host you are not signed in
to, the app offers to sign in right away. You can dismiss it — the offer also
lives behind the **Sign in** link in the footer and under **Settings →
Accounts → Add account**.

- **GitHub, GitLab, Azure DevOps, Bitbucket, Gitea/Forgejo/Codeberg** — the
  sign-in opens your browser; after you approve, the browser redirects back to
  the app. The token is encrypted with the OS keychain and handed to git's
  credential store, so `push`/`pull`/`fetch` from then on just work — both in
  the app and in your terminal.
- **Self-hosted instances** (GitHub Enterprise, self-managed GitLab, Gitea) —
  same flow, but you provide the server address (and, where the platform
  requires it, an OAuth client id registered on that server).
- **Any other server** — paste a username and a personal access token; the
  "Where do I get a token?" link opens the right settings page for known
  hosts.

Accounts are **per host**: github.com, a work GitLab and Azure DevOps can be
signed in at the same time, and signing out of one does not touch the others.
When one host has several accounts, each repository remembers which account it
uses — the footer shows it (`@login`), and clicking the name lets you switch.

Tokens that expire (GitLab, Bitbucket, Azure) are refreshed automatically
before network operations. On Linux without a keyring, tokens live only for
the session — the Accounts screen says so explicitly.

If a push fails with an authentication error, the toast carries a **Sign in**
button aimed at the right server.

## 4. The everyday cycle

1. Edit files. Changes appear in the **Changes** section (see [§8](#8-when-the-app-notices-changes)
   for *when* they appear).
2. Stage: hover a file for its stage/discard icons, use **Stage All**, or open
   the file's diff and stage individual **hunks** with the button in the hunk
   header.
3. Type a commit message (a character counter sits in the corner) and press
   **Commit** or `Cmd/Ctrl + Enter`.
4. **Push** from the footer. A branch that has no upstream yet fails with a
   toast offering **Publish branch** — one click sets the upstream and pushes.

The footer always shows the commit HEAD points at, ahead/behind counters when
the branch diverges from its upstream, and Fetch / Pull / Push.

## 5. Branches

The branch dropdown sits in the titlebar: search, switch, and a **⋯** menu per
branch with Checkout, Merge into current, Rebase onto current, and Delete
(with a confirmation; force-delete is offered when the branch is not fully
merged).

Switching branches with uncommitted changes that would be overwritten opens a
dialog with three honest options:

- **Stash & Checkout** — puts the changes aside; pick them up from the Stash
  section later.
- **Migrate Changes** — carries the working tree onto the target branch
  (may itself conflict).
- **Force Checkout** — discards your changes and switches anyway.

## 6. Merge conflicts

A merge that conflicts opens the **Merge Conflict** dialog listing the files.
**Resolve Conflicts** opens the three-pane editor: CURRENT (yours), RESULT,
INCOMING (theirs) — the sides come from the real Git index, not a text parse.
Pick a side per conflict (**Use this**) or edit the result directly, then mark
the file resolved. When every file is done the merge commit is created —
automatically if **Auto-commit** is on, otherwise from the Changes view, where
the merge message is pre-filled. **Abort Merge** returns everything to the
pre-merge state.

## 7. Stash

The **Stash** section in the sidebar has two modes (toggle: **List**):

- **Create** — stage what you want to put aside, add a message, **Stash staged
  changes**. Staging first is deliberate: it lets you stash a subset.
- **List** — every stash with its branch and age; **Apply** (keep the stash),
  **Pop** (apply and drop), **Drop** (with confirmation), and a diff preview
  per file.

## 8. When the app notices changes

Two mechanisms feed the UI:

- **Git operations** — commits, checkouts, stashes, fetches, whether made in
  the app or in a terminal — are picked up within a second via a watcher on
  `.git`.
- **Plain file edits** are noticed by a poll, configurable in Settings
  (10 / 30 / 60 seconds, or Off). With **Off**, file edits show up only when
  you press the refresh button in the titlebar or perform a git action.

## 9. Settings and appearance

**Settings** (gear icon, bottom-left): theme (Light / Dark / System — Latte
and Mocha from the Catppuccin palette), interface language (English /
Українська), auto-refresh interval, and the signed-in accounts list. Language
and theme persist across restarts.

## 10. What is not there (yet)

- `git init` / `git clone` — open existing repositories only
- Interactive rebase (`rebase -i`), cherry-pick, tag management
- Editing the remote list (the app reads `origin` as configured)

When one of these is what you need, the terminal remains the tool — the app
notices whatever you do there and stays in sync.
