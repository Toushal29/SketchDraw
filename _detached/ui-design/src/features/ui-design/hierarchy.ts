/** Shared parent/child and transform rules for UI Design page content. */
export type UIHierarchyNode = {
  id: string;
  parentId: string;
  order: number;
  kind: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  hidden?: boolean;
  locked?: boolean;
  clipContent?: boolean;
};

export type UIHierarchyPoint = { x: number; y: number };
export type UIHierarchyTransform = { x: number; y: number; rotation: number };

export function isHierarchyContainer(kind: string): boolean { return kind === "group" || kind === "frame" || kind === "componentInstance"; }

const radians = (degrees: number) => degrees * Math.PI / 180;
const rotate = (point: UIHierarchyPoint, degrees: number): UIHierarchyPoint => {
  const angle = radians(degrees);
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return { x: point.x * cosine - point.y * sine, y: point.x * sine + point.y * cosine };
};

function quad(index: UIHierarchyIndex<UIHierarchyNode>, id: string): UIHierarchyPoint[] | undefined {
  const node = index.get(id);
  const transform = index.worldTransform(id);
  if (!node || !transform) return undefined;
  const rotatePoint = (x: number, y: number) => {
    const point = rotate({ x, y }, transform.rotation);
    return { x: transform.x + point.x, y: transform.y + point.y };
  };
  return [rotatePoint(0, 0), rotatePoint(node.width, 0), rotatePoint(node.width, node.height), rotatePoint(0, node.height)];
}

function intersectConvex(subject: UIHierarchyPoint[], clip: UIHierarchyPoint[]): UIHierarchyPoint[] {
  if (!subject.length || clip.length < 3) return [];
  const area = clip.reduce((sum, point, i) => {
    const next = clip[(i + 1) % clip.length];
    return sum + point.x * next.y - next.x * point.y;
  }, 0);
  const orientation = area >= 0 ? 1 : -1;
  let output = subject;
  for (let i = 0; i < clip.length && output.length; i++) {
    const a = clip[i], b = clip[(i + 1) % clip.length];
    const input = output;
    output = [];
    const inside = (point: UIHierarchyPoint) => orientation * ((b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x)) >= -1e-8;
    const crossing = (start: UIHierarchyPoint, end: UIHierarchyPoint): UIHierarchyPoint => {
      const dx = end.x - start.x, dy = end.y - start.y;
      const ex = b.x - a.x, ey = b.y - a.y;
      const denominator = dx * ey - dy * ex;
      if (Math.abs(denominator) < 1e-10) return end;
      const t = ((a.x - start.x) * ey - (a.y - start.y) * ex) / denominator;
      return { x: start.x + t * dx, y: start.y + t * dy };
    };
    for (let j = 0; j < input.length; j++) {
      const current = input[j], previous = input[(j + input.length - 1) % input.length];
      const currentInside = inside(current), previousInside = inside(previous);
      if (currentInside) {
        if (!previousInside) output.push(crossing(previous, current));
        output.push(current);
      } else if (previousInside) output.push(crossing(previous, current));
    }
  }
  return output;
}

function polygonBounds(points: UIHierarchyPoint[]): { x: number; y: number; width: number; height: number } | undefined {
  if (points.length < 3) return undefined;
  const xs = points.map(point => point.x), ys = points.map(point => point.y);
  const left = Math.min(...xs), top = Math.min(...ys), right = Math.max(...xs), bottom = Math.max(...ys);
  return right - left > 1e-8 && bottom - top > 1e-8 ? { x: left, y: top, width: right - left, height: bottom - top } : undefined;
}

/** A page's flat node storage exposed as a shared, ordered hierarchy. */
export class UIHierarchyIndex<T extends UIHierarchyNode> {
  private readonly byId = new Map<string, T>();
  private readonly childIds = new Map<string, string[]>();
  private readonly transforms = new Map<string, UIHierarchyTransform>();

  constructor(readonly pageId: string, nodes: readonly T[]) {
    // Malformed/transient callers can contain duplicate ids. Keep one canonical
    // node so the layer tree and transform cache never emit duplicate rows.
    for (const node of nodes) if (!this.byId.has(node.id)) this.byId.set(node.id, node);
    for (const node of this.byId.values()) {
      const siblings = this.childIds.get(node.parentId) ?? [];
      siblings.push(node.id);
      this.childIds.set(node.parentId, siblings);
    }
    for (const ids of this.childIds.values()) ids.sort((a, b) => {
      const left = this.byId.get(a)!;
      const right = this.byId.get(b)!;
      return left.order - right.order || left.id.localeCompare(right.id);
    });
  }

  get(id: string): T | undefined { return this.byId.get(id); }
  all(): T[] { return [...this.byId.values()]; }
  children(parentId: string): T[] { return (this.childIds.get(parentId) ?? []).flatMap(id => this.byId.has(id) ? [this.byId.get(id)!] : []); }
  parent(id: string): T | undefined { const node = this.byId.get(id); return node ? this.byId.get(node.parentId) : undefined; }

  ancestors(id: string): T[] {
    const result: T[] = [];
    const visited = new Set<string>([id]);
    let parent = this.parent(id);
    while (parent && !visited.has(parent.id)) {
      result.push(parent);
      visited.add(parent.id);
      parent = this.parent(parent.id);
    }
    return result;
  }

  descendants(id: string): T[] {
    const result: T[] = [];
    const visited = new Set<string>([id]);
    const visit = (parentId: string) => {
      for (const child of this.children(parentId)) {
        if (visited.has(child.id)) continue;
        visited.add(child.id);
        result.push(child);
        visit(child.id);
      }
    };
    visit(id);
    return result;
  }

