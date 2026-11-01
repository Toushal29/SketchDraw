import type { FontFamily } from "../../model";
import { fontCss } from "../canvas/rendering";

export const COMPONENT_FONT_FAMILY = "system-ui, 'Segoe UI', sans-serif";
let metricContext: CanvasRenderingContext2D | null | undefined;
const baselineCache = new Map<string, number>();

export function componentFontFamily(family?: FontFamily): string {
  return family ? fontCss(family) : COMPONENT_FONT_FAMILY;
}

export function componentFont(size: number, weight: number, family?: FontFamily, italic = false): string {
  return `${italic ? "italic " : ""}${weight} ${size}px ${componentFontFamily(family)}`;
}

/** Offset from a centered line position to a stable alphabetic SVG/canvas baseline. */
export function componentBaselineOffset(size: number, weight: number, family?: FontFamily, italic = false): number {
  const font = componentFont(size, weight, family, italic);
  const cached = baselineCache.get(font);
  if (cached !== undefined) return cached;
  if (typeof document !== "undefined") {
    if (metricContext === undefined) metricContext = document.createElement("canvas").getContext("2d");
    const context = metricContext;
    if (context) {
      context.font = font;
      const metrics = context.measureText("Mg");
      const ascent = Number.isFinite(metrics.fontBoundingBoxAscent) ? metrics.fontBoundingBoxAscent : metrics.actualBoundingBoxAscent;
      const descent = Number.isFinite(metrics.fontBoundingBoxDescent) ? metrics.fontBoundingBoxDescent : metrics.actualBoundingBoxDescent;
      if (Number.isFinite(ascent) && Number.isFinite(descent) && ascent + descent > 0) {
        const offset = (ascent - descent) / 2;
        if (baselineCache.size > 1024) baselineCache.clear();
        baselineCache.set(font, offset);
        return offset;
      }
    }
  }
  const fallback = size * 0.35;
  if (baselineCache.size > 1024) baselineCache.clear();
  baselineCache.set(font, fallback);
  return fallback;
}

/** Makes SVG component text match canvas measurement, removes middle-baseline dependence, and normalizes floats. */
export function normalizeComponentSvgText(svg: string, family?: FontFamily): string {
  const defaultFamily = componentFontFamily(family);
  const measured = svg.replace(/<text\b([^>]*)>([\s\S]*?)<\/text>/g, (_whole, rawAttributes: string, content: string) => {
    let attributes = rawAttributes;
    const sizeMatch = /\bfont-size="([\d.]+)"/.exec(attributes);
    const size = Math.max(9, Number(sizeMatch?.[1] ?? 12));
    const weight = Number(/\bfont-weight="(\d+)/.exec(attributes)?.[1] ?? 500);
    const italic = /\bfont-style="italic"/.test(attributes);
    const replace = (name: string, value: string) => {
      const pattern = new RegExp(`\\b${name}="[^"]*"`);
      attributes = pattern.test(attributes) ? attributes.replace(pattern, `${name}="${value}"`) : `${attributes} ${name}="${value}"`;
    };
    replace("font-size", String(size));
    replace("font-family", defaultFamily);
    const baseline = () => componentBaselineOffset(size, weight, family, italic);
    const middleBaseline = /\bdominant-baseline="middle"/.test(attributes);
    attributes = attributes.replace(/\s*dominant-baseline="[^"]*"/g, "");
    let adjustedContent = content;
    if (middleBaseline) {
      const spansHaveY = /<tspan\b[^>]*\by="[^"]*"/.test(content);
      if (spansHaveY) adjustedContent = content.replace(/<tspan\b([^>]*)>([\s\S]*?)<\/tspan>/g, (_span, spanAttributes: string, text: string) => {
        const yMatch = /\by="(-?[\d.]+)"/.exec(spanAttributes);
        if (!yMatch) return `<tspan${spanAttributes}>${text}</tspan>`;
        const nextY = Number(yMatch[1]) + baseline();
        return `<tspan${spanAttributes.replace(/\by="[^"]*"/, `y="${nextY}"`)}>${text}</tspan>`;
      });
      else {
        const yMatch = /\by="(-?[\d.]+)"/.exec(attributes);
        if (yMatch) attributes = attributes.replace(/\by="[^"]*"/, `y="${Number(yMatch[1]) + baseline()}"`);
      }
    }
    return `<text${attributes}>${adjustedContent}</text>`;
  });
  return measured.replace(/\b(d|points|x|y|x1|y1|x2|y2|cx|cy|r|rx|ry|width|height|font-size|stroke-width|stroke-dasharray|viewBox|transform)="([^"]*)"/g, (_match, _attribute: string, value: string) => {
    const rounded = value.replace(/-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi, token => {
      const number = Number(token);
      return Number.isFinite(number) ? (Math.round(number * 100) / 100).toString() : token;
    });
    return `${_attribute}="${rounded}"`;
  });
}
