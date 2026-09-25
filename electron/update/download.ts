import { createWriteStream } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import { Readable, Transform } from 'stream';
import { pipeline } from 'stream/promises';
import { isAllowedDownloadUrl } from './assets';

/** GitHub rejects requests without one, downloads included. */
const USER_AGENT = 'git-desktop';
/** A repaint every fifth of a second reads as smooth and costs nothing. */
const PROGRESS_INTERVAL_MS = 200;

/**
 * The name the installer is saved under.
 *
 * Release assets deliberately carry no version, which keeps their URLs stable
 * but would make two downloads in the Downloads folder indistinguishable — and
 * would collide with whatever the user fetched from the release page by hand.
 */
export function versionedFileName(assetName: string, version: string): string {
  const ext = path.extname(assetName);
  const base = ext ? assetName.slice(0, -ext.length) : assetName;
  return `${base}-${version}${ext}`;
}

export interface DownloadRequest {
  url: string;
  /** From the release metadata; 0 when it was not published. */
  expectedSize: number;
  targetPath: string;
  onProgress: (received: number, total: number, bytesPerSecond: number) => void;
  signal: AbortSignal;
}

/**
 * Fetch an installer to disk, reporting progress as it goes.
 *
 * The bytes land in a `.part` file that is renamed only once the last one
 * arrives, so a half-written installer can never be handed to the shell — an
 * interrupted download leaves nothing behind at all.
 */
export async function downloadFile(req: DownloadRequest): Promise<void> {
  if (!isAllowedDownloadUrl(req.url)) {
    throw new Error(`Refusing to download from ${req.url}`);
  }

  const part = `${req.targetPath}.part`;
  await fs.mkdir(path.dirname(req.targetPath), { recursive: true });
  await fs.rm(part, { force: true });

  let received = 0;
  try {
    const res = await fetch(req.url, {
      signal: req.signal,
      headers: { 'User-Agent': USER_AGENT },
    });
    if (!res.ok || !res.body) {
      throw new Error(`Download returned ${res.status}`);
    }

    const declared = Number(res.headers.get('content-length'));
    const total = Number.isFinite(declared) && declared > 0 ? declared : req.expectedSize;

    let lastEmit = 0;
    let lastBytes = 0;
    let lastAt = Date.now();
    const counter = new Transform({
      transform(chunk, _encoding, done) {
        received += chunk.length;
        const now = Date.now();
        if (received === chunk.length || now - lastEmit >= PROGRESS_INTERVAL_MS) {
          const elapsed = Math.max(now - lastAt, 1);
          req.onProgress(received, total, ((received - lastBytes) * 1_000) / elapsed);
          lastEmit = now;
          lastBytes = received;
          lastAt = now;
        }
        done(null, chunk);
      },
    });

    const body = Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]);
    await pipeline(body, counter, createWriteStream(part));

    // No checksums are published for these releases, so the size from the
    // release metadata is the only corroboration TLS gets. A truncated body
    // that ended cleanly would otherwise reach the user as an installer.
    if (req.expectedSize > 0 && received !== req.expectedSize) {
      throw new Error(`Downloaded ${received} bytes, expected ${req.expectedSize}`);
    }

    req.onProgress(received, received, 0);
    await fs.rename(part, req.targetPath);
  } catch (err) {
    await fs.rm(part, { force: true });
    throw err;
  }
}
