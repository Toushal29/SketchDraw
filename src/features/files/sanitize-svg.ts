// Allowlist sanitizer for the inner markup of component icons (`libraryComponent.iconSvg`).
// It is DOM-free so the same check runs in the app and in Node tooling. Anything outside the
// allowlist makes the whole icon invalid, and callers fall back to the text glyph.

const ELEMENTS = new Set([
  "g", "path", "defs", "clippath", "radialgradient", "lineargradient", "stop", "polygon", "circle", "rect", "ellipse",
  "mask", "polyline", "line", "filter", "fecolormatrix", "use", "feflood", "feblend",
]);
const CANONICAL_NAMES: Record<string, string> = {
  clippath: "clipPath", radialgradient: "radialGradient", lineargradient: "linearGradient",
  fecolormatrix: "feColorMatrix", feflood: "feFlood", feblend: "feBlend",
};
const ATTRIBUTES = new Set([
  "fill", "fill-rule", "fill-opacity", "d", "clip-path", "clip-rule", "id", "cx", "cy", "r", "gradientunits", "offset",
  "stop-color", "stop-opacity", "x1", "y1", "x2", "y2", "points", "opacity", "x", "y", "width", "height", "rx", "ry",
  "gradienttransform", "style", "transform", "isolation", "stroke", "stroke-width", "stroke-miterlimit", "stroke-linecap",
  "stroke-linejoin", "stroke-opacity", "maskunits", "mask", "href", "xlink:href", "fx", "fy", "filterunits", "type",
  "values", "filter", "color-interpolation-filters", "flood-color", "flood-opacity", "result", "in", "in2", "mode",
]);
const CANONICAL_ATTRIBUTES: Record<string, string> = {
  gradientunits: "gradientUnits", gradienttransform: "gradientTransform", maskunits: "maskUnits", filterunits: "filterUnits",
};
const TAG = /<(\/?)([A-Za-z][A-Za-z0-9]*)((?:\s+[A-Za-z][A-Za-z0-9:-]*\s*=\s*(?:"[^"<>&]*"|'[^'<>&]*'))*)\s*(\/?)>/y;
const ATTRIBUTE = /([A-Za-z][A-Za-z0-9:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

// Values may only reference local fragments (`url(#id)`, `#id`); no external URLs, scripts, or CSS imports.
function safeValue(name: string, value: string): boolean {
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\\]/.test(value)) return false;
  if (name === "href" || name === "xlink:href") return /^#[\w.:-]+$/.test(value);
  const withoutLocalUrls = value.replace(/url\(\s*#[\w.:-]+\s*\)/gi, "");
  return !/url\s*\(|@import|expression|javascript:|data:|&/i.test(withoutLocalUrls);
}

export function sanitizeIconSvg(markup: string, maxLength = 100_000): string | undefined {
  if (markup.length > maxLength) return undefined;
  const out: string[] = [];
  const open: string[] = [];
  let index = 0;
  while (index < markup.length) {
    const next = markup.indexOf("<", index);
    const text = markup.slice(index, next < 0 ? markup.length : next);
    if (text.trim() !== "") return undefined;
    if (next < 0) break;
    TAG.lastIndex = next;
    const match = TAG.exec(markup);
    if (!match) return undefined;
    const [whole, closing, rawName, rawAttributes, selfClosing] = match;
    const lowerName = rawName.toLowerCase();
    if (!ELEMENTS.has(lowerName)) return undefined;
    const name = CANONICAL_NAMES[lowerName] ?? lowerName;
    if (closing) {
      if (selfClosing || rawAttributes.trim() || open.pop() !== name) return undefined;
      out.push(`</${name}>`);
    } else {
      let attributes = "";
      for (const attribute of rawAttributes.matchAll(ATTRIBUTE)) {
        const lowerAttribute = attribute[1].toLowerCase();
        const value = attribute[2] ?? attribute[3] ?? "";
        if (!ATTRIBUTES.has(lowerAttribute) || !safeValue(lowerAttribute, value)) return undefined;
        attributes += ` ${CANONICAL_ATTRIBUTES[lowerAttribute] ?? lowerAttribute}="${value}"`;
      }
      out.push(`<${name}${attributes}${selfClosing ? "/" : ""}>`);
      if (!selfClosing) open.push(name);
    }
    index = next + whole.length;
  }
  return open.length === 0 ? out.join("") : undefined;
}
