import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { RepoWatcher } from '../electron/repo-watcher';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// Wait until `predicate` holds or the timeout elapses. fs.watch is inherently
// async and platform-timed, so these tests poll rather than assume a fixed lag.
const waitFor = async (predicate: () => boolean, timeout = 2000) => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (predicate()) return true;
    await sleep(25);
  }
  return predicate();
};

let tmp: string;
let watcher: RepoWatcher | null;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-watcher-'));
  fs.mkdirSync(path.join(tmp, '.git', 'refs', 'heads'), { recursive: true });
  fs.writeFileSync(path.join(tmp, '.git', 'HEAD'), 'ref: refs/heads/main\n');
  watcher = null;
});

afterEach(() => {
  watcher?.close();
  fs.rmSync(tmp, { recursive: true, force: true });
});

// Attach the watcher, then let the OS drain any startup events it emits for the
// just-created .git dir (macOS FSEvents replays recent activity on attach) and
// clear the spy — so each test observes only the change it makes next.
const arm = async (root: string, onChange: ReturnType<typeof vi.fn>) => {
  watcher!.watch(root);
  await sleep(450); // > DEBOUNCE_MS, so any startup-triggered callback lands
  onChange.mockClear();
};

describe('RepoWatcher', () => {
  it('fires when a top-level .git file (index) changes', async () => {
    const onChange = vi.fn();
    watcher = new RepoWatcher(onChange);
    await arm(tmp, onChange);

    fs.writeFileSync(path.join(tmp, '.git', 'index'), 'x');
    expect(await waitFor(() => onChange.mock.calls.length > 0)).toBe(true);
  });

  it('fires when a loose ref under refs/ changes', async () => {
    const onChange = vi.fn();
    watcher = new RepoWatcher(onChange);
    await arm(tmp, onChange);

    fs.writeFileSync(path.join(tmp, '.git', 'refs', 'heads', 'main'), 'abc123\n');
    expect(await waitFor(() => onChange.mock.calls.length > 0)).toBe(true);
  });

  it('ignores .lock churn', async () => {
    const onChange = vi.fn();
    watcher = new RepoWatcher(onChange);
    await arm(tmp, onChange);

    fs.writeFileSync(path.join(tmp, '.git', 'index.lock'), '');
    // Give it well past the debounce window; a .lock write must not refresh.
    await sleep(500);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('coalesces a burst of changes into a single callback (debounced)', async () => {
    const onChange = vi.fn();
    watcher = new RepoWatcher(onChange);
    await arm(tmp, onChange);

    for (let i = 0; i < 5; i++) {
      fs.writeFileSync(path.join(tmp, '.git', 'index'), `x${i}`);
    }
    await waitFor(() => onChange.mock.calls.length > 0);
    await sleep(400); // ensure the debounce settled and nothing else fired
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('stops firing after close()', async () => {
    const onChange = vi.fn();
    watcher = new RepoWatcher(onChange);
    await arm(tmp, onChange);
    watcher.close();

    fs.writeFileSync(path.join(tmp, '.git', 'index'), 'after-close');
    await sleep(500);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('does nothing when .git is absent', () => {
    const onChange = vi.fn();
    watcher = new RepoWatcher(onChange);
    // Point at a dir with no .git — must not throw.
    const bare = fs.mkdtempSync(path.join(os.tmpdir(), 'no-git-'));
    expect(() => watcher!.watch(bare)).not.toThrow();
    fs.rmSync(bare, { recursive: true, force: true });
  });

  it('re-points cleanly when watch() is called again', async () => {
    const onChange = vi.fn();
    watcher = new RepoWatcher(onChange);
    await arm(tmp, onChange);

    // Second repo; watch() should drop the first watcher and follow the new one.
    const tmp2 = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-watcher2-'));
    fs.mkdirSync(path.join(tmp2, '.git', 'refs'), { recursive: true });
    fs.writeFileSync(path.join(tmp2, '.git', 'HEAD'), 'ref: refs/heads/main\n');
    await arm(tmp2, onChange);

    fs.writeFileSync(path.join(tmp2, '.git', 'index'), 'y');
    expect(await waitFor(() => onChange.mock.calls.length > 0)).toBe(true);
    fs.rmSync(tmp2, { recursive: true, force: true });
  });
});
