/**
 * Returns the URL only if it is an absolute http(s) link, so data from the API can be
 * used as an href without allowing javascript:, data: or other script-running schemes.
 */
export function safeExternalUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}
