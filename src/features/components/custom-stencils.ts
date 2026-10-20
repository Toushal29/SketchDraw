import type { ComponentMaster, Element, GroupElement } from "../../model";
import { validReferences } from "../../operations";

export type CustomStencil = { id: string; name: string; elements: Element[]; tags: string[]; preview: string; folder?: string; parameters?: string[] };
export type PortableStencilLibrary = { format: "SketchDrawStencilLibrary"; version: 2; stencils: CustomStencil[]; masters?: ComponentMaster[] };
const STORAGE_KEY = "sketchdraw-custom-stencils-v1";
const FAVORITES_KEY = "sketchdraw-custom-stencil-favorites-v1";
const RECENT_KEY = "sketchdraw-custom-stencil-recent-v1";
const MAX_STENCILS = 40;
const MAX_STENCIL_BYTES = 500_000;
const cleanTags = (value: unknown) => [...new Set((Array.isArray(value) ? value : []).filter((tag): tag is string => typeof tag === "string").map(tag => tag.trim().toLowerCase().slice(0, 32)).filter(Boolean))].slice(0, 12);
const cleanParameters = (value: unknown) => [...new Set((Array.isArray(value) ? value : []).filter((item): item is string => typeof item === "string").map(item => item.trim().slice(0, 40)).filter(item => /^[\p{L}\p{N}_ -]{1,40}$/u.test(item)))].slice(0, 12);
export function stencilPreviewText(elements: Element[]): string {
  const names = elements.flatMap(item => item.type === "group"
    ? [item.libraryComponent?.label, item.libraryComponent?.kind, item.note?.title].filter((value): value is string => !!value)
    : item.type === "text" ? [item.text.trim().split(/\r?\n/)[0]] : "label" in item ? [item.label?.text ?? ""] : []);
  return [...new Set(names.map(name => name.trim()).filter(Boolean))].slice(0, 3).join(" · ") || `${elements.length} objects`;
}

export function substituteStencilParameters(elements: Element[], parameters: string[], values: Record<string, string>): Element[] {
  const escapePattern = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const normalizedValues = Object.fromEntries(Object.entries(values).map(([key, value]) => [key.toLowerCase(), value]));
  const substitute = (source: string) => parameters.reduce((text, parameter) => text.replace(new RegExp(`\\{\\{\\s*${escapePattern(parameter)}\\s*\\}\\}`, "gi"), normalizedValues[parameter.toLowerCase()] ?? ""), source);
  const apply = (item: Element): Element => {
    if (item.type === "group") return { ...item, elements: item.elements.map(apply), ...(item.note ? { note: { ...item.note, content: substitute(item.note.content), ...(item.note.title ? { title: substitute(item.note.title) } : {}) } } : {}), ...(item.libraryComponent ? { libraryComponent: { ...item.libraryComponent, ...(item.libraryComponent.label ? { label: substitute(item.libraryComponent.label) } : {}) } } : {}) };
    if (item.type === "text") return { ...item, text: substitute(item.text) };
    if (item.type === "schemaTable") return { ...item, name: substitute(item.name) };
    if ("label" in item && item.label) return { ...item, label: { ...item.label, text: substitute(item.label.text) } };
    return item;
  };
  return elements.map(apply);
}

