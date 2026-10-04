import { GitContext } from './context';
import { accountForHost, getFreshToken } from '../auth/token-store';
import {
  httpsUrlFromSshRemote,
  sshUrlFromHttpsRemote,
  resolveRemote,
  resolveRemoteHost,
  type ResolvedRemote,
} from '../auth/remote-host';

async function originRemote(ctx: GitContext) {
  const remotes = await ctx.ensureRepo().getRemotes(true);
  return remotes.find(r => r.name === 'origin') ?? remotes[0];
}

/**
 * The origin URL, or null without a remote. SSH and HTTPS fail authentication
 * for different reasons.
 */
export async function getRemoteUrl(ctx: GitContext): Promise<string | null> {
  const origin = await originRemote(ctx);
  return origin?.refs?.push || origin?.refs?.fetch || null;
}

/** Where the ssh address is kept while the remote is on https: an alias is not recoverable from it. */
const SSH_URL_KEY = 'gitdesktop-sshurl';
const SSH_PUSH_URL_KEY = 'gitdesktop-sshpushurl';

/**
 * Point origin at the same repository over the other protocol: https lets a
 * signed-in account's token authenticate it, ssh goes back to the key.
 */
export async function switchRemoteProtocol(
  ctx: GitContext,
  to: 'ssh' | 'https',
): Promise<ResolvedRemote> {
  const origin = await originRemote(ctx);
  const fetch = origin?.refs?.fetch;
  if (!origin || !fetch) throw new Error('The repository has no remote');
  const push = origin.refs.push && origin.refs.push !== fetch ? origin.refs.push : null;
  const repo = ctx.ensureRepo();
  const config = (key: string) => `remote.${origin.name}.${key}`;
  const setUrls = async (fetchUrl: string, pushUrl: string | null) => {
    await repo.remote(['set-url', origin.name, fetchUrl]);
    // A separate push url would otherwise go on using the old protocol.
    if (push) await repo.remote(['set-url', '--push', origin.name, pushUrl ?? fetchUrl]);
  };

  if (to === 'https') {
    const toHttps = async (url: string) => {
      const host = await resolveRemoteHost(url);
      return host ? httpsUrlFromSshRemote(url, host) : null;
    };
    const fetchUrl = await toHttps(fetch);
    if (!fetchUrl) throw new Error('The remote is not an ssh address');
    await repo.addConfig(config(SSH_URL_KEY), fetch);
    if (push) await repo.addConfig(config(SSH_PUSH_URL_KEY), push);
    await setUrls(fetchUrl, push && (await toHttps(push)));
  } else {
    const fetchUrl = sshUrlFromHttpsRemote(fetch);
    if (!fetchUrl) throw new Error('The remote is not an https address');
    // The address it had before, alias and all, as long as it is still the same
    // repository.
    const remembered = async (key: string, httpsUrl: string) => {
      const url = (await repo.raw(['config', '--get', config(key)]).catch(() => '')).trim();
      if (!url) return null;
      const host = await resolveRemoteHost(url);
      return host && httpsUrlFromSshRemote(url, host) === httpsUrl ? url : null;
    };
    await setUrls(
      (await remembered(SSH_URL_KEY, fetch)) ?? fetchUrl,
      push && ((await remembered(SSH_PUSH_URL_KEY, push)) ?? sshUrlFromHttpsRemote(push)),
    );
  }
  return resolveRemote(await getRemoteUrl(ctx));
}

/**
 * Refresh a short-lived token before git reads it; `getFreshToken` rewrites the
 * system credential on renewal.
 */
async function refreshCredentialIfNeeded(ctx: GitContext): Promise<void> {
  try {
    const host = await resolveRemoteHost(await getRemoteUrl(ctx));
    if (!host) return;
    const account = await accountForHost(host);
    if (account) await getFreshToken(account.id);
  } catch {
    // Refreshing is an optimisation over letting git fail; never a reason to
    // block the operation the user asked for.
  }
}

export async function fetch(ctx: GitContext): Promise<void> {
  await refreshCredentialIfNeeded(ctx);
  await ctx.ensureRepo().fetch();
}

export async function pull(ctx: GitContext): Promise<string> {
  await refreshCredentialIfNeeded(ctx);
  const result = await ctx.ensureRepo().pull();
  const s = result.summary ?? { changes: 0, insertions: 0, deletions: 0 };
  const ch = s.changes ?? 0,
    ins = s.insertions ?? 0,
    del = s.deletions ?? 0;
  if (ch === 0 && ins === 0 && del === 0) return 'Already up to date';
  return `${ch} changes, ${ins} insertions, ${del} deletions`;
}

export async function push(ctx: GitContext): Promise<void> {
  await refreshCredentialIfNeeded(ctx);
  await ctx.ensureRepo().push();
}

export async function pushSetUpstream(
  ctx: GitContext,
  remote: string,
  branch: string,
): Promise<void> {
  await refreshCredentialIfNeeded(ctx);
  await ctx.ensureRepo().push(['-u', remote, branch]);
}
