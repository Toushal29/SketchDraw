import type { ComponentMaster, Element, LibraryComponentData } from "../../model";
import { defaultLibraryChartData, defaultLibraryFormOptions, defaultLibraryFormTitle, LIBRARY_COMPONENTS, usesCleanModelRenderer } from "./library-components";
import { defaultGuiComponentProperties } from "./gui-components";

function compactLibraryMetadata(data: LibraryComponentData): Record<string, unknown> {
  const { label, componentFields, guiProperties, chartData, formOptions, formTitle, renderStyle, laneCount, portCount, formState, selectedOption, ...rest } = data;
  const catalogLabel = LIBRARY_COMPONENTS.find(component => component.kind === data.kind)?.label;
  const defaultGui = defaultGuiComponentProperties(data.kind) ?? {};
  const guiOverrides = guiProperties && Object.fromEntries(Object.entries(guiProperties).filter(([key, value]) => JSON.stringify(value) !== JSON.stringify(defaultGui[key as keyof typeof defaultGui])));
  const defaultChart = defaultLibraryChartData(data.kind as Parameters<typeof defaultLibraryChartData>[0]);
  const defaultOptions = defaultLibraryFormOptions(data.kind as Parameters<typeof defaultLibraryFormOptions>[0]);
  const defaultTitle = defaultLibraryFormTitle(data.kind as Parameters<typeof defaultLibraryFormTitle>[0]);
  const defaultPorts = data.kind === "network-hub" ? 8 : data.kind === "network-switch" ? 6 : undefined;
  const defaultLanes = data.kind === "diagram-swimlane" ? 3 : undefined;
  return {
    ...rest,
    ...(label && label !== catalogLabel ? { label } : {}),
    ...(componentFields?.some(field => field.value !== "") ? { componentFields: componentFields.filter(field => field.value !== "").map(field => ({ key: field.key, value: field.value })) } : {}),
    ...(guiOverrides && Object.keys(guiOverrides).length ? { guiProperties: guiOverrides } : {}),
    ...(chartData && JSON.stringify(chartData) !== JSON.stringify(defaultChart) ? { chartData } : {}),
    ...(formOptions && JSON.stringify(formOptions) !== JSON.stringify(defaultOptions) ? { formOptions } : {}),
    ...(formTitle && formTitle !== defaultTitle ? { formTitle } : {}),
    ...(renderStyle && !(renderStyle === "clean" && usesCleanModelRenderer(data.kind as Parameters<typeof usesCleanModelRenderer>[0])) ? { renderStyle } : {}),
    ...(laneCount !== undefined && laneCount !== defaultLanes ? { laneCount } : {}),
    ...(portCount !== undefined && portCount !== defaultPorts ? { portCount } : {}),
    ...(formState !== undefined && formState !== true ? { formState } : {}),
    ...(selectedOption !== undefined && selectedOption !== 0 ? { selectedOption } : {}),
  };
}

/** Drops catalog-owned field copy from the v2 JSON while keeping all instance values and overrides. */
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
