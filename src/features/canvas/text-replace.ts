import type { Element } from "../../model";

export type TextReplacementResult = { element: Element; count: number };

/** Replace literal text in the user-editable labels and notes on one root object. */
export function replaceElementText(element: Element, search: string, replacement: string, canEdit: (item: Element) => boolean = item => !item.locked): TextReplacementResult {
  const needle = search.trim();
  if (!needle) return { element, count: 0 };
  const matcher = new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
  let count = 0;
  const replace = (value: string | undefined) => {
    if (value === undefined) return undefined;
    return value.replace(matcher, () => { count++; return replacement; });
  };
  const visit = (item: Element): Element => {
    if (!canEdit(item)) return item;
    if (item.type === "group") return {
      ...item,
      elements: item.elements.map(visit),
      ...(item.note ? { note: { ...item.note, content: replace(item.note.content) ?? item.note.content, ...(item.note.title !== undefined ? { title: replace(item.note.title) } : {}) } } : {}),
      ...(item.libraryComponent ? { libraryComponent: { ...item.libraryComponent, ...(item.libraryComponent.label !== undefined ? { label: replace(item.libraryComponent.label) } : {}) } } : {}),
    };
    if (item.type === "text") return { ...item, text: replace(item.text) ?? item.text };
    if (item.type === "schemaTable") return { ...item, name: replace(item.name) ?? item.name };
    if ("label" in item && item.label) return { ...item, label: { ...item.label, text: replace(item.label.text) ?? item.label.text } };
    return item;
  };
  return { element: visit(element), count };
}
