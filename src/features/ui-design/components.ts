import { UIHierarchyIndex } from "./hierarchy";
import { createUIDesignId } from "./model";
import type { UIComponentDefinition, UIComponentVariant, UIElement, UIDesignDocument } from "./model";

/** Scalar properties that can be varied or overridden on a component node. */
export const UI_COMPONENT_PROPERTY_FIELDS = [
  "x", "y", "width", "height", "rotation", "hidden", "text", "fill", "stroke", "strokeWidth", "strokeStyle", "radius", "opacity", "shadow", "effectValue", "fillTokenId", "strokeTokenId", "radiusTokenId", "effectTokenId", "typographyTokenId", "fontFamily", "fontSize", "fontWeight", "lineHeight", "letterSpacing", "textAlign", "clipContent", "layoutPosition", "gridColumn", "gridRow", "gridColumnSpan", "gridRowSpan", "widthSizing", "heightSizing", "previewOverflow", "fixedOnScroll", "mask", "imageFit", "componentVariantId",
] as const satisfies readonly (keyof UIElement)[];

type ComponentPropertyField = typeof UI_COMPONENT_PROPERTY_FIELDS[number];
type ComponentPropertyValue = string | number | boolean;
const componentFields = new Set<string>(UI_COMPONENT_PROPERTY_FIELDS);
const sourceId = (node: UIElement, componentId?: string) => componentId
  ? node.componentSourceIds[componentId] || node.componentSourceId || node.id
  : node.componentSourceId || node.id;
const withSourceId = (node: UIElement, componentId: string, id: string): UIElement => ({
  ...node,
  componentSourceId: node.componentSourceId || id,
  componentSourceIds: { ...node.componentSourceIds, [componentId]: id },
});
const isScalar = (value: unknown): value is ComponentPropertyValue => typeof value === "string" || typeof value === "boolean" || typeof value === "number" && Number.isFinite(value);

function templateNodes(component: UIComponentDefinition): UIElement[] {
  return [component.root, ...new UIHierarchyIndex<UIElement>("component-template", component.children).flatten(component.root.id)];
}

function templateBySource(component: UIComponentDefinition): Map<string, UIElement> {
  return new Map(templateNodes(component).map(node => [sourceId(node, component.id), node]));
}

function parseVariantKey(key: string, bySource: ReadonlyMap<string, UIElement>): { source: string; field: ComponentPropertyField } | undefined {
  const splitAt = key.lastIndexOf(".");
  if (splitAt > 0) {
    const source = key.slice(0, splitAt), field = key.slice(splitAt + 1);
    if (bySource.has(source) && componentFields.has(field)) return { source, field: field as ComponentPropertyField };
  }
  if (componentFields.has(key)) return { source: "root", field: key as ComponentPropertyField };
  return undefined;
}

function variantValues(variant: UIComponentVariant | undefined, component: UIComponentDefinition): Map<string, Partial<Record<ComponentPropertyField, ComponentPropertyValue>>> {
  const values = new Map<string, Partial<Record<ComponentPropertyField, ComponentPropertyValue>>>();
  if (!variant) return values;
  const bySource = templateBySource(component);
  for (const [key, value] of Object.entries(variant.properties)) {
    const parsed = parseVariantKey(key, bySource);
    if (!parsed || !isScalar(value)) continue;
    const current = values.get(parsed.source) ?? {};
    current[parsed.field] = value;
    values.set(parsed.source, current);
  }
  return values;
}

function componentVariantPatch(values: Partial<Record<ComponentPropertyField, ComponentPropertyValue>>, overrides: UIElement["overrides"]): Partial<UIElement> {
  const patch: Partial<UIElement> = {};
  for (const [field, value] of Object.entries(values)) {
    if (!Object.prototype.hasOwnProperty.call(overrides, field)) (patch as Record<string, unknown>)[field] = value;
  }
  return patch;
}

function overlayValues(node: UIElement, values: Partial<Record<ComponentPropertyField, ComponentPropertyValue>>, overrides: UIElement["overrides"]): UIElement {
  return { ...node, ...componentVariantPatch(values, overrides) };
}

