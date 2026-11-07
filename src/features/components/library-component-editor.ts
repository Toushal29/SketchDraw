import type { Element, GroupElement, LibraryComponentData, Point, ShapeElement, UiComponentProperties } from "../../model";
import { elementBounds } from "../canvas/bounds";
import { svgPrimitivesToElements } from "../diagrams/svg-vectors";
import { buildLibraryComponent, buildLibraryRelationship, defaultLibraryChartData, defaultLibraryComponentFields, defaultLibraryUiComponent, LIBRARY_COMPONENTS, type LibraryComponentKind } from "./library-components";
import { modelComponentSvg } from "./model-component-renderer";
import { isUiComponentKind, migrateUiComponent, uiChoiceMinimumHeight, uiNavigationMinimumHeight } from "./ui-components";
import { componentGeometry, componentMinimumSize } from "./component-geometry";

export type LibraryComponentField = { key: string; label: string; value: string; hint?: string };

export function libraryComponentFields(group: GroupElement): LibraryComponentField[] {
  if (group.libraryComponent?.kind?.startsWith("viz-")) return [];
  if (group.componentBounds) {
    const kind = group.libraryComponent?.kind ?? "";
    if (isUiComponentKind(kind)) return [];
    return [
      { key: "label", label: "Name", value: group.libraryComponent?.label ?? LIBRARY_COMPONENTS.find(item => item.kind === kind)?.label ?? kind },
      ...(group.libraryComponent?.componentFields ?? []).map(field => ({ key: `component:${field.key}`, label: field.label, value: field.value, ...(field.hint ? { hint: field.hint } : {}) })),
    ];
  }
  const fields: LibraryComponentField[] = []; let textIndex = 0; let labelIndex = 0;
  const roleLabels: Record<string, string> = { "class-name": "Class name", "class-attributes": "Attributes", "class-methods": "Methods" };
  const visit = (items: Element[]) => items.forEach(element => {
    if (element.type === "group") { visit(element.elements); return; }
    if (element.type === "text") { textIndex += 1; fields.push({ key: element.id ?? `text-${textIndex}`, label: element.componentRole ? roleLabels[element.componentRole] ?? element.componentRole.replace(/-/g, " ") : `Text ${textIndex}`, value: element.text }); }
    if ("label" in element && element.label) { labelIndex += 1; fields.push({ key: `${element.id ?? `shape-${labelIndex}`}:label`, label: element.componentRole ? roleLabels[element.componentRole] ?? element.componentRole.replace(/-/g, " ") : `Shape label ${labelIndex}`, value: element.label.text }); }
  });
  visit(group.elements);
  return fields;
}

function mapDescendants(items: Element[], operation: (element: Element) => Element): Element[] {
  return items.map(element => operation(element.type === "group" ? { ...element, elements: mapDescendants(element.elements, operation) } : element));
}

export function setLibraryComponentField(group: GroupElement, key: string, value: string): GroupElement {
  if (group.componentBounds && key === "label" && group.libraryComponent) return { ...group, libraryComponent: { ...group.libraryComponent, label: value.slice(0, 120) } };
  if (group.componentBounds && key.startsWith("component:") && group.libraryComponent?.componentFields) {
    const fieldKey = key.slice("component:".length);
    return { ...group, libraryComponent: { ...group.libraryComponent, componentFields: group.libraryComponent.componentFields.map(field => field.key === fieldKey ? { ...field, value: value.slice(0, 2000) } : field) } };
  }
  const elements = mapDescendants(group.elements, element => {
    if (element.id === key && element.type === "text") return { ...element, text: value };
    if (key.endsWith(":label") && element.id === key.slice(0, -6) && "label" in element && element.label) return { ...element, label: { ...element.label, text: value } } as Element;
    return element;
  });
  return { ...group, elements };
}