  flatten(parentId = this.pageId): T[] {
    const result: T[] = [];
    const visit = (id: string) => { for (const child of this.children(id)) { result.push(child); visit(child.id); } };
    visit(parentId);
    return result;
  }

  worldTransform(id: string): UIHierarchyTransform | undefined {
    const cached = this.transforms.get(id);
    if (cached) return cached;
    const node = this.byId.get(id);
    if (!node) return undefined;
    const parent = node.parentId === this.pageId ? { x: 0, y: 0, rotation: 0 } : this.worldTransform(node.parentId);
    if (!parent) return undefined;
    const offset = rotate({ x: node.x, y: node.y }, parent.rotation);
    const result = { x: parent.x + offset.x, y: parent.y + offset.y, rotation: parent.rotation + node.rotation };
    this.transforms.set(id, result);
    return result;
  }

  worldTransformWith(id: string, overrides: ReadonlyMap<string, Partial<UIHierarchyNode>>): UIHierarchyTransform | undefined {
    const source = this.byId.get(id);
    if (!source) return undefined;
    const node = { ...source, ...overrides.get(id) };
    const parent = node.parentId === this.pageId ? { x: 0, y: 0, rotation: 0 } : this.worldTransformWith(node.parentId, overrides);
    if (!parent) return undefined;
    const offset = rotate({ x: node.x, y: node.y }, parent.rotation);
    return { x: parent.x + offset.x, y: parent.y + offset.y, rotation: parent.rotation + node.rotation };
  }

  localToWorld(parentId: string, point: UIHierarchyPoint): UIHierarchyPoint | undefined {
    const parent = parentId === this.pageId ? { x: 0, y: 0, rotation: 0 } : this.worldTransform(parentId);
    if (!parent) return undefined;
    const offset = rotate(point, parent.rotation);
    return { x: parent.x + offset.x, y: parent.y + offset.y };
  }

  worldToLocal(parentId: string, point: UIHierarchyPoint): UIHierarchyPoint | undefined {
    const parent = parentId === this.pageId ? { x: 0, y: 0, rotation: 0 } : this.worldTransform(parentId);
    if (!parent) return undefined;
    return rotate({ x: point.x - parent.x, y: point.y - parent.y }, -parent.rotation);
  }

  canReparent(id: string, parentId: string): boolean {
    if (id === parentId || !this.byId.has(id)) return false;
    if (parentId !== this.pageId && !isHierarchyContainer(this.byId.get(parentId)?.kind ?? "")) return false;
    return !this.descendants(id).some(node => node.id === parentId);
  }

  reparent(nodeId: string, parentId: string): T | undefined {
    const node = this.byId.get(nodeId);
    if (!node || !this.canReparent(nodeId, parentId)) return undefined;
    const world = this.worldTransform(nodeId);
    const local = world && this.worldToLocal(parentId, world);
    const parent = parentId === this.pageId ? { rotation: 0 } : this.worldTransform(parentId);
    if (!world || !local || !parent) return undefined;
    return { ...node, parentId, x: local.x, y: local.y, rotation: world.rotation - parent.rotation };
  }

  hasSelectedAncestor(id: string, selectedIds: ReadonlySet<string>): boolean {
    return this.ancestors(id).some(node => selectedIds.has(node.id));
  }

  isEffectivelyHidden(id: string): boolean {
    const node = this.byId.get(id);
    return !node || node.hidden === true || this.ancestors(id).some(parent => parent.hidden === true);
  }

  isEffectivelyLocked(id: string): boolean {
    const node = this.byId.get(id);
    return !node || node.locked === true || this.ancestors(id).some(parent => parent.locked === true);
  }

  /** Returns the intersection of the node's bounds and every clipping ancestor. */
  visibleWorldBounds(id: string): { x: number; y: number; width: number; height: number } | undefined {
    if (this.isEffectivelyHidden(id)) return undefined;
    let visible = quad(this, id);
    if (!visible) return undefined;
    for (const ancestor of this.ancestors(id)) {
      if (!ancestor.clipContent) continue;
      const clip = quad(this, ancestor.id);
      if (!clip) return undefined;
      visible = intersectConvex(visible, clip);
      if (!visible.length) return undefined;
    }
    return polygonBounds(visible);
  }

  worldBounds(id: string): { x: number; y: number; width: number; height: number } | undefined {
    const node = this.byId.get(id);
    const transform = this.worldTransform(id);
    if (!node || !transform) return undefined;
    const angle = radians(transform.rotation);
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    const corners = [
      { x: 0, y: 0 }, { x: node.width, y: 0 },
      { x: node.width, y: node.height }, { x: 0, y: node.height },
    ].map(point => ({ x: transform.x + point.x * cosine - point.y * sine, y: transform.y + point.x * sine + point.y * cosine }));
    const left = Math.min(...corners.map(point => point.x));
    const top = Math.min(...corners.map(point => point.y));
    const right = Math.max(...corners.map(point => point.x));
    const bottom = Math.max(...corners.map(point => point.y));
    return { x: left, y: top, width: right - left, height: bottom - top };
  }
}

export function hierarchyIsValid<T extends UIHierarchyNode>(pageId: string, nodes: readonly T[]): boolean {
  const index = new UIHierarchyIndex(pageId, nodes);
  const ids = new Set(nodes.map(node => node.id));
  if (ids.size !== nodes.length || ids.has(pageId)) return false;
  for (const node of nodes) {
    if (node.parentId !== pageId && !isHierarchyContainer(index.get(node.parentId)?.kind ?? "")) return false;
    const ancestry = index.ancestors(node.id);
    if (ancestry.some(parent => parent.id === node.id) || ancestry.length > nodes.length) return false;
  }
  return index.flatten(pageId).length === nodes.length;
}
