export const WINDOWS_SHORTCUTS = [
  { id: "commandPalette", label: "Open command palette", category: "Application", defaultKey: "Ctrl+K" },
  { id: "newSketch", label: "New sketch", category: "File", defaultKey: "Ctrl+N" },
  { id: "openSketch", label: "Open sketch", category: "File", defaultKey: "Ctrl+O" },
  { id: "saveSketch", label: "Save sketch", category: "File", defaultKey: "Ctrl+S" },
  { id: "saveAs", label: "Save sketch as", category: "File", defaultKey: "Ctrl+Shift+S" },
  { id: "undo", label: "Undo", category: "Edit", defaultKey: "Ctrl+Z" },
  { id: "redo", label: "Redo", category: "Edit", defaultKey: "Ctrl+Y" },
  { id: "group", label: "Group selection", category: "Edit", defaultKey: "Ctrl+G" },
  { id: "ungroup", label: "Ungroup selection", category: "Edit", defaultKey: "Ctrl+Shift+G" },
  { id: "duplicate", label: "Duplicate selection", category: "Edit", defaultKey: "Ctrl+D" },
  { id: "selectAll", label: "Select all objects", category: "Edit", defaultKey: "Ctrl+A" },
  { id: "copyStyle", label: "Copy object style", category: "Style", defaultKey: "Ctrl+Shift+C" },
  { id: "pasteStyle", label: "Paste object style", category: "Style", defaultKey: "Ctrl+Shift+V" },
  { id: "fitDrawing", label: "Fit drawing", category: "Navigation", defaultKey: "1" },
  { id: "fitSelection", label: "Zoom to selection", category: "Navigation", defaultKey: "2" },
  { id: "resetZoom", label: "Reset zoom", category: "Navigation", defaultKey: "0" },
  { id: "toggleGrid", label: "Toggle grid", category: "View", defaultKey: "G" },
  { id: "snapGrid", label: "Toggle grid snapping", category: "View", defaultKey: "Shift+G" },
  { id: "snapObjects", label: "Toggle object snapping", category: "View", defaultKey: "Shift+O" },
  { id: "lockCanvas", label: "Lock canvas", category: "View", defaultKey: "K" },
  { id: "selectTool", label: "Select tool", category: "Tools", defaultKey: "V" },
  { id: "penTool", label: "Pen tool", category: "Tools", defaultKey: "P" },
  { id: "laserTool", label: "Laser pointer", category: "Tools", defaultKey: "Y" },
  { id: "rectangleTool", label: "Rectangle tool", category: "Tools", defaultKey: "R" },
  { id: "circleTool", label: "Circle tool", category: "Tools", defaultKey: "C" },
  { id: "diamondTool", label: "Diamond tool", category: "Tools", defaultKey: "D" },
  { id: "triangleTool", label: "Triangle tool", category: "Tools", defaultKey: "N" },
  { id: "lineTool", label: "Line tool", category: "Tools", defaultKey: "L" },
  { id: "arrowTool", label: "Arrow tool", category: "Tools", defaultKey: "A" },
  { id: "flowchartTool", label: "Flowchart tool", category: "Tools", defaultKey: "F" },
  { id: "textTool", label: "Text tool", category: "Tools", defaultKey: "T" },
  { id: "bucketTool", label: "Fill bucket tool", category: "Tools", defaultKey: "B" },
  { id: "eraserTool", label: "Eraser tool", category: "Tools", defaultKey: "E" },
  { id: "cropTool", label: "Image crop tool", category: "Tools", defaultKey: "X" },
  { id: "presentation", label: "Presentation mode", category: "View", defaultKey: "F5" },
] as const;

export type WindowsShortcutId = typeof WINDOWS_SHORTCUTS[number]["id"];
export type WindowsShortcutBindings = [string, string];
export type WindowsShortcutMap = Record<WindowsShortcutId, WindowsShortcutBindings>;
export type WindowsShortcutSlot = 0 | 1;

export const DEFAULT_WINDOWS_SHORTCUTS = Object.fromEntries(WINDOWS_SHORTCUTS.map(item => [item.id, [item.defaultKey, ""]])) as WindowsShortcutMap;

export function loadWindowsShortcuts(): WindowsShortcutMap {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem("sketchdraw-windows-shortcuts") ?? "{}");
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ...DEFAULT_WINDOWS_SHORTCUTS };
    const stored = raw as Record<string, unknown>;
    return Object.fromEntries(WINDOWS_SHORTCUTS.map(item => {
      const value = stored[item.id];
      // Older versions stored one replaceable binding. Preserve an old custom
      // binding in the additional slot while restoring the standard primary.
      if (typeof value === "string") return [item.id, value ? value === item.defaultKey ? [value, ""] : [item.defaultKey, value] : ["", ""]];
      if (Array.isArray(value)) return [item.id, [typeof value[0] === "string" ? value[0] : item.defaultKey, typeof value[1] === "string" ? value[1] : ""]];
      return [item.id, [item.defaultKey, ""]];
    })) as WindowsShortcutMap;
  } catch { return { ...DEFAULT_WINDOWS_SHORTCUTS }; }
}

export function normalizeShortcut(value: string) {
  const parts = value.split("+").map(part => part.trim()).filter(Boolean);
  const key = parts.pop() ?? "";
  const modifiers = new Set(parts.map(part => part.toLowerCase()));
  return [...["Ctrl", "Alt", "Shift"].filter(part => modifiers.has(part.toLowerCase())), key.length === 1 ? key.toUpperCase() : key].join("+");
}

export function shortcutFromEvent(event: KeyboardEvent) {
  const key = event.key;
  if (["Control", "Shift", "Alt", "Meta"].includes(key)) return "";
  const modifiers = [event.ctrlKey || event.metaKey ? "Ctrl" : "", event.altKey ? "Alt" : "", event.shiftKey ? "Shift" : ""].filter(Boolean);
  const normalizedKey = key === " " || key === "Spacebar" ? "Space" : key.length === 1 ? key.toUpperCase() : key;
  return [...modifiers, normalizedKey].join("+");
}

export function shortcutFromMouseEvent(event: MouseEvent) {
  // MouseEvent.button uses 0 for the primary button, 1 for middle, 2 for
  // secondary, and 3/4 for the common back/forward thumb buttons.
  const button = ({ 1: "Mouse2", 2: "Mouse3", 3: "Mouse4", 4: "Mouse5" } as Record<number, string>)[event.button];
  if (!button) return "";
  const modifiers = [event.ctrlKey || event.metaKey ? "Ctrl" : "", event.altKey ? "Alt" : "", event.shiftKey ? "Shift" : ""].filter(Boolean);
  return [...modifiers, button].join("+");
}

export function matchesWindowsShortcut(event: KeyboardEvent, binding: string) {
  return !!binding && normalizeShortcut(binding) === shortcutFromEvent(event);
}

export function matchesWindowsMouseShortcut(event: MouseEvent, binding: string) {
  return !!binding && normalizeShortcut(binding) === shortcutFromMouseEvent(event);
}

export function displayShortcut(value: string) {
  return value.replace(/Mouse([2-5])/g, "Mouse $1");
}

export function formatShortcutBindings(bindings: WindowsShortcutBindings) {
  return bindings.filter(Boolean).map(displayShortcut).join(", ");
}
