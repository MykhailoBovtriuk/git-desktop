import { describe, expect, it } from 'vitest';
import { errorMessage } from '../../src/lib/error-message';

describe('errorMessage', () => {
  it('unwraps Error instances', () => {
    expect(errorMessage(new Error('boom'))).toBe('boom');
  });

  it('stringifies everything else', () => {
    expect(errorMessage('plain')).toBe('plain');
    expect(errorMessage(42)).toBe('42');
    expect(errorMessage(undefined)).toBe('undefined');
  });
});
