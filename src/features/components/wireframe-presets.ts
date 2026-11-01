import type { GroupElement } from "../../model";
import { resizeLibraryGroup, setLibraryComponentField } from "./library-component-editor";

export type WireframeViewportPreset = { label: string; w: number; h: number };

export function wireframeViewportPresets(kind: string): WireframeViewportPreset[] {
  if (kind.endsWith("responsive-screen-frame")) return [{ label: "Mobile", w: 390, h: 844 }, { label: "Tablet", w: 820, h: 1180 }, { label: "Desktop", w: 1440, h: 900 }];
  if (kind.endsWith("browser-window")) return [{ label: "Compact", w: 1024, h: 768 }, { label: "Laptop", w: 1280, h: 800 }, { label: "Desktop", w: 1440, h: 900 }];
  if (kind.endsWith("mobile-device-frame")) return [{ label: "Compact phone", w: 360, h: 780 }, { label: "Standard phone", w: 390, h: 844 }, { label: "Landscape", w: 844, h: 390 }];
  if (kind.endsWith("tablet-device-frame")) return [{ label: "Portrait", w: 820, h: 1180 }, { label: "Landscape", w: 1180, h: 820 }, { label: "Compact tablet", w: 768, h: 1024 }];
  if (kind.endsWith("desktop-application-window")) return [{ label: "Laptop", w: 1280, h: 800 }, { label: "Desktop", w: 1440, h: 900 }, { label: "Large desktop", w: 1920, h: 1080 }];
  return [];
}

export function applyWireframeViewportPreset(group: GroupElement, preset: WireframeViewportPreset): GroupElement {
  const bounds = group.componentBounds; const kind = group.libraryComponent?.kind;
  if (!bounds || !kind || !wireframeViewportPresets(kind).some(item => item.label === preset.label && item.w === preset.w && item.h === preset.h)) return group;
  const resized = resizeLibraryGroup(group, {
    x: bounds.x + (bounds.w - preset.w) / 2,
    y: bounds.y + (bounds.h - preset.h) / 2,
    w: preset.w,
    h: preset.h,
  });
  return setLibraryComponentField(resized, "component:viewport", `${preset.label} · ${preset.w} × ${preset.h}`);
}
