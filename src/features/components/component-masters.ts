import type { Binding, Bounds, ComponentMaster, ComponentOverrides, Element, GroupElement, Point } from "../../model";
import { elementBounds, unionBounds } from "../canvas/bounds";
import { copyElements, flatten } from "../../operations";

const DEFAULT_PORTS = (): NonNullable<ComponentMaster["connectionPoints"]> => [
  { id: "north", name: "North", anchor: { x: .5, y: 0 } },
  { id: "east", name: "East", anchor: { x: 1, y: .5 } },
  { id: "south", name: "South", anchor: { x: .5, y: 1 } },
  { id: "west", name: "West", anchor: { x: 0, y: .5 } },
];

function fitElement(item: Element, origin: Point, sx: number, sy: number): Element {
  const fontScale = Math.sqrt(Math.abs(sx * sy));
  const mapPoint = (point: Point): Point => ({ x: origin.x + point.x * sx, y: origin.y + point.y * sy });
  if (item.type === "group") {
    const note = item.note ? { ...item.note, ...(item.note.width !== undefined ? { width: item.note.width * sx } : {}), ...(item.note.height !== undefined ? { height: item.note.height * sy } : {}), ...(item.note.fontSize !== undefined ? { fontSize: Math.max(8, item.note.fontSize * fontScale) } : {}) } : undefined;
    const container = item.container?.padding !== undefined ? { ...item.container, padding: item.container.padding * fontScale } : item.container;
    const libraryComponent = item.libraryComponent?.textStyle?.fontSize !== undefined ? { ...item.libraryComponent, textStyle: { ...item.libraryComponent.textStyle, fontSize: Math.max(8, item.libraryComponent.textStyle.fontSize * fontScale) } } : item.libraryComponent;
    return {
      ...item,
      ...(item.componentBounds ? { componentBounds: { x: origin.x + item.componentBounds.x * sx, y: origin.y + item.componentBounds.y * sy, w: item.componentBounds.w * sx, h: item.componentBounds.h * sy } } : {}),
      ...(note ? { note } : {}), ...(container ? { container } : {}), ...(libraryComponent ? { libraryComponent } : {}),
      elements: item.elements.map(child => fitElement(child, origin, sx, sy)),
    };
  }
  if (item.type === "freehand") return { ...item, points: item.points.map(point => ({ ...point, ...mapPoint(point) })), thickness: Math.max(.5, item.thickness * fontScale) };
  if (item.type === "text") return { ...item, ...mapPoint(item), fontSize: Math.max(8, item.fontSize * fontScale) };
  if (item.type === "schemaTable") return { ...item, ...mapPoint(item), w: item.w * sx, h: item.h * sy, fontSize: Math.max(8, (item.fontSize ?? 12) * fontScale) };
  if (item.type === "image") return { ...item, ...mapPoint(item), w: item.w * sx, h: item.h * sy };
  const label = item.label ? { ...item.label, fontSize: Math.max(8, item.label.fontSize * fontScale), ...(item.label.offsetX !== undefined ? { offsetX: item.label.offsetX * sx } : {}), ...(item.label.offsetY !== undefined ? { offsetY: item.label.offsetY * sy } : {}) } : undefined;
  return {
    ...item,
    ...mapPoint(item), w: item.w * sx, h: item.h * sy,
    thickness: Math.max(.5, item.thickness * (item.svgNonScalingStroke ? 1 : fontScale)),
    ...(item.cornerRadius !== undefined ? { cornerRadius: item.cornerRadius * fontScale } : {}),
    ...(label ? { label } : {}),
    ...(item.routePoints ? { routePoints: item.routePoints.map(mapPoint) } : {}),
    ...(item.routeWaypoints ? { routeWaypoints: item.routeWaypoints.map(mapPoint) } : {}),
    ...(item.forkUpper ? { forkUpper: { ...item.forkUpper, ...(item.forkUpper.end ? { end: mapPoint(item.forkUpper.end) } : {}), ...(item.forkUpper.routePoints ? { routePoints: item.forkUpper.routePoints.map(mapPoint) } : {}) } } : {}),
    ...(item.forkLower ? { forkLower: { ...item.forkLower, ...(item.forkLower.end ? { end: mapPoint(item.forkLower.end) } : {}), ...(item.forkLower.routePoints ? { routePoints: item.forkLower.routePoints.map(mapPoint) } : {}) } } : {}),
  };
}

