

import type { Element, ShapeElement } from "../../model";

export type StructuredGraphNode = { key: string; title: string; detail?: string; kind?: string; status?: "drift" | "create" | "update" | "delete"; componentRole?: string; liveKey?: string };
export type StructuredGraphLink = { from: string; to: string; label?: string; componentRole?: string; liveKey?: string };
type GraphNode = StructuredGraphNode;
type GraphLink = StructuredGraphLink;
const makeId = (prefix: string) => `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`;
const stringValue = (value: unknown) => typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? String(value) : "";
const objectValue = (value: unknown): Record<string, unknown> | undefined => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
const titleFor = (value: Record<string, unknown>, fallback: string) => stringValue(value.name ?? value.label ?? value.title ?? value.id) || fallback;


function graphToElements(nodes: GraphNode[], links: GraphLink[], prefix: string): Element[] {
  if (!nodes.length) throw new Error("No resources or records were found in this file.");
  if (nodes.length > 500) throw new Error("A generated diagram can contain up to 500 nodes.");
  if (links.length > 2000) throw new Error("A generated diagram can contain up to 2,000 relationships.");
  if (new Set(nodes.map(node => node.key)).size !== nodes.length) throw new Error("The input contains duplicate object identifiers.");
  const columns = Math.max(1, Math.ceil(Math.sqrt(nodes.length)));
  const boxes = new Map<string, ShapeElement>();
  nodes.forEach((node, index) => {
    const details = [node.kind, node.detail].filter(Boolean).join("\n");
    const label = [node.title.slice(0, 120), details.slice(0, 1500)].filter(Boolean).join("\n");
    const width = Math.max(190, Math.min(300, 56 + Math.max(...label.split("\n").map(line => line.length), 0) * 7));
    const height = Math.max(76, 42 + label.split("\n").length * 21);
    boxes.set(node.key, {
      type: "rectangle", id: makeId(prefix), x: (index % columns) * 340, y: Math.floor(index / columns) * 240,
      ...(node.componentRole ? { componentRole: node.componentRole } : {}), ...(node.liveKey ? { liveKey: node.liveKey } : { liveKey: node.key }),
      w: width, h: height, color: node.status === "drift" || node.status === "delete" ? "#b42318" : node.status === "create" ? "#16804a" : node.status === "update" ? "#a15c00" : "#56616d", thickness: 1.6, fillColor: node.status === "drift" ? "#fff1f0" : node.status === "delete" ? "#fff5f4" : node.status === "create" ? "#effaf3" : node.status === "update" ? "#fff8e8" : "#ffffff",
      label: { text: label, color: "#202b36", fontSize: 13, fontFamily: "sans", bold: false, italic: false, underline: false, textAlign: "left", listType: "none", verticalAlign: "middle", offsetX: 10, offsetY: 2 },
    });
  });
  const anchor = (from: ShapeElement, to: ShapeElement) => {
    const dx = to.x + to.w / 2 - (from.x + from.w / 2); const dy = to.y + to.h / 2 - (from.y + from.h / 2);
    return Math.abs(dx) > Math.abs(dy) ? { x: dx > 0 ? 1 : 0, y: .5 } : { x: .5, y: dy > 0 ? 1 : 0 };
  };
  const edges: ShapeElement[] = [];
  for (const link of links) {
    const from = boxes.get(link.from); const to = boxes.get(link.to);
    if (!from || !to || from === to) continue;
    const start = anchor(from, to); const end = anchor(to, from);
    const edge: ShapeElement = {
      type: "arrow", id: makeId(`${prefix}-link`), x: from.x + from.w * start.x, y: from.y + from.h * start.y,
      w: to.x + to.w * end.x - (from.x + from.w * start.x), h: to.y + to.h * end.y - (from.y + from.h * start.y),
      color: "#718091", thickness: 1.5, startHead: "none", endHead: "solid",
      ...(link.componentRole ? { componentRole: link.componentRole } : {}), ...(link.liveKey ? { liveKey: link.liveKey } : {}),
      startBinding: { elementId: from.id!, anchor: start }, endBinding: { elementId: to.id!, anchor: end },
    };
    if (link.label) edge.label = { text: link.label.slice(0, 160), color: "#435160", fontSize: 11, fontFamily: "sans", bold: false, italic: false, underline: false, textAlign: "center", listType: "none", verticalAlign: "top" };
    edges.push(edge);
  }
  return [...edges, ...boxes.values()];
}

export { graphToElements as buildStructuredDiagram };

