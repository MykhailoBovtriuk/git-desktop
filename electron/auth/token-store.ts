import { app, safeStorage } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import type { ProviderAccount } from '../../src/types';
import { providerById } from './providers/registry';
import { refreshToken } from './oauth-flow';
import { approveCredentials, gitUsernameFor } from './git-credentials';
import { accountIdFor } from './account-id';

/**
 * Where signed-in accounts live, keyed by `host|login` — so a personal and a
 * work account on the same GitHub are two entries, not one overwriting the
 * other, and github.com, a work GitLab and Azure DevOps coexist as a matter of
 * course.
 *
 * A repository is bound to one of them; the binding lives here too, because it
 * is worthless without the account it points at and must disappear with it.
 *
 * Tokens are encrypted with the OS keychain via safeStorage. When that is
 * unavailable (a Linux box with no keyring), nothing is written to disk at all:
 * a plaintext token in a JSON file under the user's home is worse than asking
 * them to sign in again next launch.
 */
export interface StoredCredential {
  /** `host|login`. */
  id: string;
  host: string;
  account: ProviderAccount;
  accessToken: string;
  refreshToken: string | null;
  /** ms epoch, or null for a token that does not expire. */
  expiresAt: number | null;
  /** Kept because refreshing needs the same client the code was issued to. */
  clientId: string;
  clientSecret: string | null;
}

interface PersistedEntry {
  id: string;
  host: string;
  account: ProviderAccount;
  accessTokenEnc: string | null;
  refreshTokenEnc: string | null;
  expiresAt: number | null;
  clientId: string;
  clientSecret: string | null;
}

/** Refresh a little early: a token that expires mid-push helps nobody. */
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

/** Keyed by account id. */
const memory = new Map<string, StoredCredential>();
/** Repository path → account id. */
const bindings = new Map<string, string>();
let loaded = false;

function storeFile(): string {
  return path.join(app.getPath('userData'), 'accounts.json');
}

function canEncrypt(): boolean {
  try {
    return safeStorage.isEncryptionAvailable();
  } catch {
    return false;
  }
}

function encrypt(value: string | null): string | null {
  if (value === null) return null;
  return safeStorage.encryptString(value).toString('base64');
}

function decrypt(value: string | null): string | null {
  if (!value) return null;
  try {
    return safeStorage.decryptString(Buffer.from(value, 'base64'));
  } catch {
    // A keychain the user reset, or a file copied between machines. The entry
    // is unusable, not corrupt data worth surfacing — treat it as signed out.
    return null;
  }
}

async function load(): Promise<void> {
  if (loaded) return;
  loaded = true;
  if (!canEncrypt()) return;
  try {
    const raw = await fs.readFile(storeFile(), 'utf8');
    const parsed = JSON.parse(raw) as
      PersistedEntry[] | { accounts: PersistedEntry[]; bindings?: Record<string, string> };
    // An older build wrote a bare array keyed by host; read it rather than
    // silently signing the user out on upgrade.
    const entries = Array.isArray(parsed) ? parsed : parsed.accounts;
    for (const entry of entries ?? []) {
      const accessToken = decrypt(entry.accessTokenEnc);
      if (!accessToken) continue;
      const id = entry.id ?? accountIdFor(entry.host, entry.account.login);
      memory.set(id, {
        id,
        host: entry.host,
        account: { ...entry.account, id },
        accessToken,
        refreshToken: decrypt(entry.refreshTokenEnc),
        expiresAt: entry.expiresAt,
        clientId: entry.clientId,
        clientSecret: entry.clientSecret,
      });
    }
    if (!Array.isArray(parsed)) {
      for (const [repo, id] of Object.entries(parsed.bindings ?? {})) {
        if (memory.has(id)) bindings.set(repo, id);
      }
    }
  } catch {
    // No file yet, or one we cannot parse. Either way: no accounts.
  }
}

