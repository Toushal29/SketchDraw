import type { Element } from "../../model";

export type ClipboardEntry = {
  id: string;
  timestamp: number;
  label: string;
  elements: Element[];
  thumbnail?: string;
};

const STORAGE_KEY = "sketchdraw-infinite-clipboard";
const MAX_ENTRIES = 50;

export function readClipboard(): ClipboardEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function writeClipboard(entries: ClipboardEntry[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES))); } catch { /* quota */ }
}

export function addToClipboard(elements: Element[], label?: string): ClipboardEntry {
  const entry: ClipboardEntry = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    label: label || `${elements.length} element${elements.length > 1 ? "s" : ""}`,
    elements: structuredClone(elements),
  };
  const current = readClipboard();
  writeClipboard([entry, ...current]);
  return entry;
}

export function removeFromClipboard(id: string) {
  writeClipboard(readClipboard().filter(entry => entry.id !== id));
}

export function clearClipboard() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ok */ }
}

export function clipboardEntryLabel(entry: ClipboardEntry): string {
  const date = new Date(entry.timestamp);
  const time = date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  return `${entry.label} · ${time}`;
}