export function setLibraryRelationshipField(connector: ShapeElement, key: string, value: string): ShapeElement {
  if (!connector.relationshipFields?.some(field => field.key === key)) return connector;
  const relationshipFields = connector.relationshipFields.map(field => field.key === key ? { ...field, value: value.slice(0, 2000) } : field);
  if (connector.componentRole !== "proposal-planning-dependency-connector") return { ...connector, relationshipFields };
  const rawType = relationshipFields.find(field => field.key === "relationship")?.value.trim().toUpperCase() ?? "FS";
  const type = ["FS", "SS", "FF", "SF"].includes(rawType) ? rawType : "FS";
  const rawLag = Number(relationshipFields.find(field => field.key === "lag")?.value ?? 0);
  const lag = Number.isFinite(rawLag) ? rawLag : 0;
  const lagLabel = lag === 0 ? "" : ` ${lag > 0 ? "+" : ""}${lag}d`;
  const label = connector.label ? { ...connector.label, text: `${type}${lagLabel}` } : undefined;
  return { ...connector, relationshipFields, ...(label ? { label } : {}) };
}

/** Upgrade child-drawn built-ins when loading a document so the current renderer owns their appearance. */
export function upgradeLegacyLibraryComponent(group: GroupElement): GroupElement | undefined {
  const kind = group.libraryComponent?.kind as LibraryComponentKind | undefined;
  const definition = kind && LIBRARY_COMPONENTS.find(item => item.kind === kind);
  if (!kind || !definition) return undefined;

  const defaults = defaultLibraryComponentFields(kind);
  if (group.componentBounds) {
    if (!defaults.length || group.container && ["diagram-frame", "diagram-swimlane"].includes(kind)) return undefined;
    const existing = group.libraryComponent?.componentFields ?? [];
    const mergedDefaults = defaults.map(field => {
      const previous = existing.find(item => item.key === field.key);
      return { ...field, ...(previous ? { ...previous, label: field.label, hint: field.hint, value: previous.value } : {}) };
    });
    const fields = [...mergedDefaults, ...existing.filter(field => !defaults.some(defaultField => defaultField.key === field.key))].slice(0, 32);
    if (fields.length === existing.length && fields.every(field => existing.some(item => item.key === field.key && item.label === field.label && item.hint === field.hint && item.value === field.value))) return undefined;
    return { ...group, libraryComponent: { ...group.libraryComponent!, componentFields: fields } };
  }
  if (group.container || !group.elements.length) return undefined;

  const fields = libraryComponentFields(group);
  const fieldValues = fields.filter(field => field.key !== "label");
  let label = group.libraryComponent?.label ?? definition.label;
  const legacyText: string[] = [];
  const legacyShapeLabels: string[] = [];
  const collectText = (items: Element[]) => items.forEach(element => {
    if (element.type === "group") collectText(element.elements);
    else if (element.type === "text") legacyText.push(element.text);
    else if ("label" in element && element.label) legacyShapeLabels.push(element.label.text);
  });
  collectText(group.elements);
  const titleField = kind === "uml-class" ? legacyText[0]
    : kind === "uml-interface" ? legacyText[1]
      : kind === "er-table" ? legacyText[0]
        : fieldValues.find(field => field.key.endsWith(":label"))?.value ?? legacyText[0];
  const customTitle = titleField?.trim() && titleField.trim() !== definition.label ? titleField.trim() : undefined;
  if ((!group.libraryComponent?.label || group.libraryComponent.label === definition.label) && customTitle) label = customTitle.slice(0, 120);

  let componentFields = group.libraryComponent?.componentFields;
  if (!componentFields?.length) {
    const legacyDefaults = kind === "uml-class"
      ? [{ key: "attributes", label: "Attributes" }, { key: "methods", label: "Methods" }]
      : kind === "uml-interface" ? [{ key: "operations", label: "Operations" }]
        : kind === "uml-enumeration" ? [{ key: "literals", label: "Literals" }]
          : kind === "er-table" ? [1, 2, 3].map(index => ({ key: `column-${index}`, label: `Column ${index}` }))
          : kind === "er-composite-attribute" ? [{ key: "sub-attribute-1", label: "Child attribute 1" }, { key: "sub-attribute-2", label: "Child attribute 2" }]
            : [];
    const oldText = legacyText;
    const values = kind === "uml-class" ? oldText.slice(1, 3)
      : kind === "uml-interface" ? oldText.slice(-1)
        : kind === "uml-enumeration" ? oldText.slice(-1)
          : kind === "er-table" ? oldText.slice(1, 4)
            : kind === "er-composite-attribute" ? legacyShapeLabels.slice(1, 3)
            : [];
    componentFields = legacyDefaults.map((field, index) => ({ ...field, value: values[index] ?? "" }));
  }

  if (defaults.length) {
    const mergedDefaults = defaults.map(field => {
      const previous = componentFields!.find(item => item.key === field.key);
      return { ...field, ...(previous ? { ...previous, label: field.label, hint: field.hint } : {}) };
    });
    componentFields = [...mergedDefaults, ...componentFields.filter(field => !defaults.some(defaultField => defaultField.key === field.key))].slice(0, 32);
  }

  return {
    ...group,
    componentBounds: elementBounds(group),
    libraryComponent: { ...group.libraryComponent, kind, label, ...(componentFields.length ? { componentFields } : {}) },
  };
}

