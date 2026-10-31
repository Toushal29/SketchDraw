import type { ArrowHead, Bounds, Element, GroupElement, Point, ShapeElement } from "../../model";
import { resolveBindings } from "../../operations";
import { LIBRARY_COMPONENTS, buildLibraryComponent, type LibraryComponentKind } from "../components/library-components";
import { elementBounds, unionBounds } from "../canvas/bounds";
import { translateElement } from "../canvas/translate";
import { parseCloudDiagram, type CloudDiagramSource, type CloudEdge } from "./cloud-dsl";

const COLUMN_GAP = 96;
const ROW_GAP = 44;
const GROUP_PADDING = 28;
const GROUP_HEADER = 26;

/** Short names people type in place of exact catalog kinds. */
const ICON_ALIASES: Record<string, string> = {
  k8s: "cloud-kubernetes", kubernetes: "cloud-kubernetes", pod: "cloud-pod", deployment: "cloud-deployment", ingress: "cloud-ingress", service: "cloud-service-discovery",
  configmap: "cloud-config-map", pv: "cloud-persistent-volume", user: "c4-person", users: "c4-person", person: "c4-person", actor: "uml-actor", server: "network-server",
  database: "cloud-relational-database", db: "cloud-relational-database", cache: "cloud-cache", queue: "cloud-message-channel", topic: "cloud-topic", cdn: "cloud-cdn",
  dns: "cloud-dns", firewall: "cloud-firewall", "load-balancer": "cloud-load-balancer", lb: "cloud-load-balancer", gateway: "cloud-api-gateway", api: "cloud-api-gateway",
  storage: "cloud-file-storage", vm: "cloud-compute-instance", compute: "cloud-compute-instance", container: "cloud-container", function: "cloud-workflow", monitoring: "cloud-monitoring",
};

/** Resolves an `icon:` value to a catalog kind: exact kind, alias, then a unique-ish suffix such as `lambda` for `aws-lambda`. */
export function resolveCloudIcon(icon: string | undefined): LibraryComponentKind | undefined {
  if (!icon) return undefined;
  const slug = icon.trim().toLowerCase().replace(/[\s_]+/g, "-");
  const exact = LIBRARY_COMPONENTS.find(item => item.kind === slug);
  if (exact) return exact.kind;
  const alias = ICON_ALIASES[slug];
  if (alias && LIBRARY_COMPONENTS.some(item => item.kind === alias)) return alias as LibraryComponentKind;
  const suffix = LIBRARY_COMPONENTS.find(item => item.kind.endsWith(`-${slug}`));
  if (suffix) return suffix.kind;
  const prefixed = LIBRARY_COMPONENTS.find(item => /^(aws|azure|gcp|cloud)-/.test(item.kind) && item.kind.includes(slug));
  return prefixed?.kind;
}

export type CloudBuildResult = { elements: Element[]; warnings: string[] };

function plainNode(id: string, name: string, label: string, color: string | undefined): ShapeElement {
  const stroke = color ?? "#3b6d8c";
  return { type: "rectangle", id, x: 0, y: 0, w: 150, h: 56, color: stroke, thickness: 2, edgeStyle: "pill", fillColor: "#ffffff", fillOpacity: 1, liveKey: name, label: { text: label, color: "#1f2933", fontSize: 14, fontFamily: "sans", textAlign: "center", verticalAlign: "middle" } };
}

function arrowHeads(arrow: CloudEdge["arrow"]): { start: ArrowHead; end: ArrowHead } {
  return arrow === "both" ? { start: "solid", end: "solid" } : arrow === "none" ? { start: "none", end: "none" } : { start: "none", end: "solid" };
}

