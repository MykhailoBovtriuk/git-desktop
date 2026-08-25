import { execFile } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import path from 'path';
import { GitContext } from './context';

const run = promisify(execFile);

/** Where git took the value from — not where we put it. */
export type IdentityScope = 'local' | 'global' | 'included' | 'none';

/** The identity a repository would use if its own override were removed. */
export interface InheritedIdentity {
  name: string | null;
  email: string | null;
  origin: string | null;
  scope: IdentityScope;
}

export interface EffectiveIdentity {
  name: string | null;
  email: string | null;
  /** The config file git resolved the email from, absolute where known. */
  origin: string | null;
  scope: IdentityScope;
  signingKey: string | null;
  signCommits: boolean;
  /** Only set while a repository-level override is in effect. */
  inherited: InheritedIdentity | null;
}

/**
 * Every key this app is willing to unset for a repository. `gitdesktop.profile`
 * is a leftover from the removed profiles feature: repositories configured by
 * an older build still carry it, and it must go with the rest.
 */
export const IDENTITY_KEYS = [
  'user.name',
  'user.email',
  'user.signingkey',
  'gpg.format',
  'commit.gpgsign',
  'core.sshCommand',
  'gitdesktop.profile',
] as const;

// Resolved per call rather than once at import: os.homedir() follows $HOME,
// and a constant captured at load time would go stale the moment it changes.
function globalConfigPaths(): string[] {
  const home = os.homedir();
  return [path.join(home, '.gitconfig'), path.join(home, '.config', 'git', 'config')];
}

interface OriginValue {
  value: string;
  origin: string | null;
}

/**
 * `--show-origin` prints "file:<path>\t<value>". Asking git for the origin is
 * what lets this work for every setup at once — a local override, the global
 * config, or a file pulled in by `includeIf` — without the app knowing anything
 * about how the user arranged them.
 */
function parseLine(line: string, repoRoot: string | null): OriginValue | null {
  const tab = line.indexOf('\t');
  if (tab < 0) {
    const bare = line.trim();
    return bare ? { value: bare, origin: null } : null;
  }
  const source = line.slice(0, tab);
  const value = line.slice(tab + 1).trim();
  if (!value) return null;
  if (!source.startsWith('file:')) return { value, origin: null };

  const raw = source.slice('file:'.length);
  // Paths inside the open repository come back relative (".git/config").
  const origin = path.isAbsolute(raw) ? raw : repoRoot ? path.resolve(repoRoot, raw) : raw;
  return { value, origin };
}

/**
 * Every value git found, lowest precedence first — `--get-all` is what makes it
 * possible to answer "and what would apply if this repository stopped
 * overriding?". Reading the global config directly cannot answer that: it does
 * not evaluate `includeIf`, so it reports the wrong identity whenever a rule is
 * in play.
 */
function parseShowOriginAll(stdout: string, repoRoot: string | null): OriginValue[] {
  return stdout
    .split('\n')
    .map(line => parseLine(line, repoRoot))
    .filter((v): v is OriginValue => v !== null);
}

function scopeFor(origin: string | null, repoRoot: string | null): IdentityScope {
  if (!origin) return 'global';
  if (
    repoRoot &&
    (origin === path.join(repoRoot, '.git', 'config') ||
      origin.startsWith(path.join(repoRoot, '.git') + path.sep))
  ) {
    return 'local';
  }
  if (globalConfigPaths().includes(origin)) return 'global';
  // Anything else git resolved is a file the user pulled in deliberately —
  // in practice an includeIf target.
  return 'included';
}

async function readAll(ctx: GitContext, key: string): Promise<OriginValue[]> {
  try {
    if (!ctx.getRepoPath()) {
      const { stdout } = await run('git', [
        'config',
        '--global',
        '--show-origin',
        '--get-all',
        key,
      ]);
      return parseShowOriginAll(stdout, null);
    }
    const out = await ctx.ensureRepo().raw(['config', '--show-origin', '--get-all', key]);
    return parseShowOriginAll(out, ctx.getRepoPath());
  } catch {
    // git exits non-zero when the key is unset anywhere.
    return [];
  }
}

const last = <T>(xs: T[]): T | null => (xs.length ? xs[xs.length - 1] : null);

export async function getEffectiveIdentity(ctx: GitContext): Promise<EffectiveIdentity> {
  const repoRoot = ctx.getRepoPath();
  const [names, emails, signingKeys, gpgsigns] = await Promise.all([
    readAll(ctx, 'user.name'),
    readAll(ctx, 'user.email'),
    readAll(ctx, 'user.signingkey'),
    readAll(ctx, 'commit.gpgsign'),
  ]);

  const name = last(names);
  const email = last(emails);
  // The email decides the reported origin: it is the field that identifies the
  // author, and the one people actually get wrong.
  const anchor = email ?? name;
  const scope = anchor ? scopeFor(anchor.origin, repoRoot) : 'none';

  // What this repository would fall back to if its override went away. Taken
  // from the same precedence list rather than from the global file, so an
  // includeIf rule is reflected correctly.
  let inherited: InheritedIdentity | null = null;
  if (scope === 'local') {
    const notLocal = (v: OriginValue) => scopeFor(v.origin, repoRoot) !== 'local';
    const inheritedEmail = last(emails.filter(notLocal));
    const inheritedName = last(names.filter(notLocal));
    const inheritedAnchor = inheritedEmail ?? inheritedName;
    if (inheritedAnchor) {
      inherited = {
        name: inheritedName?.value ?? null,
        email: inheritedEmail?.value ?? null,
        origin: inheritedAnchor.origin,
        scope: scopeFor(inheritedAnchor.origin, repoRoot),
      };
    }
  }

  return {
    name: name?.value ?? null,
    email: email?.value ?? null,
    origin: anchor?.origin ?? null,
    scope,
    signingKey: last(signingKeys)?.value ?? null,
    signCommits: last(gpgsigns)?.value === 'true',
    inherited,
  };
}

/**
 * The normal way to set who you are: one identity covering every repository.
 * A per-repository override exists for the exception, not the rule — offering
 * only the local variant would mean re-entering the same name in every repo.
 */
export async function setGlobalIdentity(
  ctx: GitContext,
  name: string,
  email: string,
): Promise<EffectiveIdentity> {
  await run('git', ['config', '--global', 'user.name', name]);
  await run('git', ['config', '--global', 'user.email', email]);
  return getEffectiveIdentity(ctx);
}

export async function setLocalIdentity(
  ctx: GitContext,
  name: string,
  email: string,
): Promise<EffectiveIdentity> {
  const git = ctx.ensureRepo();
  await git.raw(['config', '--local', 'user.name', name]);
  await git.raw(['config', '--local', 'user.email', email]);
  return getEffectiveIdentity(ctx);
}

export async function clearLocalIdentity(ctx: GitContext): Promise<EffectiveIdentity> {
  const git = ctx.ensureRepo();
  for (const key of IDENTITY_KEYS) {
    try {
      await git.raw(['config', '--local', '--unset', key]);
    } catch {
      // Exit code 5 means "was not set" — the desired end state either way.
    }
  }
  return getEffectiveIdentity(ctx);
}