export function resizeLibraryFont(group: GroupElement, requestedSize: number): GroupElement {
  const fontSize = Math.max(8, Math.min(160, Math.round(requestedSize)));
  const elements = mapDescendants(group.elements, element => {
    if (element.type === "text") return { ...element, fontSize };
    if ("label" in element && element.label) return { ...element, label: { ...element.label, fontSize } } as Element;
    return element;
  });
  return { ...group, elements, ...(group.libraryComponent ? { libraryComponent: { ...group.libraryComponent, textStyle: { ...group.libraryComponent.textStyle, fontSize } } } : {}) };
}

export function libraryComponentFontSize(group: GroupElement): number {
  let size = group.libraryComponent?.textStyle?.fontSize ?? 12;
  const visit = (items: Element[]) => {
    for (const element of items) {
      if (element.type === "text") { size = element.fontSize; return true; }
      if (element.type === "group" && visit(element.elements)) return true;
      if ("label" in element && element.label) { size = element.label.fontSize; return true; }
    }
    return false;
  };
  visit(group.elements);
  return Math.round(size);
}

export function libraryComponentMinimum(group: GroupElement, axis: "w" | "h"): number {
  const kind = group.libraryComponent?.kind;
  if (!kind) return 10;
  if ((kind === "ui.checkbox-group" || kind === "ui.radio-group") && axis === "h") return uiChoiceMinimumHeight(group);
  if (kind === "ui.side-navigation" && axis === "h") return uiNavigationMinimumHeight(group);
  return componentMinimumSize(kind)[axis];
}

