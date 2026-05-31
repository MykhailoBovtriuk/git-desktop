import { describe, it, expect, vi, afterEach } from 'vitest';
import { relativeTime } from '../../src/lib/relative-time';

const FROZEN_NOW = new Date('2024-06-15T12:00:00.000Z').getTime();

/** Returns an ISO string for a moment `ms` milliseconds before the frozen "now". */
function msAgo(ms: number): string {
  return new Date(FROZEN_NOW - ms).toISOString();
}

describe('relativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FROZEN_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── future / boundary ────────────────────────────────────────────────────

  it('returns "just now" for a future date (diff < 0)', () => {
    const future = new Date(FROZEN_NOW + 5_000).toISOString();
    expect(relativeTime(future)).toBe('just now');
  });

  it('returns "just now" for exactly 0 ms ago', () => {
    expect(relativeTime(msAgo(0))).toBe('just now');
  });

  // ── secs < 60 → "just now" ───────────────────────────────────────────────

  it('returns "just now" for 30 seconds ago', () => {
    expect(relativeTime(msAgo(30_000))).toBe('just now');
  });

  it('returns "just now" for 59 seconds ago', () => {
    expect(relativeTime(msAgo(59_000))).toBe('just now');
  });

  // ── mins < 60 → Xm ago ──────────────────────────────────────────────────

  it('returns "1m ago" for exactly 60 seconds ago', () => {
    // secs=60, mins=1, hrs=0 → mins < 60 branch
    expect(relativeTime(msAgo(60_000))).toBe('1m ago');
  });

  it('returns "59m ago" for 59 minutes ago', () => {
    expect(relativeTime(msAgo(59 * 60_000))).toBe('59m ago');
  });

  it('returns "65m ago" for 65 minutes ago (floor, not rounded to hours)', () => {
    // 65 min = 3900s → secs=3900, mins=65, hrs=1 (but mins < 60 is false, hrs < 24 is true)
    // Wait — 65 mins: mins=65, so mins < 60 is FALSE → falls through to hrs branch
    // hrs = floor(65/60) = 1 → hrs < 24 → "1h ago"
    // So 65m is actually "1h ago". The boundary for Xm ago is mins=1..59 only.
    expect(relativeTime(msAgo(65 * 60_000))).toBe('1h ago');
  });

  // ── hrs < 24 → Xh ago ───────────────────────────────────────────────────

  it('returns "1h ago" for exactly 60 minutes ago', () => {
    // secs=3600, mins=60, hrs=1 → hrs < 24 → "1h ago"
    expect(relativeTime(msAgo(60 * 60_000))).toBe('1h ago');
  });

  it('returns "23h ago" for 23 hours ago', () => {
    expect(relativeTime(msAgo(23 * 60 * 60_000))).toBe('23h ago');
  });

  // ── days < 30 → Xd ago ──────────────────────────────────────────────────

  it('returns "1d ago" for exactly 24 hours ago', () => {
    expect(relativeTime(msAgo(24 * 60 * 60_000))).toBe('1d ago');
  });

  it('returns "29d ago" for 29 days ago', () => {
    expect(relativeTime(msAgo(29 * 24 * 60 * 60_000))).toBe('29d ago');
  });

  // ── months < 12 → Xmo ago ───────────────────────────────────────────────

  it('returns "1mo ago" for exactly 30 days ago', () => {
    // days=30, months=floor(30/30)=1 → months < 12 → "1mo ago"
    expect(relativeTime(msAgo(30 * 24 * 60 * 60_000))).toBe('1mo ago');
  });

  it('returns "11mo ago" for 335 days ago', () => {
    // days=335, months=floor(335/30)=11 → months < 12 → "11mo ago"
    expect(relativeTime(msAgo(335 * 24 * 60 * 60_000))).toBe('11mo ago');
  });

  // ── years ────────────────────────────────────────────────────────────────

  it('returns "1y ago" for exactly 365 days ago', () => {
    // days=365, months=floor(365/30)=12 → months < 12 is FALSE → floor(12/12)=1 → "1y ago"
    expect(relativeTime(msAgo(365 * 24 * 60 * 60_000))).toBe('1y ago');
  });

  it('returns "2y ago" for 730 days ago', () => {
    // days=730, months=floor(730/30)=24 → floor(24/12)=2 → "2y ago"
    expect(relativeTime(msAgo(730 * 24 * 60 * 60_000))).toBe('2y ago');
  });
});
