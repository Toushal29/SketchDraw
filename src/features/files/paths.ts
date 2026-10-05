export function withSketchExtension(path: string): string {
  // Native mobile pickers return security-scoped URIs rather than ordinary
  // filesystem paths. The selected document type is enforced by the picker,
  // and its content is validated when it is opened.
  if (/^content:\/\//i.test(path)) return path;
  path = normalizeFileUri(path);
  if (!path.toLowerCase().endsWith(".sketch")) throw new Error("Choose a filename ending in .sketch in the save dialog.");
  return path;
}

export function normalizeFileUri(path: string): string {
  if (!/^file:\/\//i.test(path)) return path;
  try { return decodeURIComponent(new URL(path).pathname); } catch { return path; }
}

export function isSketchPath(path: string): boolean {
  if (/^content:\/\//i.test(path)) return true;
  const normalized = normalizeFileUri(path);
  const decoded = (() => { try { return decodeURIComponent(normalized); } catch { return normalized; } })();
  return decoded.split(/[?#]/, 1)[0].toLowerCase().endsWith(".sketch");
}

export function displayPathName(path: string): string {
  let candidate = path.trim();
  let uriPath = false;
  if (/^file:\/\//i.test(candidate)) {
    candidate = candidate.replace(/^file:\/\/([a-z]:[\\/])/i, "file:///$1");
    try { candidate = new URL(candidate).pathname; uriPath = true; } catch { /* Keep the native picker path as a fallback. */ }
  } else if (/^content:\/\//i.test(candidate)) {
    try { candidate = new URL(candidate).pathname; uriPath = true; } catch { /* Keep the provider URI as a fallback. */ }
  }
  let decoded = candidate;
  if (uriPath) {
    decoded = decoded.split(/[?#]/, 1)[0];
    try { decoded = decodeURIComponent(decoded); } catch { /* Retain malformed URI escapes as shown by the picker. */ }
  }
  decoded = decoded
    .replace(/^\\\\\?\\/, "")
    .replace(/^\/+([a-z]:[\\/])/i, "$1")
    .replace(/[\\/]+$/, "");
  return decoded.split(/[\\/]/).filter(Boolean).pop() || path;
}