export function assignLibraryComponentIds(group: GroupElement, kind: LibraryComponentKind, previous?: GroupElement): GroupElement {
  if (group.componentBounds) {
    const uiComponent = previous?.libraryComponent?.uiComponent ?? group.libraryComponent?.uiComponent ?? defaultLibraryUiComponent(kind);
    const metadata: LibraryComponentData = { kind, label: LIBRARY_COMPONENTS.find(item => item.kind === kind)?.label ?? String(kind), ...(defaultLibraryChartData(kind) ? { chartData: defaultLibraryChartData(kind) } : {}), ...(uiComponent ? { uiComponent } : {}), ...(kind === "network-hub" ? { portCount: 8 } : kind === "network-switch" ? { portCount: 6 } : {}) };
    return { ...group, id: previous?.id ?? group.id ?? crypto.randomUUID(), elements: [], libraryComponent: { ...metadata, ...(group.libraryComponent ?? {}), ...(previous?.libraryComponent ?? {}), ...(uiComponent ? { uiComponent } : {}), kind } };
  }
  const hasEditableText = (items: Element[]): boolean => items.some(element => element.type === "text" || "label" in element && !!element.label || element.type === "group" && hasEditableText(element.elements));
  if (!hasEditableText(group.elements) && kind !== "uml-activation") {
    const bounds = elementBounds(group); const label = LIBRARY_COMPONENTS.find(item => item.kind === kind)?.label ?? (String(kind) === "custom" ? "Group" : String(kind));
    const fontSize = Math.max(8, Math.min(12, (bounds.w - 8) / Math.max(1, label.length * .58)));
    group = { ...group, elements: [...group.elements, { type: "text", x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h + 5, text: label, color: "#344252", fontSize, fontFamily: "sans", bold: false, textAlign: "center", listType: "none" }] };
  }
  const oldIds: string[] = [];
  const collect = (items: Element[]) => items.forEach(element => { if (element.id) oldIds.push(element.id); if (element.type === "group") collect(element.elements); });
  if (previous) collect(previous.elements);
  let offset = 0;
  const addIds = (element: Element): Element => {
    const id = oldIds[offset++] ?? element.id ?? crypto.randomUUID();
    return element.type === "group" ? { ...element, id, elements: element.elements.map(addIds) } : { ...element, id } as Element;
  };
  const chartData = defaultLibraryChartData(kind);
  const uiComponent = previous?.libraryComponent?.uiComponent ?? group.libraryComponent?.uiComponent ?? defaultLibraryUiComponent(kind);
  const metadata: LibraryComponentData = { kind, ...(LIBRARY_COMPONENTS.find(item => item.kind === kind) ? { label: LIBRARY_COMPONENTS.find(item => item.kind === kind)!.label } : {}), ...(uiComponent ? { uiComponent } : {}), ...(chartData ? { chartData } : {}) };
  const sourceElements = kind === "uml-activation" ? group.elements.filter(item => item.type !== "text") : group.elements;
  return { ...group, id: previous?.id ?? group.id ?? crypto.randomUUID(), elements: sourceElements.map(addIds), libraryComponent: { ...metadata, ...(previous?.libraryComponent ?? {}), ...(uiComponent ? { uiComponent } : {}), kind } };
}