function updateFirstLabel(items: Element[], label: string): { items: Element[]; changed: boolean } {
  for (let index = 0; index < items.length; index++) {
    const item = items[index];
    if (item.type === "text") return { items: items.map((value, current) => current === index ? { ...value, text: label } : value), changed: true };
    if (item.type === "group" && item.libraryComponent) { const libraryComponent = item.libraryComponent; return { items: items.map((value, current) => current === index && value.type === "group" ? { ...value, libraryComponent: { ...libraryComponent, label } } : value), changed: true }; }
    if ((item.type === "rectangle" || item.type === "circle" || item.type === "diamond" || item.type === "triangle" || item.type === "flowchart" || item.type === "line" || item.type === "arrow" || item.type === "svgPath") && item.label) return { items: items.map((value, current) => current === index ? { ...value, label: { ...item.label!, text: label } } as Element : value), changed: true };
    if (item.type === "group") {
      const result = updateFirstLabel(item.elements, label);
      if (result.changed) return { items: items.map((value, current) => current === index ? { ...item, elements: result.items } : value), changed: true };
    }
  }
  return { items, changed: false };
}

export function componentPrimaryLabel(items: Element[]): string {
  for (const item of flatten(items)) {
    if (item.type === "text" && item.text.trim()) return item.text;
    if (item.type === "group" && item.libraryComponent?.label?.trim()) return item.libraryComponent.label;
    if ((item.type === "rectangle" || item.type === "circle" || item.type === "diamond" || item.type === "triangle" || item.type === "flowchart" || item.type === "line" || item.type === "arrow" || item.type === "svgPath") && item.label?.text.trim()) return item.label.text;
  }
  return "";
}

export function setComponentMasterLabel(master: ComponentMaster, label: string): ComponentMaster {
  const updated = updateFirstLabel(master.template, label.slice(0, 240));
  if (updated.changed) return { ...master, template: updated.items };
  const text = { type: "text" as const, id: crypto.randomUUID(), x: 8, y: 8, text: label.slice(0, 240), color: "#334155", fontSize: 16, fontFamily: "sans" as const, bold: true, textAlign: "left" as const };
  const template = [...master.template, text];
  const bounds = unionBounds(template.map(elementBounds));
  return { ...master, template, bounds: bounds ? { x: 0, y: 0, w: Math.max(master.bounds.w, bounds.w), h: Math.max(master.bounds.h, bounds.h) } : master.bounds };
}

function retainInstanceIds(items: Element[], previous: GroupElement): Element[] {
  const previousItems = flatten(previous.elements);
  const byMasterElement = new Map(previousItems.flatMap(item => item.masterElementId && item.id ? [[item.masterElementId, item] as const] : []));
  const idMap = new Map<string, string>(); const rowMap = new Map<string, string>();
  for (const item of flatten(items)) {
    const old = item.masterElementId ? byMasterElement.get(item.masterElementId) : undefined;
    if (old?.id && item.id) idMap.set(item.id, old.id);
    if (item.type === "schemaTable" && old?.type === "schemaTable") item.columns.forEach((column, index) => {
      const oldColumn = old.columns.find(candidate => candidate.name === column.name) ?? old.columns[index];
      if (oldColumn) rowMap.set(column.id, oldColumn.id);
    });
  }
  const binding = (value?: Binding) => value ? { ...value, ...(idMap.has(value.elementId) ? { elementId: idMap.get(value.elementId)! } : {}), ...(value.rowId && rowMap.has(value.rowId) ? { rowId: rowMap.get(value.rowId)! } : {}) } : undefined;
  const retain = (item: Element): Element => {
    const id = item.id ? idMap.get(item.id) ?? item.id : undefined;
    if (item.type === "group") return { ...item, id, elements: item.elements.map(retain) };
    if (item.type === "schemaTable") return { ...item, id, columns: item.columns.map(column => ({ ...column, id: rowMap.get(column.id) ?? column.id })) };
    if (item.type === "line" || item.type === "arrow") return { ...item, id, startBinding: binding(item.startBinding), endBinding: binding(item.endBinding), ...(item.forkUpper ? { forkUpper: { ...item.forkUpper, endBinding: binding(item.forkUpper.endBinding) } } : {}), ...(item.forkLower ? { forkLower: { ...item.forkLower, endBinding: binding(item.forkLower.endBinding) } } : {}) };
    return { ...item, id };
  };
  return items.map(retain);
}