/** Lays out parsed cloud text with real AWS, Azure, GCP, Kubernetes, and generic components and bound connectors. */
export function buildCloudDiagram(source: CloudDiagramSource, center: Point): CloudBuildResult {
  const warnings = source.errors.map(error => `Line ${error.line}: ${error.message}`);
  const down = source.direction === "down";
  const nodeElements = new Map<string, Element>();
  for (const node of source.nodes) {
    const id = `cloud-node:${node.name}`; const label = node.label ?? node.name;
    const kind = resolveCloudIcon(node.icon);
    if (node.icon && !kind) warnings.push(`Unknown icon "${node.icon}" on ${node.name}; drawn as a plain box.`);
    if (!kind) { nodeElements.set(node.name, plainNode(id, node.name, label, node.color)); continue; }
    const component = buildLibraryComponent(kind, 0, 0);
    nodeElements.set(node.name, {
      ...component, id, liveKey: node.name,
      libraryComponent: { ...component.libraryComponent!, label, ...(node.color ? { styleOverrides: { ...component.libraryComponent?.styleOverrides, color: node.color } } : {}) },
    });
  }
  // Longest-path layers; cycles stop growing after one pass per node.
  const layer = new Map(source.nodes.map(node => [node.name, 0]));
  for (let pass = 0; pass < source.nodes.length; pass++) {
    let changed = false;
    for (const edge of source.edges) {
      if (!layer.has(edge.from) || !layer.has(edge.to) || edge.from === edge.to) continue;
      const from = edge.arrow === "back" ? edge.to : edge.from; const to = edge.arrow === "back" ? edge.from : edge.to;
      const next = Math.min(source.nodes.length - 1, layer.get(from)! + 1);
      if (next > layer.get(to)!) { layer.set(to, next); changed = true; }
    }
    if (!changed) break;
  }
  const groupPath = (name: string | undefined): string[] => { const path: string[] = []; let current = name; const seen = new Set<string>(); while (current && !seen.has(current)) { seen.add(current); path.unshift(current); current = source.groups.find(group => group.name === current)?.parent; } return path; };
  const layers = new Map<number, string[]>();
  for (const node of source.nodes) layers.set(layer.get(node.name)!, [...(layers.get(layer.get(node.name)!) ?? []), node.name]);
  // Members of one group stay adjacent inside a layer so their frame stays compact.
  const groupKey = (name: string) => groupPath(source.nodes.find(node => node.name === name)?.group).join("/");
  const orderedLayers = [...layers.entries()].sort((a, b) => a[0] - b[0]).map(([, names]) => [...names].sort((a, b) => groupKey(a).localeCompare(groupKey(b)) || source.nodes.findIndex(node => node.name === a) - source.nodes.findIndex(node => node.name === b)));
  const sizeOf = (name: string) => { const box = elementBounds(nodeElements.get(name)!); return { w: box.w, h: box.h }; };
  const positions = new Map<string, Point>();
  let mainCursor = 0;
  for (const names of orderedLayers) {
    const mainSize = Math.max(...names.map(name => down ? sizeOf(name).h : sizeOf(name).w));
    const crossTotal = names.reduce((sum, name) => sum + (down ? sizeOf(name).w : sizeOf(name).h), 0) + ROW_GAP * (names.length - 1);
    let cross = -crossTotal / 2;
    for (const name of names) {
      const size = sizeOf(name);
      positions.set(name, down ? { x: cross, y: mainCursor } : { x: mainCursor, y: cross });
      cross += (down ? size.w : size.h) + ROW_GAP;
    }
    mainCursor += mainSize + COLUMN_GAP;
  }
  const placedNodes = new Map<string, Element>();
  for (const [name, element] of nodeElements) { const position = positions.get(name)!; const box = elementBounds(element); placedNodes.set(name, translateElement(element, position.x - box.x, position.y - box.y)); }

  // Groups wrap their members, innermost first.
  const groupElements = new Map<string, GroupElement>();
  const memberBounds = (name: string): Bounds | undefined => {
    const child = groupElements.get(name);
    if (child) return child.componentBounds;
    const node = placedNodes.get(name); return node ? elementBounds(node) : undefined;
  };
  const depthOfGroup = (name: string) => groupPath(name).length;
  const claimed = new Set<string>();
  for (const group of [...source.groups].sort((a, b) => depthOfGroup(b.name) - depthOfGroup(a.name))) {
    const nodeMembers = source.nodes.filter(node => node.group === group.name).map(node => node.name);
    const childGroups = source.groups.filter(candidate => candidate.parent === group.name).map(candidate => candidate.name);
    const members = [...childGroups, ...nodeMembers];
    const boxes = members.map(memberBounds).filter((box): box is Bounds => !!box);
    const union = unionBounds(boxes);
    if (!union) continue;
    const bounds: Bounds = { x: union.x - GROUP_PADDING, y: union.y - GROUP_PADDING - GROUP_HEADER, w: union.w + GROUP_PADDING * 2, h: union.h + GROUP_PADDING * 2 + GROUP_HEADER };
    const children = [...childGroups.flatMap(name => groupElements.get(name) ?? []), ...nodeMembers.flatMap(name => placedNodes.get(name) ?? [])];
    members.forEach(name => claimed.add(name));
    groupElements.set(group.name, {
      type: "group", id: `cloud-group:${group.name}`, liveKey: group.name, elements: children, componentBounds: bounds,
      container: { kind: "container", name: group.label ?? group.name, showBorder: true, showLabel: true, borderStyle: "dashed", borderThickness: 1.5, borderColor: group.color ?? "#6b7a8c", padding: GROUP_PADDING },
    });
  }
  const targetId = (name: string) => groupElements.get(name)?.id ?? placedNodes.get(name)?.id;
  const edges: Element[] = [];
  source.edges.forEach((edge, index) => {
    const reversed = edge.arrow === "back"; const from = reversed ? edge.to : edge.from; const to = reversed ? edge.from : edge.to;
    const fromId = targetId(from); const toId = targetId(to);
    if (!fromId || !toId) { warnings.push(`Connection ${edge.from} to ${edge.to} was skipped because an end is missing.`); return; }
    const heads = arrowHeads(edge.arrow);
    const backward = (layer.get(to) ?? 0) <= (layer.get(from) ?? 0) && from !== to;
    const startAnchor = down ? { x: .5, y: backward ? 0 : 1 } : { x: backward ? 0 : 1, y: .5 }; const endAnchor = down ? { x: .5, y: backward ? 1 : 0 } : { x: backward ? 1 : 0, y: .5 };
    edges.push({
      type: "arrow", id: `cloud-edge:${index}`, x: 0, y: 0, w: 1, h: 0, color: "#5b6573", thickness: 2, arrowRoute: "elbow", startHead: heads.start, endHead: heads.end,
      startBinding: { elementId: fromId, anchor: startAnchor }, endBinding: { elementId: toId, anchor: endAnchor },
      ...(edge.label ? { label: { text: edge.label, color: "#3b4654", fontSize: 12, fontFamily: "sans", textAlign: "center", verticalAlign: "top" } } : {}),
    });
  });
  const roots: Element[] = source.groups.filter(group => !group.parent).flatMap(group => groupElements.get(group.name) ?? []);
  for (const [name, element] of placedNodes) if (!claimed.has(name)) roots.push(element);
  const bounds = unionBounds(roots.map(elementBounds));
  const shift = bounds ? { x: center.x - bounds.x - bounds.w / 2, y: center.y - bounds.y - bounds.h / 2 } : { x: 0, y: 0 };
  const moved = [...roots.map(root => translateElement(root, shift.x, shift.y)), ...edges];
  return { elements: resolveBindings(moved), warnings };
}

export function cloudDiagramFromText(text: string, center: Point): CloudBuildResult { return buildCloudDiagram(parseCloudDiagram(text), center); }