/** Generate editable cards from JSON graph data or record arrays. */
export function jsonToDiagram(source: string): Element[] {
  if (source.length > 5_000_000) throw new Error("JSON input is limited to 5 MB.");
  let root: unknown;
  try { root = JSON.parse(source); } catch { throw new Error("The selected JSON file is not valid JSON."); }
  const rootObject = objectValue(root);
  const explicitNodes = rootObject && Array.isArray(rootObject.nodes) ? rootObject.nodes : Array.isArray(root) ? root : undefined;
  if (explicitNodes) {
    const nodes: GraphNode[] = []; const idByString = new Map<string, string>(); const links: GraphLink[] = [];
    for (const [index, raw] of explicitNodes.entries()) {
      const item = objectValue(raw); if (!item) continue;
      const key = stringValue(item.id ?? item.key) || String(index + 1);
      if (idByString.has(key)) throw new Error(`JSON contains duplicate node ID "${key}".`);
      const title = titleFor(item, key);
      const detail = Object.entries(item).filter(([name, value]) => !["id", "key", "name", "title", "label", "from", "to", "source", "target", "edges", "links"].includes(name.toLowerCase()) && ["string", "number", "boolean"].includes(typeof value)).slice(0, 12).map(([name, value]) => `${name}: ${stringValue(value)}`).join("\n");
      const nodeKey = `json:${key}`; idByString.set(key, nodeKey); nodes.push({ key: nodeKey, title, detail });
    }
    const rawLinks = rootObject && Array.isArray(rootObject.edges) ? rootObject.edges : rootObject && Array.isArray(rootObject.links) ? rootObject.links : [];
    for (const raw of rawLinks) {
      const item = objectValue(raw); if (!item) continue;
      const from = stringValue(item.from ?? item.source); const to = stringValue(item.to ?? item.target);
      if (from && to) links.push({ from: idByString.get(from) ?? `json:${from}`, to: idByString.get(to) ?? `json:${to}`, label: stringValue(item.label ?? item.type) });
    }
    if (rootObject && Array.isArray(rootObject.nodes)) return graphToElements(nodes, links, "json");
    const keys = new Set(nodes.map(item => item.key));
    for (const raw of explicitNodes) {
      const item = objectValue(raw); if (!item) continue;
      const from = idByString.get(stringValue(item.id ?? item.key)) ?? "";
      for (const [name, value] of Object.entries(item)) {
        if (!/(?:_id|Id|Ref|Reference|Parent)$/i.test(name)) continue;
        const refs = Array.isArray(value) ? value : [value];
        for (const ref of refs) { const to = idByString.get(stringValue(ref)); if (from && to && keys.has(to)) links.push({ from, to, label: name.replace(/[_-]?id$/i, "") }); }
      }
    }
    return graphToElements(nodes, links, "json");
  }
  if (!rootObject) throw new Error("JSON must contain an array of objects or a graph object with a nodes array.");
  const collections = Object.entries(rootObject).filter(([, value]) => Array.isArray(value) && (value as unknown[]).some(item => objectValue(item)));
  if (!collections.length) throw new Error("JSON must contain a records array or a graph object with nodes and edges.");
  const nodes: GraphNode[] = []; const ids = new Map<string, string>(); const links: GraphLink[] = [];
  for (const [collection, records] of collections) for (const [index, raw] of (records as unknown[]).entries()) {
    const item = objectValue(raw); if (!item) continue;
    const rawId = stringValue(item.id ?? item.key) || `${collection}-${index + 1}`; const key = `${collection}:${rawId}`;
    const detail = Object.entries(item).filter(([name, value]) => !["id", "key", "name", "title", "label"].includes(name.toLowerCase()) && ["string", "number", "boolean"].includes(typeof value)).slice(0, 10).map(([name, value]) => `${name}: ${stringValue(value)}`).join("\n");
    ids.set(`${collection}:${rawId}`, key); ids.set(rawId, key);
    nodes.push({ key, title: titleFor(item, rawId), kind: collection, detail });
  }
  for (const [collection, records] of collections) for (const raw of records as unknown[]) {
    const item = objectValue(raw); if (!item) continue;
    const fromId = stringValue(item.id ?? item.key);
    const from = ids.get(`${collection}:${fromId}`) ?? ids.get(fromId);
    for (const [name, value] of Object.entries(item)) {
      if (!/(?:_id|Id|Ref|Reference|Parent)$/i.test(name)) continue;
      for (const ref of Array.isArray(value) ? value : [value]) { const to = ids.get(stringValue(ref)); if (from && to && from !== to) links.push({ from, to, label: name.replace(/[_-]?id$/i, "") }); }
    }
  }
  return graphToElements(nodes, links, "json");
}
