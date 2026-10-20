import type { Element, GroupElement, LibraryComponentData, Point, ShapeElement } from "../../model";
import { elementBounds } from "../canvas/bounds";
import { defaultGuiComponentProperties, guiChoiceMinimumHeight, guiNavigationMinimumHeight } from "./gui-components";
import { buildLibraryComponent, buildLibraryRelationship, defaultLibraryChartData, defaultLibraryFormOptions, defaultLibraryFormTitle, LIBRARY_COMPONENTS, type LibraryComponentKind } from "../../notes";

export type LibraryComponentField = { key: string; label: string; value: string };

export function libraryComponentFields(group: GroupElement): LibraryComponentField[] {
  if (group.libraryComponent?.kind.startsWith("viz-")) return [];
  if (group.componentBounds) {
    const kind = group.libraryComponent?.kind ?? "";
    if (kind.startsWith("form-") || kind.startsWith("gui-")) return [];
    return [{ key: "label", label: "Label", value: group.libraryComponent?.label ?? LIBRARY_COMPONENTS.find(item => item.kind === kind)?.label ?? kind }];
  }
  const fields: LibraryComponentField[] = []; let textIndex = 0; let labelIndex = 0;
  const roleLabels: Record<string, string> = { "class-name": "Class name", "class-attributes": "Attributes", "class-methods": "Methods" };
  const structuredFormKind = ["form-checkbox", "form-radio", "form-select", "form-button", "form-toggle"].includes(group.libraryComponent?.kind ?? "");
  const isStructuredFormField = (element: Element) => structuredFormKind && typeof element.componentRole === "string" && /^(?:form-checkbox-title|form-checkbox-label-\d+|form-radio-title|form-radio-label-\d+|form-select-(?:title|value)|form-button-caption|form-toggle-(?:title|state))$/.test(element.componentRole);
  const visit = (items: Element[]) => items.forEach(element => {
    if (element.type === "group") { visit(element.elements); return; }
    if (element.type === "text") { textIndex += 1; if (!isStructuredFormField(element)) fields.push({ key: element.id ?? `text-${textIndex}`, label: element.componentRole ? roleLabels[element.componentRole] ?? element.componentRole.replace(/-/g, " ") : `Text ${textIndex}`, value: element.text }); }
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
  const elements = mapDescendants(group.elements, element => {
    if (element.id === key && element.type === "text") return { ...element, text: value };
    if (key.endsWith(":label") && element.id === key.slice(0, -6) && "label" in element && element.label) return { ...element, label: { ...element.label, text: value } } as Element;
    return element;
  });
  return { ...group, elements };
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
  if (kind?.startsWith("gui-")) {
    const minimums: Record<string, { w: number; h: number }> = {
      "gui-card": { w: 120, h: 25 }, "gui-app-bar": { w: 60, h: 25 }, "gui-navigation": { w: 50, h: guiNavigationMinimumHeight(group) },
      "gui-tabs": { w: 60, h: 25 }, "gui-image": { w: 40, h: 25 },
    };
    return minimums[kind]?.[axis] ?? 10;
  }
  if (!kind?.startsWith("form-")) return 10;
  if (axis === "w") {
    if (kind === "form-button") return 50;
    if (kind === "form-toggle") return 75;
    if (kind === "form-checkbox" || kind === "form-radio") return 75;
    return 75;
  }
  if (kind === "form-checkbox" || kind === "form-radio") return guiChoiceMinimumHeight(group);
  return 25;
}

export function assignLibraryComponentIds(group: GroupElement, kind: LibraryComponentKind, previous?: GroupElement): GroupElement {
  if (group.componentBounds) {
    const guiProperties = defaultGuiComponentProperties(kind);
    const metadata: LibraryComponentData = { kind, label: LIBRARY_COMPONENTS.find(item => item.kind === kind)?.label ?? String(kind), ...(defaultLibraryFormTitle(kind) ? { formTitle: defaultLibraryFormTitle(kind) } : {}), ...(defaultLibraryFormOptions(kind) ? { formOptions: defaultLibraryFormOptions(kind) } : {}), ...(defaultLibraryChartData(kind) ? { chartData: defaultLibraryChartData(kind) } : {}), ...(guiProperties ? { guiProperties } : {}), ...(kind === "network-hub" ? { portCount: 8 } : kind === "network-switch" ? { portCount: 6 } : {}) };
    const savedGuiProperties = { ...(guiProperties ?? {}), ...(group.libraryComponent?.guiProperties ?? {}), ...(previous?.libraryComponent?.guiProperties ?? {}) };
    return { ...group, id: previous?.id ?? group.id ?? crypto.randomUUID(), elements: [], libraryComponent: { ...metadata, ...(group.libraryComponent ?? {}), ...(previous?.libraryComponent ?? {}), ...(Object.keys(savedGuiProperties).length ? { guiProperties: savedGuiProperties } : {}), kind } };
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
  const formOptions = defaultLibraryFormOptions(kind);
  const formTitle = defaultLibraryFormTitle(kind);
  const formState = kind === "form-checkbox" || kind === "form-toggle" ? true : undefined;
  const formStates = kind === "form-checkbox" ? (formOptions ?? []).map((_, index) => index === 0) : undefined;
  const selectedOption = kind === "form-radio" || kind === "form-select" || kind === "form-button" ? 0 : undefined;
  const guiProperties = defaultGuiComponentProperties(kind);
  const metadata: LibraryComponentData = { kind, ...(LIBRARY_COMPONENTS.find(item => item.kind === kind) ? { label: LIBRARY_COMPONENTS.find(item => item.kind === kind)!.label } : {}), ...(formTitle ? { formTitle } : {}), ...(formState === undefined ? {} : { formState }), ...(formStates ? { formStates } : {}), ...(selectedOption === undefined ? {} : { selectedOption }), ...(formOptions ? { formOptions } : {}), ...(guiProperties ? { guiProperties } : {}), ...(chartData ? { chartData } : {}) };
  const sourceElements = kind === "uml-activation" ? group.elements.filter(item => item.type !== "text") : group.elements;
  const savedGuiProperties = { ...(guiProperties ?? {}), ...(previous?.libraryComponent?.guiProperties ?? {}) };
  return { ...group, id: previous?.id ?? group.id ?? crypto.randomUUID(), elements: sourceElements.map(addIds), libraryComponent: { ...metadata, ...(previous?.libraryComponent ?? {}), ...(Object.keys(savedGuiProperties).length ? { guiProperties: savedGuiProperties } : {}), kind } };
}

/** Rebuilds a renderer-only library group as editable primitives for old-file compatibility. */
export function restoreDirectLibraryComponent(group: GroupElement): Element[] | undefined {
  const bounds = group.componentBounds; const metadata = group.libraryComponent;
  if (!bounds || !metadata || group.elements.length || !LIBRARY_COMPONENTS.some(item => item.kind === metadata.kind)) return undefined;
  const kind = metadata.kind as LibraryComponentKind;
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
    formOptions: metadata.formOptions ?? defaultLibraryFormOptions(kind),
    selectedOption: metadata.selectedOption,
    formStates: metadata.formStates,
    formTitle: metadata.formTitle ?? defaultLibraryFormTitle(kind),
    formState: metadata.formState,
    portCount: metadata.portCount,
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
      if (item.type === "text") return { ...item, ...(overrides?.color ? { color: overrides.color } : {}), ...(textStyle?.fontSize ? { fontSize: textStyle.fontSize } : {}), ...(textStyle?.fontFamily ? { fontFamily: textStyle.fontFamily } : {}), ...(textStyle?.bold === undefined ? {} : { bold: textStyle.bold }), ...(textStyle?.italic === undefined ? {} : { italic: textStyle.italic }), ...(textStyle?.underline === undefined ? {} : { underline: textStyle.underline }), ...(textStyle?.textAlign ? { textAlign: textStyle.textAlign } : {}) };
      if (item.type === "freehand") return { ...item, ...(overrides?.color ? { color: overrides.color } : {}) };
      if (item.type === "rectangle" || item.type === "circle" || item.type === "diamond" || item.type === "triangle" || item.type === "flowchart" || item.type === "line" || item.type === "arrow") return {
        ...item,
        ...(overrides?.color ? { color: overrides.color } : {}),
        ...(overrides && "fillColor" in overrides ? { fillColor: overrides.fillColor ?? undefined } : {}),
        ...(overrides?.fillOpacity === undefined ? {} : { fillOpacity: overrides.fillOpacity }),
        ...(item.label && (overrides?.color || textStyle) ? { label: { ...item.label, ...(overrides?.color ? { color: overrides.color } : {}), ...(textStyle?.fontSize ? { fontSize: textStyle.fontSize } : {}), ...(textStyle?.fontFamily ? { fontFamily: textStyle.fontFamily } : {}), ...(textStyle?.bold === undefined ? {} : { bold: textStyle.bold }), ...(textStyle?.italic === undefined ? {} : { italic: textStyle.italic }), ...(textStyle?.underline === undefined ? {} : { underline: textStyle.underline }), ...(textStyle?.textAlign ? { textAlign: textStyle.textAlign } : {}) } } : {}),
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
  if (group.componentBounds) return { ...group, componentBounds: { x: bounds.x, y: bounds.y, w: Math.max(.1, bounds.w), h: Math.max(.1, bounds.h) } };
  const source = elementBounds(group.libraryComponent ? { ...group, rotation: 0 } : group); const sx = Math.max(.1, bounds.w) / Math.max(1, source.w); const sy = Math.max(.1, bounds.h) / Math.max(1, source.h);
  const formFontScale = group.libraryComponent?.kind.startsWith("form-") ? Math.min(sx, sy) : 1;
  const tx = (x: number) => bounds.x + (x - source.x) * sx; const ty = (y: number) => bounds.y + (y - source.y) * sy;
  const scalePoint = (point: Point) => ({ x: tx(point.x), y: ty(point.y) });
  const scale = (element: Element): Element => {
    if (element.type === "group") return { ...element, elements: element.elements.map(scale) };
    if (element.type === "freehand") return { ...element, points: element.points.map(scalePoint), thickness: Math.max(.5, element.thickness * (sx + sy) / 2) };
    if (element.type === "text") return { ...element, x: tx(element.x), y: ty(element.y), ...(formFontScale === 1 ? {} : { fontSize: Math.max(6, element.fontSize * formFontScale) }) };
    if (element.type === "image" || element.type === "schemaTable") return { ...element, x: tx(element.x), y: ty(element.y), w: element.w * sx, h: element.h * sy };
    const x2 = tx(element.x + element.w); const y2 = ty(element.y + element.h);
    const label = element.label;
    return { ...element, x: tx(element.x), y: ty(element.y), w: x2 - tx(element.x), h: y2 - ty(element.y), ...(label ? { label } : {}), ...(element.routePoints ? { routePoints: element.routePoints.map(scalePoint) } : {}), ...(element.routeWaypoints ? { routeWaypoints: element.routeWaypoints.map(scalePoint) } : {}), ...(element.forkUpper ? { forkUpper: { ...element.forkUpper, ...(element.forkUpper.end ? { end: scalePoint(element.forkUpper.end) } : {}), ...(element.forkUpper.routePoints ? { routePoints: element.forkUpper.routePoints.map(scalePoint) } : {}) } } : {}), ...(element.forkLower ? { forkLower: { ...element.forkLower, ...(element.forkLower.end ? { end: scalePoint(element.forkLower.end) } : {}), ...(element.forkLower.routePoints ? { routePoints: element.forkLower.routePoints.map(scalePoint) } : {}) } } : {}) } as ShapeElement;
  };
  return { ...group, elements: group.elements.map(scale) };
}

export function rebuildLibraryFormOptions(group: GroupElement, options: string[], requestedOption?: number): GroupElement {
  const kind = group.libraryComponent!.kind as LibraryComponentKind;
  if (kind !== "form-radio" && kind !== "form-select" && kind !== "form-button" && kind !== "form-checkbox") return group;
  const formOptions = options.slice(0, 12).map(value => value.trim().slice(0, 120));
  if (!formOptions.length) formOptions.push("Option 1");
  const selectedOption = Math.max(0, Math.min(requestedOption ?? group.libraryComponent?.selectedOption ?? 0, formOptions.length - 1));
  const fontSize = libraryComponentFontSize(group);
  const bounds = elementBounds(group);
  const formStates = kind === "form-checkbox" ? formOptions.map((_, index) => group.libraryComponent?.formStates?.[index] ?? index === 0) : undefined;
  const formTitle = group.libraryComponent?.formTitle ?? defaultLibraryFormTitle(kind);
  if (group.componentBounds) {
    const updated = { ...group, libraryComponent: { ...group.libraryComponent!, formOptions, selectedOption, ...(formStates ? { formStates } : {}) } };
    const minimumHeight = libraryComponentMinimum(updated, "h");
    const height = Math.max(group.componentBounds.h, minimumHeight);
    return { ...updated, componentBounds: { ...group.componentBounds, h: height } };
  }
  const rebuilt = resizeLibraryFont(assignLibraryComponentIds(buildLibraryComponent(kind, bounds.x, bounds.y, { formOptions, selectedOption, formStates, formTitle }), kind, group), fontSize);
  const natural = elementBounds(rebuilt);
  const resized = resizeLibraryGroup(rebuilt, { x: bounds.x, y: bounds.y, w: bounds.w, h: natural.h });
  return { ...resized, id: group.id, libraryComponent: { ...group.libraryComponent!, formOptions, selectedOption, ...(formStates ? { formStates } : {}) } };
}

export function setLibraryFormTitle(group: GroupElement, title: string): GroupElement {
  const kind = group.libraryComponent?.kind;
  if (kind !== "form-checkbox" && kind !== "form-radio" && kind !== "form-select" && kind !== "form-toggle" && kind !== "form-input") return group;
  const formTitle = title.slice(0, 80);
  if (group.componentBounds) return { ...group, libraryComponent: { ...group.libraryComponent!, formTitle } };
  const titleRole = kind === "form-checkbox" ? "form-checkbox-title" : kind === "form-radio" ? "form-radio-title" : kind === "form-select" ? "form-select-title" : kind === "form-input" ? "form-input-title" : "form-toggle-title";
  const elements = mapDescendants(group.elements, element => element.type === "text" && element.componentRole === titleRole ? { ...element, text: formTitle } : element);
  return { ...group, elements, libraryComponent: { ...group.libraryComponent!, formTitle } };
}

export function setLibraryChartTrend(group: GroupElement, trendDirection: "up" | "down" | "steady"): GroupElement {
  if (group.libraryComponent?.kind !== "viz-kpi") return group;
  return { ...group, libraryComponent: { ...group.libraryComponent, trendDirection } };
}

export function setLibraryCheckboxOption(group: GroupElement, index: number, state: boolean): GroupElement {
  const options = group.libraryComponent?.formOptions ?? defaultLibraryFormOptions("form-checkbox") ?? [];
  if (index < 0 || index >= options.length) return group;
  const states = options.map((_, current) => group.libraryComponent?.formStates?.[current] ?? current === 0);
  states[index] = state;
  if (group.componentBounds) return { ...group, libraryComponent: { ...group.libraryComponent!, formStates: states } };
  const elements = mapDescendants(group.elements, element => {
    if (element.componentRole === `form-checkbox-box-${index}` && element.type === "rectangle") return { ...element, fillColor: state ? "#edf4ff" : "#ffffff" };
    if (element.componentRole === `form-checkbox-check-a-${index}` || element.componentRole === `form-checkbox-check-b-${index}`) return { ...element, opacity: state ? 1 : 0 };
    return element;
  });
  return { ...group, elements, libraryComponent: { ...group.libraryComponent!, formStates: states } };
}

export function setLibraryFormState(group: GroupElement, state: boolean): GroupElement {
  const kind = group.libraryComponent!.kind;
  const track = group.elements.find((item): item is ShapeElement => item.type === "rectangle" && item.w >= 35 && item.w <= 50 && item.h >= 20 && item.h <= 32);
  if (group.componentBounds) return { ...group, libraryComponent: { ...group.libraryComponent!, formState: state } };
  const elements = mapDescendants(group.elements, element => {
    if (kind === "form-toggle") {
      if (element.type === "rectangle" && element.w >= 35 && element.w <= 50 && element.h >= 20 && element.h <= 32) return { ...element, fillColor: state ? "#dcece5" : "#e6e9ed", color: state ? "#c7dfd4" : "#cbd1d8" };
      if (element.type === "circle" && element.w >= 16 && element.w <= 20 && element.h >= 16 && element.h <= 20 && track) return { ...element, x: track.x + (state ? 21 : 3), fillColor: state ? "#44a17f" : "#8b949e", color: state ? "#44a17f" : "#8b949e" };
      if (element.type === "text" && (element.componentRole === "form-toggle-state" || element.text === "Enabled" || element.text === "Disabled")) return { ...element, text: state ? "Enabled" : "Disabled" };
    }
    if (kind === "form-checkbox" && element.type === "line") return { ...element, opacity: state ? 1 : 0 };
    return element;
  });
  return { ...group, elements, libraryComponent: { ...group.libraryComponent!, formState: state } };
}

export function setLibraryRadioOption(group: GroupElement, selected: number): GroupElement {
  const rings = group.elements.filter((item): item is ShapeElement => item.type === "circle" && typeof item.componentRole === "string" && /^form-radio-option-\d+$/.test(item.componentRole));
  if (group.componentBounds) return { ...group, libraryComponent: { ...group.libraryComponent!, selectedOption: Math.max(0, Math.min((group.libraryComponent?.formOptions?.length ?? 1) - 1, selected)) } };
  if (!rings.length) return group;
  const selectedOption = Math.max(0, Math.min(rings.length - 1, selected));
  const target = rings.find(item => item.componentRole === `form-radio-option-${selectedOption}`)!;
  const elements = mapDescendants(group.elements, element => {
    if (element.type !== "circle") return element;
    const role = element.componentRole ?? "";
    if (/^form-radio-option-\d+$/.test(role)) return { ...element, color: role === `form-radio-option-${selectedOption}` ? "#4d78b8" : "#ced8e2" };
    if (/^form-radio-dot-\d+$/.test(role) && element.w <= 10 && element.h <= 10) return { ...element, x: target.x + (target.w - element.w) / 2, y: target.y + (target.h - element.h) / 2, componentRole: `form-radio-dot-${selectedOption}` };
    return element;
  });
  return { ...group, elements, libraryComponent: { ...group.libraryComponent!, selectedOption } };
}
