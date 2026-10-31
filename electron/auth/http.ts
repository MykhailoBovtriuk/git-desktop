import { REDIRECT_URI } from './oauth-config';

/** Every outbound request identifies the app; GitHub rejects requests without one. */
export const USER_AGENT = 'git-desktop';

const DEFAULT_TIMEOUT_MS = 15_000;
const PROBE_TIMEOUT_MS = 8000;

export class OAuthError extends Error {}

export class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly headers?: Headers,
  ) {
    super(message);
  }
}

export const isRejected = (err: unknown): boolean =>
  err instanceof HttpError && (err.status === 401 || err.status === 403);

export const basicAuth = (user: string, password: string): string =>
  `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`;

export function appFetch(
  url: string,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  return fetch(url, {
    ...init,
    headers: { 'User-Agent': USER_AGENT, ...(init.headers ?? {}) },
    signal: init.signal ?? AbortSignal.timeout(timeoutMs),
  });
}

export async function getJson<T>(
  url: string,
  token: string | null,
  accept = 'application/json',
): Promise<T> {
  return (await authedGet(url, token ? `Bearer ${token}` : null, accept)).json() as Promise<T>;
}

export async function authedGet(
  url: string,
  authorization: string | null,
  accept = 'application/json',
): Promise<Response> {
  const res = await appFetch(url, {
    headers: { ...(authorization ? { Authorization: authorization } : {}), Accept: accept },
  });
  if (!res.ok) {
    throw new HttpError(`${url} returned ${res.status}`, res.status, res.headers);
  }
  return res;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number | null;
}

// GitHub answers 200 with an error body, so the body decides success, not the status.
export async function postToken(
  tokenUrl: string,
  params: Record<string, string>,
): Promise<TokenResponse> {
  const res = await appFetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({ redirect_uri: REDIRECT_URI, ...params }).toString(),
  });

  const body = (await res.json().catch(() => null)) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  } | null;

  if (!body) {
    throw new OAuthError(`Token endpoint returned ${res.status} with no JSON body`);
  }
  if (body.error) {
    throw new OAuthError(body.error_description || body.error);
  }
  if (!res.ok || !body.access_token) {
    throw new OAuthError(`Token endpoint returned ${res.status}`);
  }

  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token ?? null,
    expiresAt: typeof body.expires_in === 'number' ? Date.now() + body.expires_in * 1000 : null,
  };
}

interface ProbeResponse {
  status: number;
  headers: Headers;
  body: unknown;
}

export async function probe(url: string): Promise<ProbeResponse | null> {
  try {
    const res = await appFetch(
      url,
      { headers: { Accept: 'application/json' }, redirect: 'manual' },
      PROBE_TIMEOUT_MS,
    );
    const body = await res.json().catch(() => null);
    return { status: res.status, headers: res.headers, body };
  } catch {
    return null;
  }
}

export async function sendRevoke(url: string, init: RequestInit): Promise<void> {
  try {
    await appFetch(url, init, PROBE_TIMEOUT_MS);
  } catch {}
}

const MAX_AVATAR_BYTES = 256 * 1024;

// A data: URI, since the renderer's CSP allows no remote images.
export async function fetchAvatar(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await appFetch(url);
    if (!res.ok) return null;
    const type = res.headers.get('content-type') ?? '';
    if (!type.startsWith('image/')) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > MAX_AVATAR_BYTES) return null;
    return `data:${type.split(';')[0]};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}
