import { REDIRECT_URI } from './oauth-config';

/** Every outbound request identifies the app; GitHub rejects requests without one. */
const USER_AGENT = 'git-desktop';

/**
 * `status` and `headers` are carried so a caller can tell a rate limit from a
 * real failure; both are absent when the request never reached a server.
 */
export class OAuthError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly headers?: Headers,
  ) {
    super(message);
  }
}

/**
 * A JSON GET against a provider API. A null token means an anonymous call: an
 * empty bearer would earn a 401.
 */
export async function getJson<T>(
  url: string,
  token: string | null,
  accept = 'application/json',
): Promise<T> {
  const res = await fetch(url, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      Accept: accept,
      'User-Agent': USER_AGENT,
    },
  });
  if (!res.ok) {
    throw new OAuthError(`${url} returned ${res.status}`, res.status, res.headers);
  }
  return (await res.json()) as T;
}

/**
 * The token endpoint, for code exchange and refreshes. GitHub answers 200 with
 * an error body, so the body decides success, not the status.
 */
export interface TokenResponse {
  accessToken: string;
  refreshToken: string | null;
  /** ms epoch, or null for a token that does not expire (GitHub OAuth apps). */
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

/**
 * An avatar as a data: URI, since the renderer's CSP allows no remote images.
 */
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
    // An avatar is decoration; failing to load one must not fail a sign-in.
    return null;
  }
}
