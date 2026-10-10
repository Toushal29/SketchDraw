export type CanvasHistoryPort<T> = {
  getCurrent: () => T;
  setCurrent: (value: T) => void;
  clone: (value: T) => T;
  canEdit: () => boolean;
  clearSelection: () => void;
  markDirty: () => void;
  changed: () => void;
};

/** Per-page undo and redo state, shared by canvas commands and pointer edits. */
export function createCanvasHistory<T>(port: CanvasHistoryPort<T>) {
  type History = { undo: T[]; redo: T[] };
  let undo: T[] = [];
  let redo: T[] = [];
  const pages = new Map<string, History>();

  function push(before: T) {
    undo.push(before);
    if (undo.length > 100) undo.shift();
    redo = [];
    port.changed();
  }

  function undoOnce() {
    if (!port.canEdit() || !undo.length) return;
    redo.push(port.clone(port.getCurrent()));
    port.setCurrent(undo.pop()!);
    port.clearSelection();
    port.markDirty();
    port.changed();
  }

  function redoOnce() {
    if (!port.canEdit() || !redo.length) return;
    undo.push(port.clone(port.getCurrent()));
    port.setCurrent(redo.pop()!);
    port.clearSelection();
    port.markDirty();
    port.changed();
  }

  function rememberPage(pageId: string) {
    pages.set(pageId, { undo, redo });
  }

  function restorePage(pageId: string) {
    const history = pages.get(pageId);
    undo = history?.undo ?? [];
    redo = history?.redo ?? [];
    port.changed();
  }

  function resetCurrent() {
    undo = [];
    redo = [];
    port.changed();
  }

  function clearAll() {
    pages.clear();
    undo = [];
    redo = [];
    port.changed();
  }

  return {
    push,
    undo: undoOnce,
    redo: redoOnce,
    canUndo: () => undo.length > 0,
    canRedo: () => redo.length > 0,
    rememberPage,
    restorePage,
    resetCurrent,
    clearAll,
  };
}
