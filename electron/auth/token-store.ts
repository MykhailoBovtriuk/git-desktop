import { app, safeStorage } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import type { ProviderAccount } from '../../src/types';
import { providerById } from './providers/registry';
import { refreshToken } from './oauth-flow';
import { approveCredentials, gitUsernameFor } from './git-credentials';

/**
 * Signed-in accounts, one per repository: each repository the app has open
 * signs in on its own, whatever server it lives on. Tokens are encrypted via
 * safeStorage; without a keyring nothing is written to disk.
 */
export interface StoredCredential {
  repoPath: string;
  host: string;
  account: ProviderAccount;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number | null;
  clientId: string;
  clientSecret: string | null;
}

interface PersistedEntry {
  repoPath?: string;
  host: string;
  account: ProviderAccount;
  accessTokenEnc: string | null;
  refreshTokenEnc: string | null;
  expiresAt: number | null;
  clientId: string;
  clientSecret: string | null;
}

const REFRESH_MARGIN_MS = 5 * 60 * 1000;

const memory = new Map<string, StoredCredential>();
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
    return null;
  }
}

async function load(): Promise<void> {
  if (loaded) return;
  loaded = true;
  if (!canEncrypt()) return;
  try {
    const raw = await fs.readFile(storeFile(), 'utf8');
    const parsed = JSON.parse(raw) as PersistedEntry[] | { accounts: PersistedEntry[] };
    const entries = Array.isArray(parsed) ? parsed : parsed.accounts;
    for (const entry of entries ?? []) {
      // Older files kept one account per host, for no repository in
      // particular: each repository now signs in again on its own.
      const repoPath = entry.repoPath;
      if (!repoPath) continue;
      const accessToken = decrypt(entry.accessTokenEnc);
      if (!accessToken || memory.has(repoPath)) continue;
      memory.set(repoPath, {
        repoPath,
        host: entry.host,
        account: { ...entry.account, id: repoPath, repoPath },
        accessToken,
        refreshToken: decrypt(entry.refreshTokenEnc),
        expiresAt: entry.expiresAt,
        clientId: entry.clientId,
        clientSecret: entry.clientSecret,
      });
    }
  } catch {}
}

async function persist(): Promise<void> {
  if (!canEncrypt()) return;
  const entries: PersistedEntry[] = [...memory.values()].map(c => ({
    repoPath: c.repoPath,
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
  await fs.writeFile(storeFile(), JSON.stringify({ accounts: entries }, null, 2), { mode: 0o600 });
}

export function isPersistent(): boolean {
  return canEncrypt();
}

export async function saveCredential(credential: StoredCredential): Promise<void> {
  await load();
  memory.set(credential.repoPath, credential);
  await persist();
}

export async function listAccounts(): Promise<ProviderAccount[]> {
  await load();
  return [...memory.values()].map(c => c.account);
}

export async function accountForRepo(repoPath: string): Promise<ProviderAccount | null> {
  await load();
  return memory.get(repoPath)?.account ?? null;
}

/**
 * The other repositories signed in to a host: the system credential store
 * holds one token per host and username, which they may share.
 */
export async function credentialsOnHost(host: string): Promise<StoredCredential[]> {
  await load();
  return [...memory.values()].filter(c => c.host === host);
}

export async function clearCredential(repoPath: string): Promise<StoredCredential | null> {
  await load();
  const existing = memory.get(repoPath);
  if (!existing) return null;
  memory.delete(repoPath);
  await persist();
  return existing;
}

export async function getFreshToken(repoPath: string): Promise<string | null> {
  await load();
  const credential = memory.get(repoPath);
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
    memory.set(repoPath, updated);
    await persist();
    await approveCredentials(host, gitUsernameFor(updated.account), updated.accessToken);
    return updated.accessToken;
  } catch {
    return null;
  }
}

export function resetStoreCache(): void {
  memory.clear();
  loaded = false;
}
