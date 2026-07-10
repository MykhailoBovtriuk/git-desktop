// Localized "3m ago"-style timestamps. Uses Intl.RelativeTimeFormat so the
// output follows the active UI language instead of hardcoded English.

const formatters = new Map<string, Intl.RelativeTimeFormat>();

function formatterFor(locale: string): Intl.RelativeTimeFormat {
  let rtf = formatters.get(locale);
  if (!rtf) {
    try {
      rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'narrow' });
    } catch {
      // Unknown/garbled locale tag (e.g. from a corrupted language detector
      // cache) — better English than a crash in every list row.
      rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto', style: 'narrow' });
    }
    formatters.set(locale, rtf);
  }
  return rtf;
}

export function relativeTime(iso: string, locale = 'en'): string {
  const rtf = formatterFor(locale);
  const diff = Date.now() - new Date(iso).getTime();
  const secs = Math.max(0, Math.floor(diff / 1000));
  if (secs < 60) return rtf.format(0, 'second');
  const mins = Math.floor(secs / 60);
  if (mins < 60) return rtf.format(-mins, 'minute');
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return rtf.format(-hrs, 'hour');
  const days = Math.floor(hrs / 24);
  if (days < 30) return rtf.format(-days, 'day');
  const months = Math.floor(days / 30);
  if (months < 12) return rtf.format(-months, 'month');
  return rtf.format(-Math.floor(months / 12), 'year');
}
