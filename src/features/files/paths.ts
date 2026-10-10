export function normalizeFileUri(path: string): string {
  const candidate = path.trim().replace(/^(\"|')(.*)\1$/, "$2");
  if (!/^file:\/\//i.test(candidate)) return candidate.replace(/^\/([a-z]:[\\/])/i, "$1");
  try {
    const uri = new URL(candidate.replace(/^file:\/\/([a-z]:[\\/])/i, "file:///$1"));
    let pathname = decodeURIComponent(uri.pathname);
    if (uri.host && uri.host.toLowerCase() !== "localhost") pathname = `//${uri.host}${pathname}`;
    else pathname = pathname.replace(/^\/([a-z]:[\\/])/i, "$1");
    return pathname;
  } catch { return candidate; }
}

export function withSketchExtension(path: string): string {
  const normalized = normalizeFileUri(path);
  if (!isSketchPath(normalized)) throw new Error("Choose a filename ending in .sketchdraw in the save dialog.");
  return normalized;
}

export function isSketchPath(path: string): boolean {
  let decoded = normalizeFileUri(path);
  for (let pass = 0; pass < 2; pass++) {
    try { const next = decodeURIComponent(decoded); if (next === decoded) break; decoded = next; }
    catch { break; }
  }
  return decoded.trim().replace(/^(\"|')(.*)\1$/, "$2").toLowerCase().endsWith(".sketchdraw");
}

export function displayPathName(path: string): string {
  let candidate = normalizeFileUri(path).replace(/^\\\\\?\\/, "").replace(/[\\/]+$/, "");
  return candidate.split(/[\\/]/).filter(Boolean).pop() || path;
}
