import type { ShapeElement, ShapeLabel } from "../../model";

const relationshipNames: Record<NonNullable<ShapeElement["relationshipType"]>, string> = {
  association: "Association",
  dependency: "Dependency",
  "data-flow": "Data flow",
  inheritance: "Inheritance",
  aggregation: "Aggregation",
  composition: "Composition",
  sequence: "Sequence",
  network: "Network",
  other: "Relationship",
};

/** Adds semantic relationship details to the visible connector caption. */
export function relationshipDisplayElement(element: ShapeElement): ShapeElement {
  const explicit = element.label?.text.trim();
  const semantic = element.relationshipType ? relationshipNames[element.relationshipType] : "";
  const cardinality = element.cardinality?.trim();
  const text = [explicit, semantic, cardinality].filter(Boolean).join(" · ");
  if (!text) return element;
  const label: ShapeLabel = {
    text,
    color: element.label?.color ?? element.color,
    fontSize: element.label?.fontSize ?? 10,
    verticalAlign: element.label?.verticalAlign ?? "middle",
    textAlign: element.label?.textAlign ?? "center",
    fontFamily: element.label?.fontFamily ?? "sans",
    bold: element.label?.bold ?? false,
    italic: element.label?.italic ?? false,
    underline: element.label?.underline ?? false,
    listType: element.label?.listType ?? "none",
    ...(element.label?.offsetX === undefined ? {} : { offsetX: element.label.offsetX }),
    ...(element.label?.offsetY === undefined ? {} : { offsetY: element.label.offsetY }),
    ...(element.label?.opacity === undefined ? {} : { opacity: element.label.opacity }),
  };
  return { ...element, label };
}