/** Rebuilds a renderer-only library group as editable primitives for old-file compatibility. */
export function restoreDirectLibraryComponent(group: GroupElement): Element[] | undefined {
  const bounds = group.componentBounds; const metadata = group.libraryComponent;
  if (!bounds || !metadata || !LIBRARY_COMPONENTS.some(item => item.kind === metadata.kind)) return undefined;
  if (group.elements.length && !group.container) {
    const legacy = { ...group };
    delete legacy.componentBounds;
    return [legacy];
  }
  const kind = metadata.kind as LibraryComponentKind;
  if (isUiComponentKind(kind)) {
    if (typeof DOMParser === "undefined") return undefined;
    const localGroup = { ...group, rotation: 0, componentBounds: { x: 0, y: 0, w: bounds.w, h: bounds.h } };
    const rotation = Number.isFinite(group.rotation) ? group.rotation : 0;
    const rotationTransform = rotation ? `<g transform="rotate(${rotation} ${bounds.w / 2} ${bounds.h / 2})">${modelComponentSvg(localGroup, "light")}</g>` : modelComponentSvg(localGroup, "light");
    const markup = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${bounds.w} ${bounds.h}">${rotationTransform}</svg>`;
    const document = new DOMParser().parseFromString(markup, "image/svg+xml");
    if (document.querySelector("parsererror")) return undefined;
    const elements = svgPrimitivesToElements(document.documentElement as unknown as SVGSVGElement, { x: bounds.x, y: bounds.y }, 1);
    if (!elements?.length) return undefined;
    const detached: GroupElement = { ...group, elements };
    delete detached.componentBounds;
    return [detached];
  }
  const relationship = buildLibraryRelationship(kind, bounds.x, bounds.y);
  if (relationship) {
    relationship.id = group.id ?? crypto.randomUUID();
    relationship.x = bounds.x;
    relationship.y = bounds.y + bounds.h / 2;
    relationship.w = bounds.w;
    relationship.rotation = group.rotation;
    if (metadata.styleOverrides?.color) relationship.color = metadata.styleOverrides.color;
    if (relationship.label && metadata.label) relationship.label = { ...relationship.label, text: metadata.label };
    return [relationship];
  }
  const restored = buildLibraryComponent(kind, bounds.x, bounds.y, {
    chartData: metadata.chartData ?? defaultLibraryChartData(kind),
    uiComponent: metadata.uiComponent ?? defaultLibraryUiComponent(kind),
    portCount: metadata.portCount,
    forceLegacyGeometry: true,
  });
  let component = assignLibraryComponentIds(restored, kind, group);
  const definition = LIBRARY_COMPONENTS.find(item => item.kind === kind)!;
  if (Math.abs(bounds.w - definition.width) > 1 || Math.abs(bounds.h - definition.height) > 1) {
    const natural = elementBounds(component);
    component = resizeLibraryGroup(component, { ...bounds, w: Math.max(1, bounds.w), h: Math.max(1, bounds.h || natural.h) });
  }
  const overrides = metadata.styleOverrides; const textStyle = metadata.textStyle;
  if (overrides || textStyle) {
    component = { ...component, elements: mapDescendants(component.elements, item => {
      if (item.type === "text") return { ...item, ...(textStyle?.color || overrides?.color ? { color: textStyle?.color ?? overrides?.color } : {}), ...(textStyle?.fontSize ? { fontSize: textStyle.fontSize } : {}), ...(textStyle?.fontFamily ? { fontFamily: textStyle.fontFamily } : {}), ...(textStyle?.bold === undefined ? {} : { bold: textStyle.bold }), ...(textStyle?.italic === undefined ? {} : { italic: textStyle.italic }), ...(textStyle?.underline === undefined ? {} : { underline: textStyle.underline }), ...(textStyle?.textAlign ? { textAlign: textStyle.textAlign } : {}) };
      if (item.type === "freehand") return { ...item, ...(overrides?.color ? { color: overrides.color } : {}) };
      if (item.type === "rectangle" || item.type === "circle" || item.type === "diamond" || item.type === "triangle" || item.type === "flowchart" || item.type === "line" || item.type === "arrow") return {
        ...item,
        ...(overrides?.color ? { color: overrides.color } : {}),
        ...(overrides && "fillColor" in overrides ? { fillColor: overrides.fillColor ?? undefined } : {}),
        ...(overrides?.fillOpacity === undefined ? {} : { fillOpacity: overrides.fillOpacity }),
        ...(item.label && (overrides?.color || textStyle) ? { label: { ...item.label, ...(textStyle?.color || overrides?.color ? { color: textStyle?.color ?? overrides?.color } : {}), ...(textStyle?.fontSize ? { fontSize: textStyle.fontSize } : {}), ...(textStyle?.fontFamily ? { fontFamily: textStyle.fontFamily } : {}), ...(textStyle?.bold === undefined ? {} : { bold: textStyle.bold }), ...(textStyle?.italic === undefined ? {} : { italic: textStyle.italic }), ...(textStyle?.underline === undefined ? {} : { underline: textStyle.underline }), ...(textStyle?.textAlign ? { textAlign: textStyle.textAlign } : {}) } } : {}),
      };
      return item;
    }) };
  }
  const savedState = { ...group };
  delete savedState.componentBounds;
  component = { ...component, ...savedState, id: group.id ?? component.id, elements: component.elements, libraryComponent: { ...component.libraryComponent, ...metadata } };
  if (kind === "uml-actor" && metadata.label) {
    const defaultLabel = definition.label;
    const updateActorLabel = (items: Element[]): Element[] => items.map(item => item.type === "group"
      ? { ...item, elements: updateActorLabel(item.elements) }
      : item.type === "text" && item.text === defaultLabel ? { ...item, text: metadata.label! } : item);
    component = { ...component, elements: updateActorLabel(component.elements) };
  }
  return [component];
}

export function libraryLifelineLength(group: GroupElement): number {
  let length = group.componentBounds ? Math.max(24, group.componentBounds.h - 34) : 200;
  const lifeline = group.libraryComponent?.kind === "uml-lifeline";
  const visit = (items: Element[]) => items.forEach(item => {
    if (item.type === "group") visit(item.elements);
    else if ((item.componentRole === "lifeline-line" || lifeline && item.type === "line" && item.lineStyle === "dashed" && Math.abs(item.w) < 1) && (item.type === "line" || item.type === "arrow")) length = Math.abs(item.h);
  });
  visit(group.elements);
  return Math.round(length);
}

