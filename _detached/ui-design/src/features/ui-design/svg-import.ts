const SAFE_ELEMENTS = new Set([
  "svg", "g", "defs", "symbol", "use", "title", "desc", "metadata",
  "path", "rect", "circle", "ellipse", "line", "polyline", "polygon",
  "text", "tspan", "textpath", "image", "clippath", "mask", "pattern",
  "marker", "lineargradient", "radialgradient", "stop", "filter", "feblend",
  "fecolormatrix", "fecomponenttransfer", "fecomposite", "feconvolvematrix",
  "fediffuselighting", "fedisplacementmap", "feflood", "fegaussianblur",
  "feimage", "femerge", "femergenode", "femorphology", "feoffset", "fespecularlighting",
  "fetile", "feturbulence", "fefunca", "fefuncb", "fefuncg", "fefuncr", "style",
]);

const SAFE_STYLE_PROPERTIES = new Set([
  "alignment-baseline", "baseline-shift", "clip-path", "clip-rule", "color", "color-interpolation",
  "dominant-baseline", "fill", "fill-opacity", "fill-rule", "filter", "flood-color", "flood-opacity",
  "font-family", "font-size", "font-style", "font-variant", "font-weight", "letter-spacing", "marker-end",
  "marker-mid", "marker-start", "mask", "opacity", "paint-order", "shape-rendering", "stop-color",
  "stop-opacity", "stroke", "stroke-dasharray", "stroke-dashoffset", "stroke-linecap", "stroke-linejoin",
  "stroke-miterlimit", "stroke-opacity", "stroke-width", "text-anchor", "text-decoration", "text-rendering",
  "transform", "transform-origin", "vector-effect", "visibility", "word-spacing", "writing-mode",
]);

const SAFE_RASTER_DATA = /^data:image\/(?:png|jpeg|gif|webp);base64,[a-z\d+/]+=*$/i;
const SAFE_FRAGMENT = /^#[\w:.-]+$/;
const DANGEROUS_VALUE = /(?:javascript\s*:|vbscript\s*:|expression\s*\(|@import|behavior\s*:|-moz-binding|https?:|file:|data:text\/html)/i;

export type SanitizedSvg = { data: string; width: number; height: number };

function safeCssValue(value: string): boolean {
  if (DANGEROUS_VALUE.test(value)) return false;
  const urls = value.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/gi);
  for (const [, , target] of urls) if (!SAFE_FRAGMENT.test(target.trim())) return false;
  return true;
}

function cleanDeclarations(source: string): string {
  return source.split(";").flatMap(declaration => {
    const colon = declaration.indexOf(":");
    if (colon < 1) return [];
    const property = declaration.slice(0, colon).trim().toLowerCase();
    const value = declaration.slice(colon + 1).trim();
    return SAFE_STYLE_PROPERTIES.has(property) && value && safeCssValue(value) ? [`${property}:${value}`] : [];
  }).join(";");
}

function cleanStyleSheet(source: string): string {
  const rules = source.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g);
  const safeRules: string[] = [];
  for (const [, selectorSource, declarations] of rules) {
    const selector = selectorSource.trim();
    if (!selector || selector.startsWith("@") || !/^[\w.#*:\s,[\]>+~-]+$/.test(selector)) continue;
    const cleaned = cleanDeclarations(declarations);
    if (cleaned) safeRules.push(`${selector}{${cleaned}}`);
  }
  return safeRules.join("");
}

function pxLength(value: string | null): number | undefined {
  if (!value) return undefined;
  const match = value.trim().match(/^([\d.]+)\s*(px|pt|pc|mm|cm|in)?$/i);
  if (!match) return undefined;
  const raw = Number(match[1]);
  if (!Number.isFinite(raw) || raw <= 0) return undefined;
  const factor = ({ px: 1, pt: 96 / 72, pc: 16, mm: 96 / 25.4, cm: 96 / 2.54, in: 96 } as Record<string, number>)[(match[2] ?? "px").toLowerCase()];
  const result = raw * factor;
  return Number.isFinite(result) && result <= 1_000_000 ? result : undefined;
}

function toBase64Svg(source: string): string {
  const bytes = new TextEncoder().encode(source);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return `data:image/svg+xml;base64,${btoa(binary)}`;
}

/** Preserve SVG appearance as a single editable canvas image, after removing active/external content. */
export function sanitizeSvg(source: string): SanitizedSvg {
  if (source.length > 2_000_000) throw new Error("SVG exceeds the 2 MB import limit");
  if (/<!DOCTYPE|<!ENTITY/i.test(source)) throw new Error("SVG documents with custom entities are not supported");
  const parsed = new DOMParser().parseFromString(source, "image/svg+xml");
  const root = parsed.documentElement;
  if (parsed.querySelector("parsererror") || root.localName.toLowerCase() !== "svg") throw new Error("This file is not valid SVG");

  const viewBoxValues = root.getAttribute("viewBox")?.trim().split(/[\s,]+/).map(Number);
  const hasViewBox = !!viewBoxValues && viewBoxValues.length === 4 && viewBoxValues.every(Number.isFinite) && viewBoxValues[2] > 0 && viewBoxValues[3] > 0;
  const width = Math.max(1, Math.round(pxLength(root.getAttribute("width")) ?? (hasViewBox ? viewBoxValues![2] : 240)));
  const height = Math.max(1, Math.round(pxLength(root.getAttribute("height")) ?? (hasViewBox ? viewBoxValues![3] : 160)));
  if (!hasViewBox) root.setAttribute("viewBox", `0 0 ${width} ${height}`);
  root.setAttribute("width", String(width));
  root.setAttribute("height", String(height));

  const cleanElement = (element: Element): void => {
    if (!SAFE_ELEMENTS.has(element.localName.toLowerCase())) { element.remove(); return; }
    if (element.localName.toLowerCase() === "style") {
      const safeSheet = cleanStyleSheet(element.textContent ?? "");
      if (!safeSheet) element.remove(); else element.textContent = safeSheet;
      return;
    }
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.localName.toLowerCase();
      const value = attribute.value.trim();
      if (name.startsWith("on") || ["src", "action", "formaction"].includes(name)) { element.removeAttributeNode(attribute); continue; }
      if (name === "href") {
        if (!SAFE_FRAGMENT.test(value) && !SAFE_RASTER_DATA.test(value)) element.removeAttributeNode(attribute);
        continue;
      }
      if (name === "style") {
        const safeStyle = cleanDeclarations(value);
        if (safeStyle) attribute.value = safeStyle; else element.removeAttributeNode(attribute);
        continue;
      }
      if (DANGEROUS_VALUE.test(value) || !safeCssValue(value)) element.removeAttributeNode(attribute);
    }
    for (const child of Array.from(element.children)) cleanElement(child);
  };
  cleanElement(root);
  if (root.localName.toLowerCase() !== "svg") throw new Error("SVG root could not be sanitized");
  const serialized = new XMLSerializer().serializeToString(root);
  const data = toBase64Svg(serialized);
  if (data.length > 8_000_000) throw new Error("Sanitized SVG is too large to store in a UI Design file");
  return { data, width, height };
}