async function persist(): Promise<void> {
  if (!canEncrypt()) return;
  const entries: PersistedEntry[] = [...memory.values()].map(c => ({
    id: c.id,
    host: c.host,
    account: c.account,
    accessTokenEnc: encrypt(c.accessToken),
    refreshTokenEnc: encrypt(c.refreshToken),
    expiresAt: c.expiresAt,
    clientId: c.clientId,
    clientSecret: c.clientSecret,
  }));
  // 0o600: the tokens inside are encrypted, but the account list is not, and
  // it is nobody else's business which servers this user works against.
  const payload = { accounts: entries, bindings: Object.fromEntries(bindings) };
  await fs.writeFile(storeFile(), JSON.stringify(payload, null, 2), { mode: 0o600 });
}

/** True when tokens survive a restart. False means this session only. */
export function isPersistent(): boolean {
  return canEncrypt();
}

export async function saveCredential(credential: StoredCredential): Promise<void> {
  await load();
  memory.set(credential.id, credential);
  await persist();
}

export async function listAccounts(): Promise<ProviderAccount[]> {
  await load();
  return [...memory.values()].map(c => c.account);
}

/** Every account signed in to this host — often more than one. */
export async function accountsForHost(host: string): Promise<ProviderAccount[]> {
  await load();
  return [...memory.values()].filter(c => c.host === host).map(c => c.account);
}

export async function accountById(id: string): Promise<ProviderAccount | null> {
  await load();
  return memory.get(id)?.account ?? null;
}

/** Which account a repository commits and pushes as, if the user has said. */
export async function boundAccount(repoPath: string): Promise<ProviderAccount | null> {
  await load();
  const id = bindings.get(repoPath);
  return id ? (memory.get(id)?.account ?? null) : null;
}

/**
 * Forget which account a repository used.
 *
 * The token is deliberately untouched: it belongs to the host and is shared
 * with every other repository there, so removing one repository from the list
 * must never sign the user out of the rest.
 */
export async function unbindRepo(repoPath: string): Promise<boolean> {
  await load();
  if (!bindings.delete(repoPath)) return false;
  await persist();
  return true;
}

export async function bindRepo(repoPath: string, accountId: string): Promise<void> {
  await load();
  if (!memory.has(accountId)) return;
  bindings.set(repoPath, accountId);
  await persist();
}

export async function clearCredential(accountId: string): Promise<ProviderAccount | null> {
  await load();
  const existing = memory.get(accountId);
  if (!existing) return null;
  memory.delete(accountId);
  // A binding to an account that no longer exists would quietly point nowhere.
  for (const [repo, id] of bindings) if (id === accountId) bindings.delete(repo);
  await persist();
  return existing.account;
}

/**
 * A usable access token for a host, refreshing it first when it is about to
 * expire.
 *
 * This is the piece that makes short-lived providers work at all: Bitbucket and
 * GitLab tokens last two hours and Entra ID about one, so "store it once and
 * forget" would leave push failing an hour into the session with an
 * authentication error the user has no way to interpret.
 */
export async function getFreshToken(accountId: string): Promise<string | null> {
  await load();
  const credential = memory.get(accountId);
  if (!credential) return null;
  const host = credential.host;

  const expiring =
    credential.expiresAt !== null && credential.expiresAt - Date.now() < REFRESH_MARGIN_MS;
  if (!expiring) return credential.accessToken;

  if (!credential.refreshToken) {
    // Expired with no way back. Leave the entry in place so the UI can still
    // name the account it is asking the user to sign into again.
    return null;
  }

  const provider = providerById(credential.account.providerId);
  if (!provider) return null;

  try {
    const next = await refreshToken(
      provider,
      host,
      credential.refreshToken,
      credential.clientId,
      credential.clientSecret,
    );
    const updated: StoredCredential = {
      ...credential,
      accessToken: next.accessToken,
      // A provider that rotates refresh tokens sends a new one; one that does
      // not sends none, and the old one stays valid.
      refreshToken: next.refreshToken ?? credential.refreshToken,
      expiresAt: next.expiresAt,
    };
    memory.set(accountId, updated);
    await persist();
    // The system credential store holds a copy, and it has just gone stale.
    await approveCredentials(host, gitUsernameFor(updated.account), updated.accessToken);
    return updated.accessToken;
  } catch {
    return null;
  }
}

/** Exported for tests: lets a suite start from a known state. */
export function resetStoreCache(): void {
  memory.clear();
  bindings.clear();
  loaded = false;
}
