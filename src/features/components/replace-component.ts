import type { Bounds, Element, GroupElement, LayerFlags } from "../../model";
import { buildLibraryComponent, type LibraryComponentKind } from "./library-components";
import { resizeLibraryGroup } from "./library-component-editor";
import { elementBounds } from "../canvas/bounds";

function labelOf(element: Element): string {
  if (element.type === "group") return element.libraryComponent?.label ?? element.note?.title ?? element.container?.name ?? "";
  if (element.type === "schemaTable") return element.name;
  if (element.type === "text") return element.text;
  return "label" in element ? element.label?.text ?? "" : "";
}

/** Replace a node's visual/component type while retaining the root ID used by bound connectors. */
export function replaceWithLibraryComponent(element: Element, kind: LibraryComponentKind, bounds = elementBounds(element)): GroupElement | undefined {
  if (element.type === "line" || element.type === "arrow" || element.type === "freehand" || element.locked) return undefined;
  const sourceLabel = labelOf(element).trim();
  const built = buildLibraryComponent(kind, bounds.x, bounds.y);
  const resized = resizeLibraryGroup(built, bounds);
  const flags: LayerFlags = {
    id: element.id ?? crypto.randomUUID(), hidden: element.hidden, locked: element.locked, rotation: element.rotation,
    aspectLocked: element.aspectLocked, layerId: element.layerId, layerName: element.layerName, componentId: element.componentId,
    componentRole: element.componentRole, catalogId: element.catalogId, pageLinkId: element.pageLinkId,
    prototypeTargetId: element.prototypeTargetId, pageLinkTransition: element.pageLinkTransition,
    prototypeAction: element.prototypeAction, prototypeOverlay: element.prototypeOverlay, prototypeFixed: element.prototypeFixed,
    projectTaskId: element.projectTaskId, masterElementId: element.masterElementId, altText: element.altText,
    styleBindings: element.styleBindings, layoutFill: element.layoutFill, strideThreats: element.strideThreats,
    architecture: element.architecture, decisionCard: element.decisionCard,
  };
  const connectionPoints = "connectionPoints" in element ? element.connectionPoints : undefined;
  return {
    ...resized,
    ...flags,
    elements: resized.elements,
    componentBounds: bounds,
    libraryComponent: {
      ...resized.libraryComponent!,
      ...(sourceLabel ? { label: sourceLabel.slice(0, 120) } : {}),
      ...(element.type === "group" && element.libraryComponent?.componentFields ? { componentFields: element.libraryComponent.componentFields } : {}),
      ...(element.type === "group" && element.libraryComponent?.connectionPoints ? { connectionPoints: element.libraryComponent.connectionPoints } : connectionPoints ? { connectionPoints } : {}),
      ...(element.type === "group" && element.libraryComponent?.styleOverrides ? { styleOverrides: element.libraryComponent.styleOverrides } : {}),
    },
    ...(element.type === "group" && element.connectionPoints ? { connectionPoints: element.connectionPoints } : connectionPoints ? { connectionPoints } : {}),
  };
}

export function centeredReplacementBounds(element: Element): Bounds { return elementBounds(element); }