export function createComponentMaster(selection: Element[], name: string): ComponentMaster | undefined {
  const bounds = unionBounds(selection.map(elementBounds));
  if (!bounds || !selection.length) return undefined;
  const tagSource = (sources: Element[], copies: Element[]): Element[] => copies.map((copy, index) => {
    const source = sources[index];
    if (!source) return copy;
    const tagged = { ...copy, ...(source.id ? { masterElementId: source.id } : {}) } as Element;
    return source.type === "group" && tagged.type === "group" ? { ...tagged, elements: tagSource(source.elements, tagged.elements) } : tagged;
  });
  const template = tagSource(selection, copyElements(selection, -bounds.x, -bounds.y));
  return { id: crypto.randomUUID(), name: name.trim().slice(0, 80) || "Component", template, bounds: { x: 0, y: 0, w: Math.max(25, bounds.w), h: Math.max(25, bounds.h) }, connectionPoints: DEFAULT_PORTS(), createdAt: Date.now() };
}

function withOverrides(items: Element[], overrides: ComponentOverrides = {}): Element[] {
  let result = items;
  if (overrides.label !== undefined) result = updateFirstLabel(result, overrides.label).items;
  const color = overrides.color; const fillColor = overrides.fillColor; const fillOpacity = overrides.fillOpacity;
  const recolor = (item: Element): Element => {
    if (item.type === "group") return { ...item, elements: item.elements.map(recolor), ...(item.libraryComponent ? { libraryComponent: { ...item.libraryComponent, ...(overrides.chartData ? { chartData: overrides.chartData } : {}), ...(overrides.formOptions ? { formOptions: overrides.formOptions } : {}), styleOverrides: { ...item.libraryComponent.styleOverrides, ...(color ? { color } : {}), ...(fillColor === null ? { fillColor: null } : fillColor ? { fillColor } : {}), ...(fillOpacity !== undefined ? { fillOpacity } : {}) } } } : {}) };
    if (item.type === "freehand" || item.type === "text") return color ? { ...item, color } : item;
    if (item.type === "schemaTable" || item.type === "image") return item;
    return { ...item, ...(color ? { color } : {}), ...(fillColor === null ? { fillColor: undefined } : fillColor ? { fillColor } : {}), ...(fillOpacity !== undefined ? { fillOpacity } : {}) };
  };
  result = result.map(recolor);
  return result;
}

export function instantiateComponentMaster(master: ComponentMaster, bounds: Bounds, overrides: ComponentOverrides = {}, variantKey?: string, id: string = crypto.randomUUID(), preserveFrom?: GroupElement): GroupElement {
  const template = variantKey && master.variants?.[variantKey] ? master.variants[variantKey] : master.template;
  const source = copyElements(template, 0, 0);
  const sx = bounds.w / Math.max(1, master.bounds.w); const sy = bounds.h / Math.max(1, master.bounds.h);
  const fittedSource = source.map(item => fitElement(item, { x: bounds.x, y: bounds.y }, sx, sy));
  const fitted = withOverrides(preserveFrom ? retainInstanceIds(fittedSource, preserveFrom) : fittedSource, overrides);
  const ports = master.connectionPoints?.map(port => ({ ...port, name: overrides.portLabels?.[port.id] ?? port.name, anchor: { ...port.anchor } }));
  return { type: "group", id, elements: fitted, componentBounds: { ...bounds }, masterId: master.id, componentOverrides: { ...overrides }, variantKey, connectionPoints: ports };
}

export function refreshComponentInstances(items: Element[], masters: ComponentMaster[]): Element[] {
  const byId = new Map(masters.map(master => [master.id, master]));
  const refresh = (item: Element): Element => {
    if (item.type !== "group") return item;
    const master = item.masterId ? byId.get(item.masterId) : undefined;
    if (master) return instantiateComponentMaster(master, item.componentBounds ?? elementBounds(item), item.componentOverrides, item.variantKey, item.id, item);
    return { ...item, elements: item.elements.map(refresh) };
  };
  return items.map(refresh);
}

export function normalizeMasterVariant(instance: GroupElement): Element[] {
  const bounds = instance.componentBounds ?? elementBounds(instance);
  return copyElements(instance.elements, -bounds.x, -bounds.y);
}

export function applyInstanceOverrides(instance: GroupElement, overrides: ComponentOverrides): GroupElement {
  return { ...instance, componentOverrides: { ...overrides }, connectionPoints: instance.connectionPoints?.map(port => ({ ...port, name: overrides.portLabels?.[port.id] ?? port.name })), elements: withOverrides(instance.elements, overrides) };
}