export function setLibraryLifelineLength(group: GroupElement, requestedLength: number): GroupElement {
  const length = Math.max(24, Math.min(4000, Math.round(requestedLength)));
  if (group.libraryComponent?.kind === "uml-lifeline" && group.componentBounds) return { ...group, componentBounds: { ...group.componentBounds, h: length + 34 } };
  const lifeline = group.libraryComponent?.kind === "uml-lifeline";
  const resize = (items: Element[]): Element[] => items.map(item => {
    if (item.type === "group") return { ...item, elements: resize(item.elements) };
    return (item.componentRole === "lifeline-line" || lifeline && item.type === "line" && item.lineStyle === "dashed" && Math.abs(item.w) < 1) && (item.type === "line" || item.type === "arrow")
      ? { ...item, h: Math.sign(item.h || 1) * length }
      : item;
  });
  return { ...group, elements: resize(group.elements) };
}

export function setLibraryPortCount(group: GroupElement, requestedCount: number): GroupElement {
  const kind = group.libraryComponent?.kind;
  if (kind !== "network-hub" && kind !== "network-switch") return group;
  const portCount = Math.max(1, Math.min(32, Math.round(requestedCount)));
  const fontSize = libraryComponentFontSize(group);
  const bounds = elementBounds({ ...group, rotation: 0 });
  const built = buildLibraryComponent(kind, bounds.x, bounds.y, { portCount });
  const natural = elementBounds(built);
  const resized = resizeLibraryGroup(built, { x: bounds.x, y: bounds.y, w: bounds.w, h: Math.max(bounds.h, natural.h) });
  const updated = resizeLibraryFont(assignLibraryComponentIds(resized, kind, group), fontSize);
  return { ...updated, id: group.id, rotation: group.rotation, libraryComponent: { ...(updated.libraryComponent ?? {}), ...(group.libraryComponent ?? {}), kind, portCount } };
}