/** Update parameterized text on an inserted stencil while preserving its current geometry and styling. */
export function updateStencilParameter(instance: GroupElement, parameter: string, value: string): GroupElement {
  const data = instance.stencilParameters;
  if (!data || !data.parameters.includes(parameter)) return instance;
  const values = { ...data.values, [parameter.toLowerCase()]: value.slice(0, 500) };
  const replacements = new Map<string, Element>();
  const collect = (items: Element[]) => items.forEach(item => {
    if (item.id) replacements.set(item.id, item);
    if (item.type === "group") collect(item.elements);
  });
  collect(substituteStencilParameters(data.template, data.parameters, values));
  const syncText = (item: Element): Element => {
    const replacement = item.id ? replacements.get(item.id) : undefined;
    if (item.type === "group") {
      const next = { ...item, elements: item.elements.map(syncText) };
      if (replacement?.type === "group") return {
        ...next,
        ...(item.note && replacement.note ? { note: { ...item.note, content: replacement.note.content, title: replacement.note.title } } : {}),
        ...(item.libraryComponent && replacement.libraryComponent ? { libraryComponent: { ...item.libraryComponent, label: replacement.libraryComponent.label } } : {}),
      };
      return next;
    }
    if (!replacement || replacement.type !== item.type) return item;
    if (item.type === "text" && replacement.type === "text") return { ...item, text: replacement.text };
    if (item.type === "schemaTable" && replacement.type === "schemaTable") return { ...item, name: replacement.name };
    if ((item.type === "rectangle" || item.type === "circle" || item.type === "diamond" || item.type === "triangle" || item.type === "flowchart" || item.type === "line" || item.type === "arrow" || item.type === "svgPath") && "label" in replacement && replacement.label) return { ...item, label: item.label ? { ...item.label, text: replacement.label.text } : replacement.label };
    return item;
  };
  return { ...instance, elements: instance.elements.map(syncText), stencilParameters: { ...data, values } };
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
      const folder = typeof value.folder === "string" ? value.folder.trim().replace(/[\\/]+/g, " / ").slice(0, 80) : "";
      return [{ id: value.id.slice(0, 80), name: value.name.trim().slice(0, 80), elements, tags, preview, ...(folder ? { folder } : {}), ...(cleanParameters(value.parameters).length ? { parameters: cleanParameters(value.parameters) } : {}) }];
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

function readStencilIds(key: string): string[] {
  try { const value: unknown = JSON.parse(localStorage.getItem(key) ?? "[]"); return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").slice(0, 40) : []; } catch { return []; }
}
function writeStencilIds(key: string, ids: string[]) { try { localStorage.setItem(key, JSON.stringify([...new Set(ids)].slice(0, 40))); } catch { /* Usage metadata is optional when storage is full or unavailable. */ } }
export function readStencilFavorites() { return readStencilIds(FAVORITES_KEY); }
export function writeStencilFavorites(ids: string[]) { writeStencilIds(FAVORITES_KEY, ids); }
export function readRecentStencils() { return readStencilIds(RECENT_KEY); }
export function rememberRecentStencil(id: string) { writeStencilIds(RECENT_KEY, [id, ...readStencilIds(RECENT_KEY).filter(value => value !== id)]); }

/** Serialize reusable diagram parts into a versioned file that can move between devices. */
export function exportPortableStencilLibrary(stencils: CustomStencil[], masters: ComponentMaster[] = []): string {
  if (masters.length > 100 || masters.some(master => !master.name.trim() || !master.template.length || !validReferences(master.template) || !Number.isFinite(master.bounds.w) || !Number.isFinite(master.bounds.h) || master.bounds.w <= 0 || master.bounds.h <= 0 || JSON.stringify(master).length > MAX_STENCIL_BYTES)) throw new Error("The component library contains an invalid or oversized master.");
  const library: PortableStencilLibrary = { format: "SketchDrawStencilLibrary", version: 2, stencils: stencils.slice(0, MAX_STENCILS).map(stencil => ({ ...stencil, tags: cleanTags(stencil.tags), preview: stencil.preview.slice(0, 240), ...(stencil.folder?.trim() ? { folder: stencil.folder.trim().replace(/[\\/]+/g, " / ").slice(0, 80) } : {}), ...(cleanParameters(stencil.parameters).length ? { parameters: cleanParameters(stencil.parameters) } : {}) })), ...(masters.length ? { masters: masters.slice(0, 100) } : {}) };
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
  if (root.format !== "SketchDrawStencilLibrary" || (root.version !== 1 && root.version !== 2) || !Array.isArray(root.stencils)) throw new Error("This SketchDraw stencil library version is not supported.");
  if (root.stencils.length > MAX_STENCILS) throw new Error(`A portable stencil library can include up to ${MAX_STENCILS} components.`);
  const stencils = root.stencils.flatMap((raw, index): CustomStencil[] => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
    const item = raw as Record<string, unknown>;
    if (typeof item.name !== "string" || !item.name.trim() || !Array.isArray(item.elements) || !item.elements.length) throw new Error(`Stencil ${index + 1} is missing its name or objects.`);
    const elements = item.elements as Element[];
    if (JSON.stringify(elements).length > MAX_STENCIL_BYTES || !validReferences(elements)) throw new Error(`Stencil “${item.name}” has invalid references or is too large.`);
    const folder = typeof item.folder === "string" ? item.folder.trim().replace(/[\\/]+/g, " / ").slice(0, 80) : "";
    return [{ id: typeof item.id === "string" ? item.id.slice(0, 80) : crypto.randomUUID(), name: item.name.trim().slice(0, 80), elements, tags: cleanTags(item.tags), preview: typeof item.preview === "string" ? item.preview.slice(0, 240) : stencilPreviewText(elements), ...(folder ? { folder } : {}), ...(cleanParameters(item.parameters).length ? { parameters: cleanParameters(item.parameters) } : {}) }];
  });
  const masters = root.version === 2 && Array.isArray(root.masters) ? root.masters.flatMap((raw, index): ComponentMaster[] => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
    const item = raw as Record<string, unknown>;
    if (typeof item.id !== "string" || typeof item.name !== "string" || !item.name.trim() || !Array.isArray(item.template) || !item.template.length || !isValidBounds(item.bounds)) throw new Error(`Component master ${index + 1} is invalid.`);
    const template = item.template as Element[];
    if (JSON.stringify(template).length > MAX_STENCIL_BYTES || !validReferences(template)) throw new Error(`Component master “${item.name}” has invalid references or is too large.`);
    const variants = item.variants && typeof item.variants === "object" && !Array.isArray(item.variants) ? Object.fromEntries(Object.entries(item.variants as Record<string, unknown>).filter(([key, value]) => /^[\p{L}\p{N}_.=-]{1,80}$/u.test(key) && Array.isArray(value) && (value as Element[]).length > 0 && JSON.stringify(value).length <= MAX_STENCIL_BYTES && validReferences(value as Element[])).slice(0, 24)) as Record<string, Element[]> : undefined;
    return [{ id: item.id.slice(0, 80), name: item.name.trim().slice(0, 80), template, bounds: item.bounds, ...(variants && Object.keys(variants).length ? { variants } : {}), ...(typeof item.variantKey === "string" ? { variantKey: item.variantKey.slice(0, 80) } : {}), ...(Array.isArray(item.connectionPoints) ? { connectionPoints: item.connectionPoints.slice(0, 32) as ComponentMaster["connectionPoints"] } : {}), ...(typeof item.createdAt === "number" && Number.isFinite(item.createdAt) ? { createdAt: item.createdAt } : {}) }];
  }) : [];
  if (masters.length > 100) throw new Error("A portable library can include up to 100 component masters.");
  return { format: "SketchDrawStencilLibrary", version: 2, stencils, ...(masters.length ? { masters } : {}) };
}

function isValidBounds(value: unknown): value is ComponentMaster["bounds"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const bounds = value as Record<string, unknown>;
  return [bounds.x, bounds.y, bounds.w, bounds.h].every(item => typeof item === "number" && Number.isFinite(item)) && (bounds.w as number) > 0 && (bounds.h as number) > 0;
}
