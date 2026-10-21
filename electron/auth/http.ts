import { REDIRECT_URI } from './oauth-config';

/** Every outbound request identifies the app; GitHub rejects requests without one. */
const USER_AGENT = 'git-desktop';

export class OAuthError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly headers?: Headers,
  ) {
    super(message);
  }
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
  const res = await fetch(url, {
    headers: {
      ...(authorization ? { Authorization: authorization } : {}),
      Accept: accept,
      'User-Agent': USER_AGENT,
    },
  });
  if (!res.ok) {
    throw new OAuthError(`${url} returned ${res.status}`, res.status, res.headers);
  }
  return res;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number | null;
}

export async function postToken(
  tokenUrl: string,
  params: Record<string, string>,
): Promise<TokenResponse> {
  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
      'User-Agent': USER_AGENT,
    },
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

const PROBE_TIMEOUT_MS = 8000;

export async function probe(url: string): Promise<ProbeResponse | null> {
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
      redirect: 'manual',
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    const body = await res.json().catch(() => null);
    return { status: res.status, headers: res.headers, body };
  } catch {
    return null;
  }
}

export async function sendRevoke(url: string, init: RequestInit): Promise<void> {
  try {
    await fetch(url, {
      ...init,
      headers: { 'User-Agent': USER_AGENT, ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
  } catch {}
}

const MAX_AVATAR_BYTES = 256 * 1024;

export async function fetchAvatar(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
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
