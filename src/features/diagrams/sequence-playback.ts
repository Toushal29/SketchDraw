import type { Element, ShapeElement } from "../../model";
import { elementBounds } from "../canvas/bounds";

export type SequenceStep = { messageId: string; fromId: string; toId: string; label: string; from: string; to: string };

function walk(items: Element[], visit: (element: Element) => void) { for (const item of items) { visit(item); if (item.type === "group") walk(item.elements, visit); } }

/** Messages between lifelines in top-to-bottom order, the order a sequence diagram is read. */
export function sequenceSteps(elements: Element[]): SequenceStep[] {
  const lifelines = new Map<string, string>();
  walk(elements, item => { if (item.type === "group" && item.libraryComponent?.kind === "uml-lifeline" && item.id) lifelines.set(item.id, item.libraryComponent.label?.trim() || "Participant"); });
  const messages: { arrow: ShapeElement; y: number }[] = [];
  walk(elements, item => {
    if ((item.type !== "arrow" && item.type !== "line") || item.hidden || !item.id || !item.startBinding || !item.endBinding) return;
    if (!lifelines.has(item.startBinding.elementId) || !lifelines.has(item.endBinding.elementId)) return;
    messages.push({ arrow: item, y: elementBounds(item).y });
  });
  return messages.sort((a, b) => a.y - b.y).map(({ arrow }) => ({
    messageId: arrow.id!, fromId: arrow.startBinding!.elementId, toId: arrow.endBinding!.elementId, label: arrow.label?.text.trim() || "(message)",
    from: lifelines.get(arrow.startBinding!.elementId)!, to: lifelines.get(arrow.endBinding!.elementId)!,
  }));
}

/** Index of the root-level element that is, or contains, `id`. */
export function rootIndexContaining(elements: Element[], id: string): number {
  const contains = (item: Element): boolean => item.id === id || (item.type === "group" && item.elements.some(contains));
  return elements.findIndex(contains);
}
