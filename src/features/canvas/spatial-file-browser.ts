export type SpatialFileCard = {
  id: string;
  name: string;
  path: string;
  x: number;
  y: number;
  w: number;
  h: number;
  thumbnail?: string;
  lastModified: number;
  group?: string;
};

const STORAGE_KEY = "sketchdraw-spatial-browser";
const CARD_WIDTH = 180;
const CARD_HEIGHT = 140;
const SPACING = 24;
const COLUMNS = 4;

export function readSpatialLayout(): SpatialFileCard[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function writeSpatialLayout(cards: SpatialFileCard[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cards)); } catch { /* ok */ }
}

export function addFileCard(name: string, path: string, existingCards: SpatialFileCard[]): SpatialFileCard {
  const existing = existingCards.find(card => card.path === path);
  if (existing) {
    existing.lastModified = Date.now();
    return existing;
  }

  const index = existingCards.length;
  const col = index % COLUMNS;
  const row = Math.floor(index / COLUMNS);
  const card: SpatialFileCard = {
    id: crypto.randomUUID(),
    name,
    path,
    x: col * (CARD_WIDTH + SPACING) + SPACING,
    y: row * (CARD_HEIGHT + SPACING) + SPACING,
    w: CARD_WIDTH,
    h: CARD_HEIGHT,
    lastModified: Date.now(),
  };
  return card;
}

export function removeFileCard(cards: SpatialFileCard[], id: string): SpatialFileCard[] {
  return cards.filter(card => card.id !== id);
}

export function moveFileCard(cards: SpatialFileCard[], id: string, x: number, y: number): SpatialFileCard[] {
  return cards.map(card => card.id === id ? { ...card, x, y } : card);
}

export function groupFileCards(cards: SpatialFileCard[], ids: string[], groupName: string): SpatialFileCard[] {
  return cards.map(card => ids.includes(card.id) ? { ...card, group: groupName } : card);
}

export function ungroupFileCards(cards: SpatialFileCard[], groupName: string): SpatialFileCard[] {
  return cards.map(card => card.group === groupName ? { ...card, group: undefined } : card);
}

export function autoArrangeCards(cards: SpatialFileCard[]): SpatialFileCard[] {
  const sorted = [...cards].sort((a, b) => b.lastModified - a.lastModified);
  return sorted.map((card, index) => ({
    ...card,
    x: (index % COLUMNS) * (CARD_WIDTH + SPACING) + SPACING,
    y: Math.floor(index / COLUMNS) * (CARD_HEIGHT + SPACING) + SPACING,
  }));
}

export function cardGroups(cards: SpatialFileCard[]): Map<string, SpatialFileCard[]> {
  const groups = new Map<string, SpatialFileCard[]>();
  for (const card of cards) {
    const group = card.group ?? "(ungrouped)";
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group)!.push(card);
  }
  return groups;
}
