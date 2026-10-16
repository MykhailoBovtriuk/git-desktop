import { describe, it, expect } from 'vitest';
import { parseServerAddress } from '../../src/lib/server-address';

describe('parseServerAddress', () => {
  it.each([
    ['ghe.acme.com', 'ghe.acme.com'],
    ['https://ghe.acme.com', 'ghe.acme.com'],
    ['https://GHE.Acme.com/org/repo.git', 'ghe.acme.com'],
    ['  https://ghe.acme.com/  ', 'ghe.acme.com'],
    ['git.acme.com:8443', 'git.acme.com:8443'],
    ['ghe.acme.com.', 'ghe.acme.com'],
  ])('reads %s as %s', (raw, host) => {
    expect(parseServerAddress(raw)).toEqual({ host });
  });

  it('refuses http', () => {
    expect(parseServerAddress('http://ghe.acme.com')).toEqual({ error: 'insecure' });
  });

  it.each(['', 'not a url', 'ssh://git@ghe.acme.com', 'https://user:pw@ghe.acme.com', 'localhost'])(
    'refuses %j',
    raw => {
      expect(parseServerAddress(raw)).toEqual({ error: 'invalid' });
    },
  );
});
