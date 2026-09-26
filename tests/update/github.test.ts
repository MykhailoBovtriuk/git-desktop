import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { lookupReleases, resetReleaseCache, UpdateError } from '../../electron/update/github';

const asset = (name: string, size = 1_000) => ({
  name,
  size,
  browser_download_url: `https://github.com/MykhailoBovtriuk/git-desktop/releases/download/v1.2.0/${name}`,
});

const release = (tag: string, extra: Record<string, unknown> = {}) => ({
  tag_name: tag,
  draft: false,
  prerelease: false,
  body: `notes for ${tag}`,
  published_at: '2026-09-06T11:30:12Z',
  html_url: `https://github.com/MykhailoBovtriuk/git-desktop/releases/tag/${tag}`,
  assets: [asset('Git-Desktop-arm64.dmg', 140_906_445), asset('Git-Desktop-Setup-x64.exe')],
  ...extra,
});

const ok = (body: unknown) => ({
  ok: true,
  status: 200,
  headers: new Headers(),
  json: () => Promise.resolve(body),
});

const failure = (status: number, headers: Record<string, string> = {}) => ({
  ok: false,
  status,
  headers: new Headers(headers),
  json: () => Promise.resolve(null),
});

const mac = {
  currentVersion: '1.1.0',
  includePrerelease: false,
  force: false,
  platform: 'darwin',
  arch: 'arm64',
  linuxPackage: 'deb' as const,
};

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  resetReleaseCache();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('lookupReleases', () => {
  it('ranks releases by version, not by the order GitHub returns them', async () => {
    // A patch cut from an old branch is the newest by date and the oldest by
    // version — the reason the array is ranked rather than trusted.
    fetchMock.mockResolvedValue(ok([release('v1.0.3'), release('v1.2.0'), release('v1.1.0')]));

    const { latest } = await lookupReleases(mac);
    expect(latest?.version).toBe('1.2.0');
  });

  it('ignores drafts and tags that are not versions', async () => {
    fetchMock.mockResolvedValue(
      ok([release('nightly'), release('v9.9.9', { draft: true }), release('v1.2.0')]),
    );

    const { latest } = await lookupReleases(mac);
    expect(latest?.version).toBe('1.2.0');
  });

  it('holds pre-releases back until they are asked for', async () => {
    const releases = [release('v1.2.0'), release('v1.3.0-beta.1', { prerelease: true })];
    fetchMock.mockResolvedValue(ok(releases));

    expect((await lookupReleases(mac)).latest?.version).toBe('1.2.0');

    resetReleaseCache();
    fetchMock.mockResolvedValue(ok(releases));
    const opted = await lookupReleases({ ...mac, includePrerelease: true });
    expect(opted.latest?.version).toBe('1.3.0-beta.1');
  });

  it('resolves the asset belonging to this machine, with its size', async () => {
    fetchMock.mockResolvedValue(ok([release('v1.2.0')]));

    const { latest } = await lookupReleases(mac);
    expect(latest?.assetName).toBe('Git-Desktop-arm64.dmg');
    expect(latest?.assetSize).toBe(140_906_445);
    expect(latest?.notes).toBe('notes for v1.2.0');
    expect(latest?.releaseUrl).toBe(
      'https://github.com/MykhailoBovtriuk/git-desktop/releases/tag/v1.2.0',
    );
  });

  it('reports no asset when nothing is built for this machine', async () => {
    fetchMock.mockResolvedValue(ok([release('v1.2.0')]));

    const { latest } = await lookupReleases({ ...mac, platform: 'freebsd', arch: 'x64' });
    expect(latest?.version).toBe('1.2.0');
    expect(latest?.assetName).toBeNull();
    expect(latest?.assetSize).toBe(0);
  });

  // A spoofed response could name our file and point it somewhere else.
  it('refuses an asset whose download URL is off the release path', async () => {
    fetchMock.mockResolvedValue(
      ok([
        release('v1.2.0', {
          assets: [
            {
              name: 'Git-Desktop-arm64.dmg',
              size: 10,
              browser_download_url: 'https://evil.example/Git-Desktop-arm64.dmg',
            },
          ],
        }),
      ]),
    );

    const { latest } = await lookupReleases(mac);
    expect(latest?.assetName).toBeNull();
  });

  it('finds the release the running version came from, pre-release or not', async () => {
    fetchMock.mockResolvedValue(
      ok([release('v1.2.0'), release('v1.1.0-beta.2', { prerelease: true })]),
    );

    const { current } = await lookupReleases({ ...mac, currentVersion: '1.1.0-beta.2' });
    expect(current?.tag).toBe('v1.1.0-beta.2');
  });

  it('leaves current null when no release matches the running version', async () => {
    fetchMock.mockResolvedValue(ok([release('v1.1.0')]));

    // The normal state between a version bump and its release.
    const { current, latest } = await lookupReleases({ ...mac, currentVersion: '1.2.0' });
    expect(current).toBeNull();
    expect(latest?.version).toBe('1.1.0');
  });
});

describe('rate limiting', () => {
  it('serves a second check from cache instead of spending a request', async () => {
    fetchMock.mockResolvedValue(ok([release('v1.2.0')]));

    await lookupReleases(mac);
    await lookupReleases(mac);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('makes concurrent checks share one request', async () => {
    fetchMock.mockResolvedValue(ok([release('v1.2.0')]));

    await Promise.all([lookupReleases(mac), lookupReleases(mac)]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('holds a forced check to the floor, then lets it through', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-24T12:00:00Z'));
    fetchMock.mockResolvedValue(ok([release('v1.2.0')]));

    await lookupReleases(mac);
    await lookupReleases({ ...mac, force: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.setSystemTime(new Date('2026-09-24T12:01:00Z'));
    await lookupReleases({ ...mac, force: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('stops asking once GitHub says the hour is spent', async () => {
    const reset = Math.floor(Date.now() / 1000) + 600;
    fetchMock.mockResolvedValue(
      failure(403, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(reset) }),
    );

    await expect(lookupReleases(mac)).rejects.toMatchObject({ reason: 'rate-limited' });
    await expect(lookupReleases({ ...mac, force: true })).rejects.toBeInstanceOf(UpdateError);
    // The second call never reached the network.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('treats a plain 403 as a failure, not a rate limit', async () => {
    fetchMock.mockResolvedValue(failure(403));
    await expect(lookupReleases(mac)).rejects.toMatchObject({ reason: 'failed' });
  });

  it('calls a request that never left the machine offline', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    await expect(lookupReleases(mac)).rejects.toMatchObject({ reason: 'offline' });
  });
});
