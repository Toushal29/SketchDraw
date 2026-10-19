export function withSketchExtension(path: string): string {
  // Native mobile pickers return security-scoped URIs rather than ordinary
  // filesystem paths. The selected document type is enforced by the picker,
  // and its content is validated when it is opened.
  path = path.trim().replace(/^(["'])(.*)\1$/, "$2");
  if (/^content:\/\//i.test(path)) return path;
  path = normalizeFileUri(path);
  if (!isSketchPath(path)) throw new Error("Choose a filename ending in .sketch in the save dialog.");
  return path;
}

export function withPlanningExtension(path: string): string {
  path = path.trim().replace(/^(["'])(.*)\1$/, "$2");
  if (/^content:\/\//i.test(path)) return path;
  path = normalizeFileUri(path);
  if (!isPlanningPath(path)) throw new Error("Choose a filename ending in .sdplan in the save dialog.");
  return path;
}

export function normalizeFileUri(path: string): string {
  const candidate = path.trim().replace(/^(["'])(.*)\1$/, "$2");
  if (!/^file:\/\//i.test(candidate)) return candidate.replace(/^\/([a-z]:[\\/])/i, "$1");
  try {
    const uri = new URL(candidate.replace(/^file:\/\/([a-z]:[\\/])/i, "file:///$1"));
    let pathname = decodeURIComponent(uri.pathname);
    if (uri.host && uri.host.toLowerCase() !== "localhost") pathname = `//${uri.host}${pathname}`;
    else pathname = pathname.replace(/^\/([a-z]:[\\/])/i, "$1");
    return pathname;
  } catch { return candidate; }
}

/** Canonical identity key used to merge paths reported by the web and native layers. */
export function filePathIdentity(path: string): string {
  let normalized = normalizeFileUri(path).trim();
  if (/^content:\/\//i.test(normalized)) return normalized;
  normalized = normalized.replace(/^\\\\\?\\UNC\\/i, "\\\\").replace(/^\\\\\?\\/, "");
  const isWindowsPath = /^[a-z]:[\\/]/i.test(normalized) || /^[\\/]{2}/.test(normalized);
  if (isWindowsPath) {
    const unc = /^[\\/]{2}/.test(normalized);
    normalized = normalized.replace(/[\\/]+/g, "\\").replace(/\\+$/, "");
    if (unc && !normalized.startsWith("\\\\")) normalized = `\\\\${normalized.replace(/^\\+/, "")}`;
    return normalized.toLowerCase();
  }
  return normalized.replace(/\\/g, "/").replace(/\/+$/, "");
}

/** Return a safe, readable parent path for recent-file cards. */
export function displayPathLocation(path: string): string {
  if (/^content:\/\//i.test(path)) return "Cloud drive or device folder";
  let normalized = normalizeFileUri(path)
    .replace(/^\\\\\?\\UNC\\/i, "\\\\")
    .replace(/^\\\\\?\\/, "")
    .replace(/[\\/]+$/, "");
  const separator = Math.max(normalized.lastIndexOf("\\"), normalized.lastIndexOf("/"));
  if (separator < 0) return "On this device";
  const parent = normalized.slice(0, separator);
  return parent || "On this device";
}

export function isSketchPath(path: string): boolean {
  const normalized = normalizeFileUri(path);
  if (/^content:\/\//i.test(normalized)) return true;
  let decoded = normalized;
  for (let pass = 0; pass < 2; pass++) {
    try { const next = decodeURIComponent(decoded); if (next === decoded) break; decoded = next; }
    catch { break; }
  }
  return decoded.trim().replace(/^(["'])(.*)\1$/, "$2").toLowerCase().endsWith(".sketch");
}

export function isPlanningPath(path: string): boolean {
  const normalized = normalizeFileUri(path);
  if (/^content:\/\//i.test(normalized)) return true;
  let decoded = normalized;
  for (let pass = 0; pass < 2; pass++) {
    try { const next = decodeURIComponent(decoded); if (next === decoded) break; decoded = next; }
    catch { break; }
  }
  return decoded.trim().replace(/^(["'])(.*)\1$/, "$2").toLowerCase().endsWith(".sdplan");
}

export function displayPathName(path: string): string {
  let candidate = path.trim().replace(/^(["'])(.*)\1$/, "$2");
  let uriPath = false;
  if (/^file:\/\//i.test(candidate)) {
    candidate = candidate.replace(/^file:\/\/([a-z]:[\\/])/i, "file:///$1");
    try {
      const uri = new URL(candidate);
      candidate = uri.host && uri.host.toLowerCase() !== "localhost" ? `//${uri.host}${uri.pathname}` : uri.pathname;
      uriPath = true;
    } catch { /* Keep the native picker path as a fallback. */ }
  } else if (/^content:\/\//i.test(candidate)) {
    try { candidate = new URL(candidate).pathname; uriPath = true; } catch { /* Keep the provider URI as a fallback. */ }
  }
  let decoded = candidate;
  if (uriPath) {
    decoded = decoded.split(/[?#]/, 1)[0];
    try { decoded = decodeURIComponent(decoded); } catch { /* Retain malformed URI escapes as shown by the picker. */ }
  }
  decoded = decoded
    .replace(/^\\\\\?\\UNC\\/i, "\\\\")
    .replace(/^\\\\\?\\/, "")
    .replace(/^\/+([a-z]:[\\/])/i, "$1")
    .replace(/[\\/]+$/, "");
  return decoded.split(/[\\/]/).filter(Boolean).pop() || path;
}
