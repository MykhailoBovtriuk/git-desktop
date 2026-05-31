import { describe, it, expect } from 'vitest';
import { cn } from '../../../src/shared/ui/cn';

describe('cn', () => {
  it('joins two strings with a space', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('filters out false', () => {
    expect(cn('foo', false, 'bar')).toBe('foo bar');
  });

  it('filters out null', () => {
    expect(cn('foo', null, 'bar')).toBe('foo bar');
  });

  it('filters out undefined', () => {
    expect(cn('foo', undefined, 'bar')).toBe('foo bar');
  });

  it('filters out empty string', () => {
    // filter(Boolean) treats '' as falsy
    expect(cn('foo', '', 'bar')).toBe('foo bar');
  });

  it('returns empty string when called with no arguments', () => {
    expect(cn()).toBe('');
  });

  it('returns the string unchanged when given a single string', () => {
    expect(cn('hello')).toBe('hello');
  });

  it('returns empty string when all arguments are falsy', () => {
    expect(cn(false, null, undefined, '')).toBe('');
  });

  it('joins only the truthy strings when mixed with falsy values', () => {
    expect(cn('a', false, 'b', null, 'c', undefined, '')).toBe('a b c');
  });
});
