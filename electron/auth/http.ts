import { REDIRECT_URI } from './oauth-config';

/** Every outbound request identifies the app; GitHub rejects requests without one. */
const USER_AGENT = 'git-desktop';

export class OAuthError extends Error {}

/**
 * A JSON GET against a provider API.
 *
 * `Accept` is per-call because providers disagree: GitHub wants its versioned
 * media type, everyone else wants plain JSON.
 */
export async function getJson<T>(
  url: string,
  token: string,
  accept = 'application/json',
): Promise<T> {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: accept,
      'User-Agent': USER_AGENT,
    },
  });
  if (!res.ok) {
    throw new OAuthError(`${url} returned ${res.status}`);
  }
  return (await res.json()) as T;
}

/**
 * The token endpoint, for both the initial code exchange and refreshes.
 *
 * GitHub answers HTTP 200 with `{"error":"bad_verification_code"}` on failure,
 * so the status alone is not a verdict — the body has to be inspected. Getting
 * this wrong means a failed sign-in looks like a successful one.
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
 * An avatar as a data: URI.
 *
 * The renderer's CSP allows `img-src 'self' data: app:` and nothing remote, so
 * a plain avatar URL would simply not render. Fetching here keeps the policy
 * strict instead of widening it for a 32-pixel picture.
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
