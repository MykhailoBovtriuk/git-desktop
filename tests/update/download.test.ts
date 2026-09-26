import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { downloadFile, versionedFileName } from '../../electron/update/download';

const URL_BASE = 'https://github.com/MykhailoBovtriuk/git-desktop/releases/download/v1.2.0';

const bodyOf = (chunks: Uint8Array[]) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });

const response = (chunks: Uint8Array[], headers: Record<string, string> = {}) => ({
  ok: true,
  status: 200,
  headers: new Headers(headers),
  body: bodyOf(chunks),
});

let dir: string;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'git-desktop-update-'));
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await fs.rm(dir, { recursive: true, force: true });
});

const run = (overrides: Partial<Parameters<typeof downloadFile>[0]> = {}) =>
  downloadFile({
    url: `${URL_BASE}/Git-Desktop-arm64.dmg`,
    expectedSize: 6,
    targetPath: path.join(dir, 'Git-Desktop-arm64-1.2.0.dmg'),
    onProgress: () => {},
    signal: new AbortController().signal,
    ...overrides,
  });

describe('versionedFileName', () => {
  it('splices the version in before the extension', () => {
    expect(versionedFileName('Git-Desktop-arm64.dmg', '1.2.0')).toBe(
      'Git-Desktop-arm64-1.2.0.dmg',
    );
    expect(versionedFileName('Git-Desktop-Setup-x64.exe', '1.2.0')).toBe(
      'Git-Desktop-Setup-x64-1.2.0.exe',
    );
    expect(versionedFileName('git-desktop-x86_64.AppImage', '1.2.0')).toBe(
      'git-desktop-x86_64-1.2.0.AppImage',
    );
  });
});

describe('downloadFile', () => {
  it('refuses a URL that is not on this project release path', async () => {
    await expect(run({ url: 'https://evil.example/Git-Desktop-arm64.dmg' })).rejects.toThrow(
      /Refusing to download/,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('writes the file and reports progress that ends at the full size', async () => {
    fetchMock.mockResolvedValue(
      response([new Uint8Array([1, 2, 3]), new Uint8Array([4, 5, 6])], {
        'content-length': '6',
      }),
    );
    const seen: [number, number][] = [];

    await run({ onProgress: (received, total) => seen.push([received, total]) });

    const written = await fs.readFile(path.join(dir, 'Git-Desktop-arm64-1.2.0.dmg'));
    expect([...written]).toEqual([1, 2, 3, 4, 5, 6]);
    // The first chunk reports immediately; the last call is the completed one.
    expect(seen[0][0]).toBe(3);
    expect(seen[seen.length - 1]).toEqual([6, 6]);
  });

  // TLS aside, the size from the release metadata is the only corroboration a
  // download gets — a truncated body that ends cleanly must not be installed.
  it('rejects a body that does not match the published size', async () => {
    fetchMock.mockResolvedValue(response([new Uint8Array([1, 2])]));

    await expect(run()).rejects.toThrow(/Downloaded 2 bytes, expected 6/);
    expect(await fs.readdir(dir)).toEqual([]);
  });

  it('leaves nothing behind when the server answers with an error', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404, headers: new Headers(), body: null });

    await expect(run()).rejects.toThrow(/returned 404/);
    expect(await fs.readdir(dir)).toEqual([]);
  });

  it('falls back to the published size when the server declares none', async () => {
    fetchMock.mockResolvedValue(response([new Uint8Array([1, 2, 3, 4, 5, 6])]));
    const totals: number[] = [];

    await run({ onProgress: (_received, total) => totals.push(total) });

    expect(totals[0]).toBe(6);
  });
});
