import { getJson, OAuthError } from '../auth/http';
import { compareSemver, parseSemver, type SemVer } from './semver';
import { assetNameFor, isAllowedDownloadUrl, type LinuxPackage } from './assets';
import type { UpdateInfo } from '../../src/types';

/**
 * The releases of this project, as the update check sees them.
 *
 * The list endpoint rather than /releases/latest: only a list can honour the
 * pre-release preference, and only a list can find the release matching the
 * running version, which is what "reinstall" needs.
 */
const RELEASES_URL = 'https://api.github.com/repos/MykhailoBovtriuk/git-desktop/releases?per_page=20';
const ACCEPT = 'application/vnd.github+json';

/** Anonymous GitHub allows 60 requests an hour per IP — shared behind a NAT. */
const CACHE_TTL_MS = 10 * 60_000;
/** A floor even a deliberate "check now" respects, against a leaning finger. */
const MIN_INTERVAL_MS = 30_000;
/** Blind backoff when a rate-limited response does not say when it lifts. */
const RATE_LIMIT_BACKOFF_MS = 10 * 60_000;
/** Release notes are shown in a modal, not read in full. */
const NOTES_LIMIT = 4_000;

/**
 * Why a check failed, in a form the renderer can translate.
 *
 * The IPC envelope carries only a message string, so the reason *is* the
 * message: the store maps 'offline' and 'rate-limited' onto their own wording
 * and shows anything else as it came.
 */
export type UpdateErrorReason = 'offline' | 'rate-limited' | 'failed';

export class UpdateError extends Error {
  constructor(readonly reason: UpdateErrorReason, message?: string) {
    super(message ?? reason);
  }
}

interface GithubAsset {
  name: string;
  size: number;
  browser_download_url: string;
}

interface GithubRelease {
  tag_name: string;
  draft: boolean;
  prerelease: boolean;
  body: string | null;
  published_at: string | null;
  html_url: string;
  assets: GithubAsset[];
}

let cache: { at: number; releases: GithubRelease[] } | null = null;
let inFlight: Promise<GithubRelease[]> | null = null;
let rateLimitedUntil = 0;

/** Tests only: the module state above outlives a single check by design. */
export function resetReleaseCache(): void {
  cache = null;
  inFlight = null;
  rateLimitedUntil = 0;
}

function toUpdateError(err: unknown): UpdateError {
  if (err instanceof UpdateError) return err;

  if (err instanceof OAuthError) {
    const exhausted = err.headers?.get('x-ratelimit-remaining') === '0';
    if (err.status === 429 || (err.status === 403 && exhausted)) {
      const reset = Number(err.headers?.get('x-ratelimit-reset'));
      rateLimitedUntil =
        Number.isFinite(reset) && reset > 0 ? reset * 1_000 : Date.now() + RATE_LIMIT_BACKOFF_MS;
      return new UpdateError('rate-limited');
    }
    return new UpdateError('failed', err.message);
  }

  // Undici rejects with a TypeError when the request never left the machine —
  // no DNS, no route, no network. That is not a failure worth a red banner.
  if (err instanceof TypeError) return new UpdateError('offline');
  return new UpdateError('failed', err instanceof Error ? err.message : String(err));
}

async function fetchReleases(force: boolean): Promise<GithubRelease[]> {
  const now = Date.now();
  const ttl = force ? MIN_INTERVAL_MS : CACHE_TTL_MS;
  if (cache && now - cache.at < ttl) return cache.releases;

  // Being rate limited is not a reason to forget what we already know.
  if (now < rateLimitedUntil) {
    if (cache) return cache.releases;
    throw new UpdateError('rate-limited');
  }

  // Two windows, or a double click, must not cost two of the sixty requests.
  if (inFlight) return inFlight;

  inFlight = getJson<GithubRelease[]>(RELEASES_URL, null, ACCEPT)
    .then(releases => {
      const list = Array.isArray(releases) ? releases : [];
      cache = { at: Date.now(), releases: list };
      return list;
    })
    .catch((err: unknown) => {
      throw toUpdateError(err);
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

export interface LookupOptions {
  currentVersion: string;
  includePrerelease: boolean;
  force: boolean;
  platform: string;
  arch: string;
  linuxPackage: LinuxPackage;
}

export interface ReleaseLookup {
  /** The highest version published, which may well be the one already running. */
  latest: UpdateInfo | null;
  /** The release the running version came from, or null once it is gone. */
  current: UpdateInfo | null;
  checkedAt: number;
}

function normalizeVersion(tag: string): string {
  return tag.trim().replace(/^v/i, '').split('+')[0];
}

function toUpdateInfo(release: GithubRelease, opts: LookupOptions): UpdateInfo | null {
  // A tag that is not a version cannot be ranked, so it is not a release as
  // far as this check is concerned.
  if (!parseSemver(release.tag_name)) return null;

  const wanted = assetNameFor(opts.platform, opts.arch, opts.linuxPackage);
  const asset = wanted ? release.assets?.find(a => a.name === wanted) : undefined;
  // An asset whose URL is not on this project's release path is treated as no
  // asset at all: the page link still works, and nothing else is downloaded.
  const usable = asset && isAllowedDownloadUrl(asset.browser_download_url) ? asset : undefined;

  return {
    version: normalizeVersion(release.tag_name),
    tag: release.tag_name,
    notes: (release.body ?? '').slice(0, NOTES_LIMIT),
    publishedAt: release.published_at ?? null,
    releaseUrl: release.html_url,
    assetName: usable?.name ?? null,
    assetSize: usable?.size ?? 0,
    prerelease: Boolean(release.prerelease),
  };
}

/**
 * The newest release worth offering, plus the one currently installed.
 *
 * Whether `latest` is actually an update is the caller's question — this only
 * reports what is published. The array is ranked rather than trusted in the
 * order it arrives: GitHub sorts by creation date, so a patch cut from an old
 * branch can land at the top.
 */
export async function lookupReleases(opts: LookupOptions): Promise<ReleaseLookup> {
  const releases = await fetchReleases(opts.force);
  const running = normalizeVersion(opts.currentVersion);

  let latest: { info: UpdateInfo; version: SemVer } | null = null;
  let current: UpdateInfo | null = null;

  for (const release of releases) {
    // Drafts are invisible to anonymous callers anyway; filtering them is free.
    if (release.draft) continue;

    const info = toUpdateInfo(release, opts);
    if (!info) continue;

    // Reinstalling what is running stays possible even when it is a
    // pre-release the user no longer subscribes to.
    if (info.version === running) current = info;

    if (release.prerelease && !opts.includePrerelease) continue;

    const version = parseSemver(info.version);
    if (!version) continue;
    if (!latest || compareSemver(version, latest.version) > 0) latest = { info, version };
  }

  return { latest: latest?.info ?? null, current, checkedAt: cache?.at ?? Date.now() };
}
