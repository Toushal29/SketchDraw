import type { Element } from "../../model";

export function selectedElements(elements: Element[], indices: number[]): Element[] {
  return indices.flatMap(index => elements[index] ? [elements[index]] : []);
}

export function primarySelectionIndex(indices: number[]): number | undefined {
  return indices[indices.length - 1];
}

export function focusedSelectionElement(elements: Element[], indices: number[]): Element | undefined {
  let element = primarySelectionIndex(indices) === undefined ? undefined : elements[primarySelectionIndex(indices)!];
  while (element?.type === "group" && !element.note) element = element.elements[element.elements.length - 1];
  return element;
}

export function isGroupSelection(selected: Element[]): boolean {
  return selected.length === 1 && selected[0]?.type === "group" && !selected[0].note;
}

export function canGroupSelection(selected: Element[]): boolean {
  if (selected.length === 1 && selected[0]?.type === "group" && selected[0].note) return false;
  return isGroupSelection(selected) ? !selected[0]?.locked : selected.filter(element => !element.locked).length >= 2;
}

export function deletableSelectionCount(elements: Element[], indices: number[], canMove: (element: Element) => boolean): number {
  return indices.filter(index => !!elements[index] && canMove(elements[index])).length;
}