function applyStoredOverrides(node: UIElement): UIElement {
  const values: Partial<Record<ComponentPropertyField, ComponentPropertyValue>> = {};
  for (const [field, value] of Object.entries(node.overrides)) if (componentFields.has(field) && isScalar(value)) values[field as ComponentPropertyField] = value;
  return overlayValues(node, values, {});
}

/** Convert user edits made to a component instance node into explicit per-node overrides. */
export function withComponentOverrides(node: UIElement, patch: Partial<UIElement>, isInstanceRoot = false): Partial<UIElement> {
  if (patch.overrides) return patch;
  const overrides = { ...node.overrides };
  for (const [field, value] of Object.entries(patch)) {
    if (!componentFields.has(field) || isInstanceRoot && (field === "x" || field === "y") || !isScalar(value)) continue;
    overrides[field] = value;
  }
  return Object.keys(overrides).length ? { ...patch, overrides } : patch;
}

/** Capture the current appearance of an instance as a variant, including nested child properties. */
export function captureComponentVariant(elements: readonly UIElement[], pageId: string, component: UIComponentDefinition, instanceId: string, id: string, name: string): UIComponentVariant | undefined {
  const index = new UIHierarchyIndex<UIElement>(pageId, elements);
  const root = index.get(instanceId);
  if (!root || root.kind !== "componentInstance" || root.componentId !== component.id) return undefined;
  const templateSources = templateBySource(component);
  const nodes = [root, ...index.descendants(root.id)];
  const properties: UIComponentVariant["properties"] = {};
  for (const node of nodes) {
    const source = node.id === root.id ? "root" : sourceId(node, component.id);
    if (!templateSources.has(source === "root" ? sourceId(component.root, component.id) : source)) continue;
    for (const field of UI_COMPONENT_PROPERTY_FIELDS) {
      const value = node[field];
      if (!isScalar(value)) continue;
      properties[source === "root" ? field : `${source}.${field}`] = value;
    }
  }
  return { id, name, properties };
}

/** Apply a component variant to the matching root and child nodes of one instance. */
function applyComponentVariantTree(elements: readonly UIElement[], pageId: string, instanceId: string, component: UIComponentDefinition, variantId: string, library: readonly UIComponentDefinition[], componentPath: ReadonlySet<string>): UIElement[] {
  const variant = component.variants.find(item => item.id === variantId);
  if (!variant) return [...elements];
  const index = new UIHierarchyIndex<UIElement>(pageId, elements);
  const root = index.get(instanceId);
  if (!root || root.kind !== "componentInstance" || root.componentId !== component.id) return [...elements];
  const values = variantValues(variant, component);
  let result = [...elements];
  const byNodeId = new Map<string, UIElement>();
  byNodeId.set(root.id, overlayValues(root, values.get("root") ?? {}, root.overrides));
  byNodeId.set(root.id, { ...byNodeId.get(root.id)!, componentVariantId: variantId });
  const variantPatches = new Map<string, Partial<UIElement>>();
  variantPatches.set(root.id, { ...componentVariantPatch(values.get("root") ?? {}, root.overrides), componentVariantId: variantId });
  const templates = templateBySource(component);
  for (const node of index.descendants(root.id)) {
    const source = sourceId(node, component.id);
    const patch = overlayValues(node, values.get(source) ?? {}, node.overrides);
    if (templates.has(source)) {
      byNodeId.set(node.id, patch);
      const variantValuesForNode = values.get(source);
      if (variantValuesForNode && Object.keys(variantValuesForNode).length) variantPatches.set(node.id, componentVariantPatch(variantValuesForNode, node.overrides));
    }
  }
  result = result.map(node => byNodeId.get(node.id) ?? node);

  // A variant can select variants on nested component instances. Apply those
  // child definitions within their own subtree, preserving ancestor isolation.
  const nestedRoots = new UIHierarchyIndex<UIElement>(pageId, result).descendants(root.id)
    .filter(node => node.kind === "componentInstance" && node.componentId !== component.id);
  for (const nestedRoot of nestedRoots) {
    const nested = library.find(item => item.id === nestedRoot.componentId);
    if (!nested || componentPath.has(nested.id)) continue;
    const selectedVariant = nestedRoot.componentVariantId || nested.variants[0]?.id || "";
    if (selectedVariant) result = applyComponentVariantTree(result, pageId, nestedRoot.id, nested, selectedVariant, library, new Set([...componentPath, nested.id]));
  }

  // Reapply this component's values last so an outer variant can explicitly
  // override a nested instance's child property without changing its master.
  // Only reapply fields explicitly set by this outer variant. Reapplying every
  // outer snapshot node here would overwrite values resolved by a nested
  // component's own variant, even when the outer variant has no opinion on it.
  return result.map(node => {
    const patch = variantPatches.get(node.id);
    return patch ? { ...node, ...patch } : node;
  });
}

