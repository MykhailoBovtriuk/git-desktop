import { describe, it, expect } from 'vitest';
import {
  assertString,
  assertOptionalString,
  assertStringArray,
  assertNonNegativeInteger,
  assertPositiveInteger,
  assertBoundedLogLimit,
  assertBranchName,
  assertCommitHash,
  assertIdentity,
} from '../electron/ipc-validators';

describe('assertString', () => {
  it('accepts non-empty strings', () => {
    expect(() => assertString('x', 'v')).not.toThrow();
  });
  it('rejects empty string', () => {
    expect(() => assertString('', 'v')).toThrow(/non-empty string/);
  });
  it('rejects non-strings', () => {
    expect(() => assertString(5, 'v')).toThrow(/non-empty string/);
    expect(() => assertString(undefined, 'v')).toThrow(/non-empty string/);
    expect(() => assertString(null, 'v')).toThrow(/non-empty string/);
  });
});

describe('assertOptionalString', () => {
  it('accepts undefined', () => {
    expect(() => assertOptionalString(undefined, 'v')).not.toThrow();
  });
  it('accepts strings (including empty)', () => {
    expect(() => assertOptionalString('', 'v')).not.toThrow();
    expect(() => assertOptionalString('x', 'v')).not.toThrow();
  });
  it('rejects non-string non-undefined', () => {
    expect(() => assertOptionalString(5, 'v')).toThrow(/must be a string/);
    expect(() => assertOptionalString(null, 'v')).toThrow(/must be a string/);
  });
});

describe('assertStringArray', () => {
  it('accepts non-empty array of non-empty strings', () => {
    expect(() => assertStringArray(['a', 'b'], 'v')).not.toThrow();
  });
  it('rejects non-arrays', () => {
    expect(() => assertStringArray('a', 'v')).toThrow(/non-empty array/);
  });
  it('rejects empty array', () => {
    expect(() => assertStringArray([], 'v')).toThrow(/non-empty array/);
  });
  it('rejects arrays containing empty or non-string items', () => {
    expect(() => assertStringArray(['a', ''], 'v')).toThrow(/only non-empty strings/);
    expect(() => assertStringArray(['a', 5], 'v')).toThrow(/only non-empty strings/);
  });
});

describe('assertNonNegativeInteger', () => {
  it('accepts 0 and positive integers', () => {
    expect(() => assertNonNegativeInteger(0, 'v')).not.toThrow();
    expect(() => assertNonNegativeInteger(42, 'v')).not.toThrow();
  });
  it('rejects negatives, non-integers, non-numbers', () => {
    expect(() => assertNonNegativeInteger(-1, 'v')).toThrow();
    expect(() => assertNonNegativeInteger(1.5, 'v')).toThrow();
    expect(() => assertNonNegativeInteger('1', 'v')).toThrow();
  });
});

describe('assertPositiveInteger', () => {
  it('accepts positive integers', () => {
    expect(() => assertPositiveInteger(1, 'v')).not.toThrow();
  });
  it('rejects 0 and below', () => {
    expect(() => assertPositiveInteger(0, 'v')).toThrow();
    expect(() => assertPositiveInteger(-3, 'v')).toThrow();
  });
});

describe('assertBoundedLogLimit', () => {
  it('accepts 1..1000', () => {
    expect(() => assertBoundedLogLimit(1)).not.toThrow();
    expect(() => assertBoundedLogLimit(1000)).not.toThrow();
  });
  it('rejects 0 and > 1000', () => {
    expect(() => assertBoundedLogLimit(0)).toThrow();
    expect(() => assertBoundedLogLimit(1001)).toThrow(/<= 1000/);
  });
});

describe('assertNonNegativeInteger', () => {
  it('accepts 0 and positive integers', () => {
    expect(() => assertNonNegativeInteger(0, 'index')).not.toThrow();
    expect(() => assertNonNegativeInteger(3, 'index')).not.toThrow();
  });
  it('rejects negatives', () => {
    expect(() => assertNonNegativeInteger(-1, 'index')).toThrow();
  });
});

describe('assertCommitHash', () => {
  it.each(['4b825dc642cb6eb9a060e54bf8d69288fbee4904', 'a'.repeat(64), '4b82', 'DEADBEEF'])(
    'accepts valid hash %j',
    hash => {
      expect(() => assertCommitHash(hash, 'hash')).not.toThrow();
    },
  );

  it.each([
    '--output=/tmp/pwned',
    '-4b82',
    'HEAD',
    'main',
    '4b8',
    'a'.repeat(65),
    '4b825dc6 42cb',
    '4b825dc6\n42cb',
    '',
  ])('rejects invalid hash %j', hash => {
    expect(() => assertCommitHash(hash, 'hash')).toThrow();
  });

  it('rejects non-string input', () => {
    expect(() => assertCommitHash(5, 'hash')).toThrow(/non-empty string/);
  });
});

describe('assertBranchName', () => {
  it.each([
    'main',
    'feature-branch',
    'release-1.0',
    'feature/foo',
    'fix/bug-123',
    'user/name/topic',
    'тест-гілка',
    'v2.0.0',
    'a_b',
    'CamelCase',
  ])('accepts valid branch name %j', name => {
    expect(() => assertBranchName(name, 'branch')).not.toThrow();
  });

  it.each([
    '-foo',
    '--force',
    'has space',
    'line\nbreak',
    'tab\there',
    'tilde~1',
    'caret^2',
    'colon:here',
    'question?',
    'star*',
    'bracket[x',
    'back\\slash',
    'dot..dot',
    'at@{seq',
    'ends.lock',
    'trailing/',
    'trailing.',
  ])('rejects invalid branch name %j', name => {
    expect(() => assertBranchName(name, 'branch')).toThrow();
  });

  it('rejects non-string input', () => {
    expect(() => assertBranchName(5, 'branch')).toThrow(/non-empty string/);
  });
});

describe('assertIdentity', () => {
  it('accepts a name and email, or empty values meaning unset', () => {
    expect(() => assertIdentity({ name: 'Ada', email: 'ada@example.com' })).not.toThrow();
    expect(() => assertIdentity({ name: '', email: '' })).not.toThrow();
  });

  it('rejects anything git config would store as more than one line', () => {
    expect(() => assertIdentity({ name: 'Ada\n[core]', email: '' })).toThrow(/name/);
    expect(() => assertIdentity({ name: 'Ada', email: 'a@b\0' })).toThrow(/email/);
  });

  it('rejects an email that is not one, and odd shapes', () => {
    expect(() => assertIdentity({ name: 'Ada', email: 'not-an-email' })).toThrow(/email/);
    expect(() => assertIdentity({ name: 'x'.repeat(201), email: '' })).toThrow(/name/);
    expect(() => assertIdentity({ name: 1, email: '' })).toThrow(/name/);
    expect(() => assertIdentity(null)).toThrow(/identity/);
  });
});
