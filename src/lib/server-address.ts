export type ServerAddressError = 'invalid' | 'insecure';

export function parseServerAddress(
  raw: string,
): { host: string; error?: undefined } | { host?: undefined; error: ServerAddressError } {
  const text = raw.trim();
  if (!text) return { error: 'invalid' };
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return { error: 'invalid' };
  }
  if (url.protocol === 'http:') return { error: 'insecure' };
  if (url.protocol !== 'https:' || url.username || url.password) return { error: 'invalid' };
  const host = url.host.toLowerCase().replace(/\.(?=:|$)/, '');
  if (!/^[a-z0-9.-]+(:\d+)?$/.test(host) || !host.includes('.')) return { error: 'invalid' };
  return { host };
}
