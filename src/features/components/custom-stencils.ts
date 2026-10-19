import type { Element } from "../../model";
import { validReferences } from "../../operations";

export type CustomStencil = { id: string; name: string; elements: Element[]; tags: string[]; preview: string };
export type PortableStencilLibrary = { format: "SketchDrawStencilLibrary"; version: 1; stencils: CustomStencil[] };
const STORAGE_KEY = "sketchdraw-custom-stencils-v1";
const MAX_STENCILS = 40;
const MAX_STENCIL_BYTES = 500_000;
const cleanTags = (value: unknown) => [...new Set((Array.isArray(value) ? value : []).filter((tag): tag is string => typeof tag === "string").map(tag => tag.trim().toLowerCase().slice(0, 32)).filter(Boolean))].slice(0, 12);
export function stencilPreviewText(elements: Element[]): string {
  const names = elements.flatMap(item => item.type === "group"
    ? [item.libraryComponent?.label, item.libraryComponent?.kind, item.note?.title].filter((value): value is string => !!value)
    : item.type === "text" ? [item.text.trim().split(/\r?\n/)[0]] : "label" in item ? [item.label?.text ?? ""] : []);
  return [...new Set(names.map(name => name.trim()).filter(Boolean))].slice(0, 3).join(" · ") || `${elements.length} objects`;
}

export function readCustomStencils(): CustomStencil[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw || raw.length > MAX_STENCIL_BYTES * MAX_STENCILS) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, MAX_STENCILS).flatMap((item): CustomStencil[] => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return [];
      const value = item as Record<string, unknown>;
      if (typeof value.id !== "string" || typeof value.name !== "string" || !Array.isArray(value.elements) || !value.elements.length) return [];
      let encoded = "";
      try { encoded = JSON.stringify(value.elements); } catch { return []; }
      const elements = value.elements as Element[];
      if (encoded.length > MAX_STENCIL_BYTES || !validReferences(elements)) return [];
      const tags = cleanTags(value.tags);
      const preview = typeof value.preview === "string" ? value.preview.slice(0, 240) : stencilPreviewText(elements);
      return [{ id: value.id.slice(0, 80), name: value.name.trim().slice(0, 80), elements, tags, preview }];
    }).filter(item => !!item.name);
  } catch { return []; }
}

export function writeCustomStencils(stencils: CustomStencil[]): boolean {
  try {
    const bounded = stencils.slice(0, MAX_STENCILS);
    if (bounded.some(item => !item.name.trim() || !item.elements.length || !validReferences(item.elements) || JSON.stringify(item.elements).length > MAX_STENCIL_BYTES)) return false;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bounded));
    return true;
  } catch { return false; }
}

export function customStencilLimits() { return { maxCount: MAX_STENCILS, maxBytesPerStencil: MAX_STENCIL_BYTES }; }

/** Serialize reusable diagram parts into a versioned file that can move between devices. */
export function exportPortableStencilLibrary(stencils: CustomStencil[]): string {
  const library: PortableStencilLibrary = { format: "SketchDrawStencilLibrary", version: 1, stencils: stencils.slice(0, MAX_STENCILS).map(stencil => ({ ...stencil, tags: cleanTags(stencil.tags), preview: stencil.preview.slice(0, 240) })) };
  if (library.stencils.some(stencil => !stencil.name.trim() || !stencil.elements.length || !validReferences(stencil.elements) || JSON.stringify(stencil.elements).length > MAX_STENCIL_BYTES)) throw new Error("The stencil library contains an invalid or oversized component.");
  const serialized = JSON.stringify(library, null, 2);
  if (serialized.length > MAX_STENCIL_BYTES * MAX_STENCILS) throw new Error("The portable stencil library exceeds the size limit.");
  return serialized + "\n";
}

/** Read a versioned portable library while rejecting malformed object references. */
export function parsePortableStencilLibrary(source: string): PortableStencilLibrary {
  if (source.length > MAX_STENCIL_BYTES * MAX_STENCILS) throw new Error("The stencil library file exceeds the size limit.");
  let parsed: unknown;
  try { parsed = JSON.parse(source); } catch { throw new Error("The stencil library is not valid JSON."); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("The stencil library has an invalid root object.");
  const root = parsed as Record<string, unknown>;
  if (root.format !== "SketchDrawStencilLibrary" || root.version !== 1 || !Array.isArray(root.stencils)) throw new Error("This SketchDraw stencil library version is not supported.");
  if (root.stencils.length > MAX_STENCILS) throw new Error(`A portable stencil library can include up to ${MAX_STENCILS} components.`);
  const stencils = root.stencils.flatMap((raw, index): CustomStencil[] => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
    const item = raw as Record<string, unknown>;
    if (typeof item.name !== "string" || !item.name.trim() || !Array.isArray(item.elements) || !item.elements.length) throw new Error(`Stencil ${index + 1} is missing its name or objects.`);
    const elements = item.elements as Element[];
    if (JSON.stringify(elements).length > MAX_STENCIL_BYTES || !validReferences(elements)) throw new Error(`Stencil “${item.name}” has invalid references or is too large.`);
    return [{ id: typeof item.id === "string" ? item.id.slice(0, 80) : crypto.randomUUID(), name: item.name.trim().slice(0, 80), elements, tags: cleanTags(item.tags), preview: typeof item.preview === "string" ? item.preview.slice(0, 240) : stencilPreviewText(elements) }];
  });
  return { format: "SketchDrawStencilLibrary", version: 1, stencils };
}