export function resizeLibraryGroup(group: GroupElement, bounds: { x: number; y: number; w: number; h: number }): GroupElement {
  if (group.componentBounds) {
    const kind = group.libraryComponent?.kind;
    const geometry = kind ? componentGeometry(kind, group.componentBounds.w, group.componentBounds.h) : undefined;
    let w = Math.max(bounds.w, kind ? libraryComponentMinimum(group, "w") : 25, geometry?.resize.minSize.w ?? 25);
    let h = Math.max(bounds.h, kind ? libraryComponentMinimum(group, "h") : 25, geometry?.resize.minSize.h ?? 25);
    if (geometry?.resize.aspectLock || group.aspectLocked) {
      const sourceW = Math.max(.001, group.componentBounds.w); const sourceH = Math.max(.001, group.componentBounds.h);
      const scale = Math.max(w / sourceW, h / sourceH, (geometry?.resize.minSize.w ?? 25) / sourceW, (geometry?.resize.minSize.h ?? 25) / sourceH);
      w = sourceW * scale; h = sourceH * scale;
    }
    return { ...group, componentBounds: { x: bounds.x, y: bounds.y, w, h } };
  }
  const source = elementBounds(group.libraryComponent ? { ...group, rotation: 0 } : group); const sx = Math.max(.1, bounds.w) / Math.max(1, source.w); const sy = Math.max(.1, bounds.h) / Math.max(1, source.h);
  const tx = (x: number) => bounds.x + (x - source.x) * sx; const ty = (y: number) => bounds.y + (y - source.y) * sy;
  const scalePoint = (point: Point) => ({ x: tx(point.x), y: ty(point.y) });
  const scale = (element: Element): Element => {
    if (element.type === "group") return { ...element, elements: element.elements.map(scale) };
    if (element.type === "freehand") return { ...element, points: element.points.map(scalePoint), thickness: Math.max(.5, element.thickness * (sx + sy) / 2) };
    if (element.type === "text") return { ...element, x: tx(element.x), y: ty(element.y) };
    if (element.type === "image" || element.type === "schemaTable") return { ...element, x: tx(element.x), y: ty(element.y), w: element.w * sx, h: element.h * sy };
    const x2 = tx(element.x + element.w); const y2 = ty(element.y + element.h);
    const label = element.label;
    const connectorLabels = element.type === "line" || element.type === "arrow" ? element.connectorLabels?.map(label => ({ ...label, ...(label.offsetX !== undefined ? { offsetX: label.offsetX * sx } : {}), ...(label.offsetY !== undefined ? { offsetY: label.offsetY * sy } : {}) })) : undefined;
    return { ...element, x: tx(element.x), y: ty(element.y), w: x2 - tx(element.x), h: y2 - ty(element.y), ...(label ? { label } : {}), ...(connectorLabels ? { connectorLabels } : {}), ...(element.routePoints ? { routePoints: element.routePoints.map(scalePoint) } : {}), ...(element.routeWaypoints ? { routeWaypoints: element.routeWaypoints.map(scalePoint) } : {}), ...(element.forkUpper ? { forkUpper: { ...element.forkUpper, ...(element.forkUpper.end ? { end: scalePoint(element.forkUpper.end) } : {}), ...(element.forkUpper.routePoints ? { routePoints: element.forkUpper.routePoints.map(scalePoint) } : {}) } } : {}), ...(element.forkLower ? { forkLower: { ...element.forkLower, ...(element.forkLower.end ? { end: scalePoint(element.forkLower.end) } : {}), ...(element.forkLower.routePoints ? { routePoints: element.forkLower.routePoints.map(scalePoint) } : {}) } } : {}) } as ShapeElement;
  };
  return { ...group, elements: group.elements.map(scale) };
}

export function setLibraryChartTrend(group: GroupElement, trendDirection: "up" | "down" | "steady"): GroupElement {
  if (group.libraryComponent?.kind !== "viz-kpi") return group;
  return { ...group, libraryComponent: { ...group.libraryComponent, trendDirection } };
}

export function updateUiComponentProperties(group: GroupElement, patch: Partial<UiComponentProperties>): GroupElement {
  const metadata = group.libraryComponent;
  const kind = metadata?.kind;
  if (!metadata || !kind || !isUiComponentKind(kind)) return group;
  const current = metadata.uiComponent ?? defaultLibraryUiComponent(kind);
  const migrated = migrateUiComponent(kind, { schema: 1, properties: { ...(current?.properties ?? {}), ...patch } });
  if (!migrated) return group;
  const updated: GroupElement = { ...group, libraryComponent: { ...metadata, uiComponent: migrated.uiComponent } };
  if (!updated.componentBounds) return updated;
  const minimumHeight = libraryComponentMinimum(updated, "h");
  return updated.componentBounds.h < minimumHeight ? resizeLibraryGroup(updated, { ...updated.componentBounds, h: minimumHeight }) : updated;
}

export function setUiChoiceValue(group: GroupElement, index: number): GroupElement {
  const properties = group.libraryComponent?.uiComponent?.properties;
  const item = properties?.items?.[index];
  if (!item) return group;
  if (group.libraryComponent?.kind === "ui.checkbox-group") {
    const selected = new Set(properties.selectedItemIds ?? []);
    selected.has(item.id) ? selected.delete(item.id) : selected.add(item.id);
    return updateUiComponentProperties(group, { selectedItemIds: [...selected] });
  }
  if (group.libraryComponent?.kind === "ui.radio-group" || group.libraryComponent?.kind === "ui.select") {
    return updateUiComponentProperties(group, { selectedItemId: item.id });
  }
  return group;
}

export function setUiSelectedItem(group: GroupElement, index: number): GroupElement {
  const item = group.libraryComponent?.uiComponent?.properties.items?.[index];
  return item ? updateUiComponentProperties(group, { selectedItemId: item.id }) : group;
}
