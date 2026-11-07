import type { ComponentMaster, Element, LibraryComponentData, UiComponentProperties } from "../../model";
import { defaultLibraryChartData, defaultLibraryUiComponent, LIBRARY_COMPONENTS, usesCleanModelRenderer } from "./library-components";

function compactLibraryMetadata(data: LibraryComponentData): Record<string, unknown> {
  const { label, componentFields, uiComponent, chartData, renderStyle, laneCount, portCount, ...rest } = data;
  const catalogLabel = LIBRARY_COMPONENTS.find(component => component.kind === data.kind)?.label;
  const defaultUi = defaultLibraryUiComponent(data.kind as Parameters<typeof defaultLibraryUiComponent>[0]);
  const uiProperties = uiComponent?.properties;
  const uiOverrides = uiProperties && Object.fromEntries(Object.entries(uiProperties).filter(([key, value]) => JSON.stringify(value) !== JSON.stringify(defaultUi?.properties[key as keyof UiComponentProperties])));
  const defaultChart = defaultLibraryChartData(data.kind as Parameters<typeof defaultLibraryChartData>[0]);
  const defaultPorts = data.kind === "network-hub" ? 8 : data.kind === "network-switch" ? 6 : undefined;
  const defaultLanes = data.kind === "diagram-swimlane" ? 3 : undefined;
  return {
    ...rest,
    ...(label && label !== catalogLabel ? { label } : {}),
    ...(componentFields?.some(field => field.value !== "") ? { componentFields: componentFields.filter(field => field.value !== "").map(field => ({ key: field.key, value: field.value })) } : {}),
    ...(uiComponent && (!defaultUi || uiOverrides && Object.keys(uiOverrides).length) ? { uiComponent: { schema: 1, properties: defaultUi ? uiOverrides : uiProperties } } : {}),
    ...(chartData && JSON.stringify(chartData) !== JSON.stringify(defaultChart) ? { chartData } : {}),
    ...(renderStyle && !(renderStyle === "clean" && usesCleanModelRenderer(data.kind as Parameters<typeof usesCleanModelRenderer>[0])) ? { renderStyle } : {}),
    ...(laneCount !== undefined && laneCount !== defaultLanes ? { laneCount } : {}),
    ...(portCount !== undefined && portCount !== defaultPorts ? { portCount } : {}),
  };
}

/** Removes catalog defaults while retaining the new schema and all instance edits. */
export function compactElementForStorage(element: Element): Record<string, unknown> {
  if (element.type !== "group") return element as unknown as Record<string, unknown>;
  return {
    ...element,
    ...(element.libraryComponent ? { libraryComponent: compactLibraryMetadata(element.libraryComponent) } : {}),
    elements: element.elements.map(compactElementForStorage),
    ...(element.stencilParameters ? { stencilParameters: { ...element.stencilParameters, template: element.stencilParameters.template.map(compactElementForStorage) } } : {}),
  };
}

export function compactComponentMasterForStorage(master: ComponentMaster): Record<string, unknown> {
  return {
    ...master,
    template: master.template.map(compactElementForStorage),
    ...(master.variants ? { variants: Object.fromEntries(Object.entries(master.variants).map(([key, variant]) => [key, variant.map(compactElementForStorage)])) } : {}),
  };
}