export function applyComponentVariant(elements: readonly UIElement[], pageId: string, instanceId: string, component: UIComponentDefinition, variantId: string, library: readonly UIComponentDefinition[] = [component]): UIElement[] {
  return applyComponentVariantTree(elements, pageId, instanceId, component, variantId, library, new Set([component.id]));
}

function syncOneInstance(elements: readonly UIElement[], pageId: string, component: UIComponentDefinition, instanceId: string, library: readonly UIComponentDefinition[] = [component]): UIElement[] {
  const index = new UIHierarchyIndex<UIElement>(pageId, elements);
  const instance = index.get(instanceId);
  if (!instance) return [...elements];
  const templates = templateNodes(component);
  const templateRoot = component.root;
  const templatesBySource = new Map(templates.map(node => [sourceId(node, component.id), node]));
  const sourceToInstanceId = new Map<string, string>([[sourceId(templateRoot, component.id), instance.id]]);
  const existingChildren = index.descendants(instance.id);
  for (const node of existingChildren) {
    const key = sourceId(node, component.id);
    if (key && templatesBySource.has(key) && !sourceToInstanceId.has(key)) sourceToInstanceId.set(key, node.id);
  }

  const updatedRoot = applyStoredOverrides(withSourceId({
    ...templateRoot,
    id: instance.id,
    kind: "componentInstance",
    parentId: instance.parentId,
    order: instance.order,
    x: instance.x,
    y: instance.y,
    rotation: instance.rotation,
    name: instance.name,
    componentId: component.id,
    componentSourceId: sourceId(templateRoot, component.id),
    componentVariantId: instance.componentVariantId || component.variants[0]?.id || "",
    overrides: instance.overrides,
    interactions: instance.interactions,
    hidden: Object.prototype.hasOwnProperty.call(instance.overrides, "hidden") ? instance.hidden : templateRoot.hidden,
    locked: instance.locked,
  }, component.id, sourceId(templateRoot, component.id)));
  const replacements = new Map<string, UIElement>([[instance.id, updatedRoot]]);
  const newNodes: UIElement[] = [];

  for (const template of templates.slice(1)) {
    const source = sourceId(template, component.id);
    const id = sourceToInstanceId.get(source) ?? createUIDesignId("instance-child");
    sourceToInstanceId.set(source, id);
    const existing = existingChildren.find(node => node.id === id);
    const templateParent = templates.find(node => node.id === template.parentId);
    const parentSource = templateParent ? sourceId(templateParent, component.id) : sourceId(templateRoot, component.id);
    const parentId = sourceToInstanceId.get(parentSource) ?? instance.id;
    const child: UIElement = withSourceId({
      ...template,
      id,
      parentId,
      order: template.order,
      overrides: existing?.overrides ?? {},
      interactions: existing?.interactions ?? template.interactions,
      hidden: existing && Object.prototype.hasOwnProperty.call(existing.overrides, "hidden") ? existing.hidden : template.hidden,
      locked: existing?.locked ?? template.locked,
    }, component.id, source);
    replacements.set(id, applyStoredOverrides(child));
    newNodes.push(child);
  }

  // Keep instance-only nodes. If their source parent was removed, promote them
  // to the instance root while preserving their previous world position.
  const templateSources = new Set(templates.map(node => sourceId(node, component.id)));
  const removedSources = new Set(existingChildren.filter(node => (node.componentSourceIds[component.id] || node.componentSourceId) && !templateSources.has(sourceId(node, component.id))).map(node => node.id));
  const userNodes = existingChildren.filter(node => !node.componentSourceIds[component.id] && !node.componentSourceId);
  const userUpdates = new Map<string, UIElement>();
  for (const userNode of userNodes) {
    if (!removedSources.has(userNode.parentId)) continue;
    const world = index.worldTransform(userNode.id);
    const local = world ? index.worldToLocal(instance.id, { x: world.x, y: world.y }) : undefined;
    userUpdates.set(userNode.id, { ...userNode, parentId: instance.id, ...(local ? { x: local.x, y: local.y } : {}) });
  }

  const oldInstanceIds = new Set([instance.id, ...existingChildren.map(node => node.id)]);
  const updated = elements
    .filter(node => !removedSources.has(node.id) && (!oldInstanceIds.has(node.id) || node.id === instance.id || !sourceId(node, component.id) || !templatesBySource.has(sourceId(node, component.id))))
    .map(node => replacements.get(node.id) ?? userUpdates.get(node.id) ?? node);
  const present = new Set(updated.map(node => node.id));
  for (const node of newNodes) if (!present.has(node.id)) updated.push(replacements.get(node.id) ?? node);

  const variantId = (updated.find(node => node.id === instance.id)?.componentVariantId || component.variants[0]?.id || "");
  return applyComponentVariant(updated, pageId, instance.id, component, variantId, library);
}

