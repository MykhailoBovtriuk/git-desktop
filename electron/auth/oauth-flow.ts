import crypto from 'crypto';
import type { ProviderAccount } from '../../src/types';
import { keysFor, REDIRECT_URI } from './oauth-config';
import { OAuthError, postToken, type TokenResponse } from './http';
import { providerById } from './providers/registry';
import type { ProviderDefinition } from './providers/types';

interface PendingFlow {
  state: string;
  providerId: ProviderDefinition['id'];
  host: string;
  repoPath: string;
  verifier: string | null;
  clientId: string;
  clientSecret: string | null;
  issuedAt: number;
}

/**
 * Ten minutes: enough for a password manager and 2FA, short enough that an
 * abandoned `state` cannot be replayed later.
 */
const STATE_TTL_MS = 10 * 60 * 1000;

let pending: PendingFlow | null = null;

export function cancelSignIn(): void {
  pending = null;
}

interface BeginOptions {
  provider: ProviderDefinition;
  host: string;
  repoPath: string;
  clientId?: string;
  clientSecret?: string;
}

export function beginSignIn(opts: BeginOptions): string {
  const { provider, host } = opts;
  const baked = keysFor(provider.id);
  const clientId = opts.clientId || baked?.clientId || '';
  const clientSecret = opts.clientSecret || baked?.clientSecret || null;

  if (!clientId) {
    throw new OAuthError(`No OAuth client id available for ${provider.displayName}`);
  }
  if (!provider.usesPkce && !clientSecret) {
    throw new OAuthError(`${provider.displayName} requires a client secret this build lacks`);
  }

  const state = crypto.randomUUID();
  const verifier = provider.usesPkce ? createVerifier() : null;

  const url = new URL(provider.endpoints(host).authorizeUrl);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', REDIRECT_URI);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('state', state);
  if (provider.scopes.length) {
    url.searchParams.set('scope', provider.scopes.join(' '));
  }
  if (verifier) {
    url.searchParams.set('code_challenge', challengeFor(verifier));
    url.searchParams.set('code_challenge_method', 'S256');
  }

  pending = {
    state,
    providerId: provider.id,
    host,
    repoPath: opts.repoPath,
    verifier,
    clientId,
    clientSecret,
    issuedAt: Date.now(),
  };
  return url.toString();
}

interface SignInResult {
  account: ProviderAccount;
  token: TokenResponse;
  clientId: string;
  clientSecret: string | null;
}

/**
 * `state` is single-use, time-limited and cleared before any network call, so a
 * foreign code is never accepted.
 */
export async function completeSignIn(callbackUrl: string): Promise<SignInResult> {
  const flow = pending;
  if (!flow) throw new OAuthError('No sign-in is in progress');

  let url: URL;
  try {
    url = new URL(callbackUrl);
  } catch {
    throw new OAuthError('Malformed sign-in callback');
  }

  const returnedState = url.searchParams.get('state') ?? '';
  const code = url.searchParams.get('code') ?? '';
  const error = url.searchParams.get('error');

  pending = null;

  if (error) {
    throw new OAuthError(url.searchParams.get('error_description') || error);
  }
  if (!statesMatch(returnedState, flow.state)) {
    throw new OAuthError('Sign-in state did not match — the response was ignored');
  }
  if (Date.now() - flow.issuedAt > STATE_TTL_MS) {
    throw new OAuthError('Sign-in took too long — please try again');
  }
  if (!code) throw new OAuthError('Sign-in callback carried no authorization code');

  const provider = providerById(flow.providerId);
  if (!provider) throw new OAuthError(`Unknown provider ${flow.providerId}`);

  const params: Record<string, string> = {
    client_id: flow.clientId,
    code,
    grant_type: 'authorization_code',
  };
  if (flow.verifier) params.code_verifier = flow.verifier;
  if (flow.clientSecret) params.client_secret = flow.clientSecret;

  const token = await postToken(provider.endpoints(flow.host).tokenUrl, params);
  const fetched = await provider.fetchAccount(flow.host, token.accessToken);
  const account: ProviderAccount = { ...fetched, id: flow.repoPath, repoPath: flow.repoPath };

  return { account, token, clientId: flow.clientId, clientSecret: flow.clientSecret };
}

export function refreshToken(
  provider: ProviderDefinition,
  host: string,
  refresh: string,
  clientId: string,
  clientSecret: string | null,
): Promise<TokenResponse> {
  const params: Record<string, string> = {
    client_id: clientId,
    grant_type: 'refresh_token',
    refresh_token: refresh,
  };
  if (clientSecret) params.client_secret = clientSecret;
  if (provider.scopes.length) params.scope = provider.scopes.join(' ');
  return postToken(provider.endpoints(host).tokenUrl, params);
}

function createVerifier(): string {
  return crypto.randomBytes(32).toString('base64url');
}

function challengeFor(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

/**
 * Constant-time comparison: a length-leaking `===` has no place in a security
 * check.
 */
function statesMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length || bufA.length === 0) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
