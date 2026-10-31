export const MAX_HREF_LENGTH = 2000;
export const MAX_TOOLTIP_LENGTH = 300;

/**
 * Returns a normalized link only for web and email targets. Anything else (javascript:, data:, file:, relative
 * paths) is rejected so a link in a shared .sketch file can never run code when exported or clicked.
 */
export function normalizeExternalHref(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_HREF_LENGTH || /[\u0000-\u001f\u007f\s]/.test(trimmed)) return undefined;
  try {
    const url = new URL(trimmed);
    if (url.protocol === "http:" || url.protocol === "https:") return url.host ? url.href : undefined;
    return url.protocol === "mailto:" && url.pathname ? url.href : undefined;
  } catch { return undefined; }
}

/** Link text typed by a person: adds https:// to bare domains such as example.com/docs. */
export function parseTypedHref(value: string): string | undefined {
  const text = value.trim();
  if (!text) return undefined;
  return normalizeExternalHref(text) ?? (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(text) ? normalizeExternalHref(`https://${text}`) : undefined);
}
