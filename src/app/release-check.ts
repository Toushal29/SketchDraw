import { isRecord } from "../features/files/parse-sketch";

export const RELEASES_API = "https://api.github.com/repos/Toushal29/SketchDraw/releases/latest";

export function compareReleaseVersions(left: string, right: string): number {
  const parse = (version: string) => {
    const match = /^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(version.trim());
    return match ? match.slice(1, 4).map(Number) : undefined;
  };
  const a = parse(left); const b = parse(right);
  if (!a || !b) throw new Error("GitHub returned a release tag that is not a three-part version.");
  for (let index = 0; index < 3; index++) if (a[index] !== b[index]) return a[index] > b[index] ? 1 : -1;
  return 0;
}

export function androidReleaseApk(release: Record<string, unknown>): { version: string; url: string } | undefined {
  if (!Array.isArray(release.assets)) return undefined;
  for (const candidate of release.assets) {
    if (!isRecord(candidate) || typeof candidate.name !== "string" || typeof candidate.browser_download_url !== "string") continue;
    const match = /^SketchDraw-Android-v(\d+\.\d+\.\d+)-arm64\.apk$/i.exec(candidate.name);
    if (match && candidate.browser_download_url.startsWith("https://github.com/Toushal29/SketchDraw/releases/download/")) {
      return { version: match[1], url: candidate.browser_download_url };
    }
  }
  return undefined;
}