/** Refresh each component snapshot from its live master and propagate tree changes across all pages. */
export function synchronizeComponentMasters(document: UIDesignDocument): UIDesignDocument {
  if (!document.components.length) return document;
  let pages = document.pages;
  let components = [...document.components];
  const componentIds = new Set(components.map(component => component.id));
  const dependencies = new Map<string, Set<string>>();
  for (const component of components) {
    const masterPage = pages.find(page => page.elements.some(node => node.componentId === component.id && node.kind !== "componentInstance"));
    const master = masterPage?.elements.find(node => node.componentId === component.id && node.kind !== "componentInstance");
    const nested = master && masterPage
      ? new UIHierarchyIndex<UIElement>(masterPage.id, masterPage.elements).descendants(master.id)
        .filter(node => node.kind === "componentInstance" && node.componentId !== component.id && componentIds.has(node.componentId))
        .map(node => node.componentId)
      : [];
    dependencies.set(component.id, new Set(nested));
  }

  // Refresh nested component instances before snapshotting their containing
  // masters. This keeps an outer master and its instances in sync when an
  // inner master changes, regardless of the order components were created.
  const ordered: UIComponentDefinition[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const visit = (id: string) => {
    if (visited.has(id) || visiting.has(id)) return;
    visiting.add(id);
    for (const dependency of dependencies.get(id) ?? []) visit(dependency);
    visiting.delete(id);
    visited.add(id);
    const component = components.find(item => item.id === id);
    if (component) ordered.push(component);
  };
  for (const component of components) visit(component.id);

  for (const orderedComponent of ordered) {
    const component = components.find(item => item.id === orderedComponent.id) ?? orderedComponent;
    const masterPage = pages.find(page => page.elements.some(node => node.componentId === component.id && node.kind !== "componentInstance"));
    const master = masterPage?.elements.find(node => node.componentId === component.id && node.kind !== "componentInstance");
    if (!master || !masterPage) continue;

    const masterIndex = new UIHierarchyIndex<UIElement>(masterPage.id, masterPage.elements);
    const liveTree = [master, ...masterIndex.descendants(master.id)];
    const sourceByLiveId = new Map(liveTree.map(node => [node.id, sourceId(node, component.id)]));
    const rootTemplateId = component.root.id;
    const rootSourceId = sourceByLiveId.get(master.id)!;
    const root = withSourceId({ ...master, id: rootTemplateId, parentId: "component-root", order: 0, componentId: component.id, componentSourceId: rootSourceId }, component.id, rootSourceId);
    const children = liveTree.slice(1).map(node => ({
      ...node,
      id: sourceByLiveId.get(node.id)!,
      componentSourceId: node.componentSourceId || sourceByLiveId.get(node.id)!,
      componentSourceIds: { ...node.componentSourceIds, [component.id]: sourceByLiveId.get(node.id)! },
      parentId: node.parentId === master.id ? rootTemplateId : sourceByLiveId.get(node.parentId) ?? rootTemplateId,
    }));
    const normalizedMasterNodes = masterPage.elements.map(node => sourceByLiveId.has(node.id) ? withSourceId(node, component.id, sourceByLiveId.get(node.id)!) : node);
    pages = pages.map(page => page.id === masterPage.id ? { ...page, elements: normalizedMasterNodes } : page);
    const refreshed = { ...component, name: master.name || component.name, root, children };
    components = components.map(item => item.id === component.id ? refreshed : item);

    pages = pages.map(page => {
      let elements = page.elements;
      const instanceIds = elements.filter(node => node.kind === "componentInstance" && node.componentId === refreshed.id).map(node => node.id);
      for (const instanceId of instanceIds) elements = syncOneInstance(elements, page.id, refreshed, instanceId, components);
      return elements === page.elements ? page : { ...page, elements };
    });
  }
  return { ...document, pages, components };
}

/** Reset one instance and all of its nested overrides to the current master/default variant. */
export function resetComponentInstance(elements: readonly UIElement[], pageId: string, component: UIComponentDefinition, instanceId: string, library: readonly UIComponentDefinition[] = [component]): UIElement[] {
  const index = new UIHierarchyIndex<UIElement>(pageId, elements);
  const instance = index.get(instanceId);
  if (!instance) return [...elements];
  const ids = new Set([instanceId, ...index.descendants(instanceId).map(node => node.id)]);
  const reset = elements.map(node => ids.has(node.id) ? { ...node, overrides: {}, ...(node.id === instanceId ? { componentVariantId: component.variants[0]?.id ?? "" } : {}) } : node);
  return syncOneInstance(reset, pageId, component, instanceId, library);
}

/** Reset only the selected source-linked child while keeping sibling overrides intact. */
export function resetComponentNodeOverride(elements: readonly UIElement[], pageId: string, component: UIComponentDefinition, instanceId: string, nodeId: string, library: readonly UIComponentDefinition[] = [component]): UIElement[] {
  const index = new UIHierarchyIndex<UIElement>(pageId, elements);
  const node = index.get(nodeId);
  if (!node || node.id === instanceId || !sourceId(node, component.id) || !index.ancestors(nodeId).some(parent => parent.id === instanceId)) return [...elements];
  const cleared = elements.map(item => item.id === nodeId ? { ...item, overrides: {} } : item);
  return syncOneInstance(cleared, pageId, component, instanceId, library);
}

/** Detach the instance wrapper but preserve its visual subtree as an editable group. */
export function detachComponentInstance(elements: readonly UIElement[], pageId: string, instanceId: string): UIElement[] {
  const index = new UIHierarchyIndex<UIElement>(pageId, elements);
  const instance = index.get(instanceId);
  if (!instance || instance.kind !== "componentInstance") return [...elements];
  const ids = new Set(index.descendants(instanceId).map(node => node.id));
  return elements.map(node => node.id === instanceId
    ? { ...node, kind: "group", componentId: "", componentSourceId: "", componentSourceIds: {}, componentVariantId: "", overrides: {} }
    : ids.has(node.id) ? { ...node, componentSourceId: "", componentSourceIds: {}, overrides: {} } : node);
}
