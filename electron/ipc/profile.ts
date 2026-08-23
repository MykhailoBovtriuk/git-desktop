import { ipcMain } from 'electron';
import { GitService } from '../git-service';
import { assertString, assertOptionalString } from '../ipc-validators';
import { wrap } from './wrap';
import type { GitProfile } from '../../src/types';

function assertProfile(value: unknown): asserts value is GitProfile {
  if (!value || typeof value !== 'object') {
    throw new Error('Invalid argument: profile must be an object');
  }
  const p = value as Record<string, unknown>;
  assertString(p.name, 'profile.name');
  assertString(p.email, 'profile.email');
  assertOptionalString(p.sshKeyPath, 'profile.sshKeyPath');
  if (p.signCommits !== undefined && typeof p.signCommits !== 'boolean') {
    throw new Error('Invalid argument: profile.signCommits must be a boolean');
  }
}

export function registerProfileHandlers(git: GitService) {
  ipcMain.handle('git:get-identity', () => wrap(() => git.getIdentity()));

  ipcMain.handle('git:apply-profile', (_e, profile: unknown) =>
    wrap(() => {
      assertProfile(profile);
      return git.applyProfile(profile);
    }),
  );

  ipcMain.handle('git:clear-profile', () => wrap(() => git.clearProfile()));
}
