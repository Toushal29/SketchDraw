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
export type WindowsShortcutMap = Record<WindowsShortcutId, string>;

export const DEFAULT_WINDOWS_SHORTCUTS = Object.fromEntries(WINDOWS_SHORTCUTS.map(item => [item.id, item.defaultKey])) as WindowsShortcutMap;

export function loadWindowsShortcuts(): WindowsShortcutMap {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem("sketchdraw-windows-shortcuts") ?? "{}");
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ...DEFAULT_WINDOWS_SHORTCUTS };
    return { ...DEFAULT_WINDOWS_SHORTCUTS, ...Object.fromEntries(WINDOWS_SHORTCUTS.map(item => [item.id, typeof (raw as Record<string, unknown>)[item.id] === "string" ? (raw as Record<string, string>)[item.id] : item.defaultKey])) };
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

export function matchesWindowsShortcut(event: KeyboardEvent, binding: string) {
  return !!binding && normalizeShortcut(binding) === shortcutFromEvent(event);
}
