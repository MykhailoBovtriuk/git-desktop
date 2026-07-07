import { describe, it, expect } from 'vitest';
import {
  assertString,
  assertOptionalString,
  assertStringArray,
  assertNonNegativeInteger,
  assertPositiveInteger,
  assertBoundedLogLimit,
  assertStashIndex,
  assertBranchName,
  assertCommitHash,
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

describe('assertStashIndex', () => {
  it('accepts 0 and positive integers', () => {
    expect(() => assertStashIndex(0)).not.toThrow();
    expect(() => assertStashIndex(3)).not.toThrow();
  });
  it('rejects negatives', () => {
    expect(() => assertStashIndex(-1)).toThrow();
  });
});

describe('assertCommitHash', () => {
  it.each([
    '4b825dc642cb6eb9a060e54bf8d69288fbee4904', // full SHA-1
    'a'.repeat(64),                              // SHA-256
    '4b82',                                      // shortest abbreviation
    'DEADBEEF',                                  // uppercase hex
  ])('accepts valid hash %j', (hash) => {
    expect(() => assertCommitHash(hash, 'hash')).not.toThrow();
  });

  // Regression: a hash starting with '-' reaches raw git as a flag, e.g.
  // getCommitDiff('--output=/path') writes diff output to an arbitrary file.
  it.each([
    '--output=/tmp/pwned', // flag injection
    '-4b82',               // leading dash
    'HEAD',                // not hex — refs must not pass here
    'main',                // branch name
    '4b8',                 // too short (< 4)
    'a'.repeat(65),        // too long (> 64)
    '4b825dc6 42cb',       // whitespace
    '4b825dc6\n42cb',      // newline
    '',                    // empty
  ])('rejects invalid hash %j', (hash) => {
    expect(() => assertCommitHash(hash, 'hash')).toThrow();
  });

  it('rejects non-string input', () => {
    expect(() => assertCommitHash(5, 'hash')).toThrow(/non-empty string/);
  });
});

describe('assertBranchName', () => {
  // Regression: the old /[ -]/ check wrongly rejected hyphenated names,
  // which are among the most common branch names in real repos.
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
  ])('accepts valid branch name %j', (name) => {
    expect(() => assertBranchName(name, 'branch')).not.toThrow();
  });

  // Regression: the old check let control chars / git metacharacters through.
  it.each([
    '-foo',           // leading dash → parsed as a git flag
    '--force',        // leading dash
    'has space',      // space
    'line\nbreak',    // newline (control char)
    'tab\there',      // tab (control char)
    'tilde~1',        // ~ forbidden in refs
    'caret^2',        // ^ forbidden
    'colon:here',     // : forbidden
    'question?',      // ? forbidden
    'star*',          // * forbidden
    'bracket[x',      // [ forbidden
    'back\\slash',    // \ forbidden
    'dot..dot',       // .. forbidden sequence
    'at@{seq',        // @{ forbidden sequence
    'ends.lock',      // .lock suffix forbidden
    'trailing/',      // trailing slash forbidden
    'trailing.',      // trailing dot forbidden
  ])('rejects invalid branch name %j', (name) => {
    expect(() => assertBranchName(name, 'branch')).toThrow();
  });

  it('rejects non-string input', () => {
    expect(() => assertBranchName(5, 'branch')).toThrow(/non-empty string/);
  });
});
