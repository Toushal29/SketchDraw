import type { FontFamily, GroupElement, Point, StrokeStyle, Theme, UiComponentItem, UiComponentKind, UiComponentProperties, UiComponentRecord } from "../../model";
import { componentBaselineOffset, componentFont, componentFontFamily } from "./component-text";
import { strokeDashPattern } from "../canvas/stroke-style";

export type { UiComponentKind } from "../../model";
type UiDefinition = { kind: UiComponentKind; section: string; label: string; description: string; width: number; height: number };

export const UI_COMPONENT_DEFINITIONS: UiDefinition[] = [
  { kind: "ui.button", section: "Forms & UI | Controls", label: "Button", description: "Primary, secondary, or destructive action", width: 132, height: 48 },
  { kind: "ui.text-field", section: "Forms & UI | Fields", label: "Text field", description: "Labeled single-line text input", width: 208, height: 68 },
  { kind: "ui.select", section: "Forms & UI | Fields", label: "Select", description: "Labeled field with selectable options", width: 208, height: 68 },
  { kind: "ui.checkbox-group", section: "Forms & UI | Choices", label: "Checkbox group", description: "Multiple-choice selection list", width: 200, height: 118 },
  { kind: "ui.radio-group", section: "Forms & UI | Choices", label: "Radio group", description: "Single-choice selection list", width: 200, height: 118 },
  { kind: "ui.switch", section: "Forms & UI | Choices", label: "Switch", description: "Binary preference control", width: 190, height: 56 },
  { kind: "ui.textarea", section: "Forms & UI | Fields", label: "Text area", description: "Labeled multi-line text input", width: 230, height: 128 },
  { kind: "ui.search", section: "Forms & UI | Fields", label: "Search", description: "Search field with leading search affordance", width: 224, height: 60 },
  { kind: "ui.date-field", section: "Forms & UI | Fields", label: "Date field", description: "Date input with calendar affordance", width: 208, height: 68 },
  { kind: "ui.slider", section: "Forms & UI | Controls", label: "Slider", description: "Range control with value indicator", width: 214, height: 68 },
  { kind: "ui.password-field", section: "Forms & UI | Fields", label: "Password", description: "Masked password field", width: 208, height: 68 },
  { kind: "ui.email-field", section: "Forms & UI | Fields", label: "Email field", description: "Email input with example address", width: 208, height: 68 },
  { kind: "ui.file-upload", section: "Forms & UI | Fields", label: "File upload", description: "File drop zone with browse action", width: 224, height: 78 },
  { kind: "ui.card", section: "Forms & UI | Layout", label: "Content card", description: "Image, heading, copy, and action card", width: 232, height: 174 },
  { kind: "ui.app-bar", section: "Forms & UI | Layout", label: "App bar", description: "Application header with identity and actions", width: 332, height: 62 },
  { kind: "ui.side-navigation", section: "Forms & UI | Layout", label: "Side navigation", description: "Vertical navigation with active destination", width: 194, height: 224 },
  { kind: "ui.tabs", section: "Forms & UI | Layout", label: "Tabs", description: "Tabbed navigation with selected state", width: 250, height: 56 },
  { kind: "ui.image", section: "Forms & UI | Media", label: "Image placeholder", description: "Replaceable image area for a wireframe", width: 184, height: 126 },
  { kind: "ui.alert", section: "Forms & UI | Feedback", label: "Alert", description: "Status banner with title and message", width: 292, height: 82 },
  { kind: "ui.dialog", section: "Forms & UI | Feedback", label: "Dialog", description: "Confirmation panel with primary and secondary actions", width: 330, height: 218 },
  { kind: "ui.breadcrumbs", section: "Forms & UI | Navigation", label: "Breadcrumbs", description: "Hierarchical page location trail", width: 286, height: 48 },
  { kind: "ui.avatar", section: "Forms & UI | Identity", label: "Avatar", description: "Profile image or initials marker", width: 72, height: 72 },
  { kind: "ui.badge", section: "Forms & UI | Feedback", label: "Badge", description: "Compact status or category marker", width: 112, height: 40 },
  { kind: "ui.progress", section: "Forms & UI | Feedback", label: "Progress", description: "Labeled completion meter", width: 244, height: 72 },
  { kind: "ui.list", section: "Forms & UI | Data", label: "List", description: "Rows with labels and supporting details", width: 240, height: 182 },
  { kind: "ui.table", section: "Forms & UI | Data", label: "Data table", description: "Compact table with column headers and rows", width: 316, height: 182 },
  { kind: "ui.accordion", section: "Forms & UI | Layout", label: "Accordion", description: "Expandable topic rows with one open section", width: 270, height: 184 },
  { kind: "ui.menu", section: "Forms & UI | Navigation", label: "Menu", description: "Action menu with selected item", width: 204, height: 178 },
  { kind: "ui.toast", section: "Forms & UI | Feedback", label: "Toast", description: "Transient status message", width: 292, height: 86 },
  { kind: "ui.pagination", section: "Forms & UI | Navigation", label: "Pagination", description: "Page navigation with previous and next controls", width: 258, height: 52 },
  { kind: "ui.divider", section: "Forms & UI | Layout", label: "Divider", description: "Subtle separator between content regions", width: 224, height: 28 },
  { kind: "ui.footer", section: "Forms & UI | Layout", label: "Footer", description: "Page footer with brand and navigation links", width: 344, height: 72 },
];

const UI_KIND_SET = new Set<string>(UI_COMPONENT_DEFINITIONS.map(item => item.kind));
export const isUiComponentKind = (kind: string): kind is UiComponentKind => UI_KIND_SET.has(kind);
export const uiComponentDefinition = (kind: string) => UI_COMPONENT_DEFINITIONS.find(item => item.kind === kind);

const defaultItems = (kind: UiComponentKind): UiComponentItem[] => {
  const values = kind === "ui.checkbox-group" ? ["Email updates", "Product news", "Monthly report"]
    : kind === "ui.radio-group" ? ["Monthly", "Annual"]
      : kind === "ui.select" ? ["Canada", "France", "Japan"]
        : kind === "ui.tabs" ? ["Overview", "Activity", "Settings"]
          : kind === "ui.side-navigation" ? ["Overview", "Projects", "Reports", "Settings"]
            : kind === "ui.breadcrumbs" ? ["Home", "Projects", "Current"]
              : kind === "ui.pagination" ? ["1", "2", "3", "4", "5"]
                : kind === "ui.table" ? ["Name", "Role", "Status", "Alex Morgan", "Designer", "Active", "Sam Lee", "Engineer", "Away"]
                  : kind === "ui.list" ? ["Project plan", "Design review", "Release notes"]
                    : kind === "ui.accordion" ? ["Getting started", "Account settings", "Billing"]
                      : kind === "ui.menu" ? ["Overview", "Projects", "Settings"]
                        : kind === "ui.footer" ? ["Help", "Privacy", "Terms"] : [];
  return values.map((label, index) => ({ id: `item-${index + 1}`, label }));
};

const defaultTitle = (kind: UiComponentKind): string => ({
  "ui.button": "Continue", "ui.text-field": "Full name", "ui.select": "Country", "ui.checkbox-group": "Preferences", "ui.radio-group": "Choose a plan", "ui.switch": "Notifications", "ui.textarea": "Message", "ui.search": "Search", "ui.date-field": "Date", "ui.slider": "Volume", "ui.password-field": "Password", "ui.email-field": "Email", "ui.file-upload": "Attachments", "ui.card": "Project overview", "ui.app-bar": "Workspace", "ui.side-navigation": "Workspace", "ui.tabs": "", "ui.image": "Image preview", "ui.alert": "Changes saved", "ui.dialog": "Delete this project?", "ui.breadcrumbs": "", "ui.avatar": "JD", "ui.badge": "Active", "ui.progress": "Upload progress", "ui.list": "Recent activity", "ui.table": "Team members", "ui.accordion": "Help topics", "ui.menu": "Actions", "ui.toast": "Changes saved", "ui.pagination": "", "ui.divider": "", "ui.footer": "© 2026 SketchDraw",
} as Partial<Record<UiComponentKind, string>>)[kind] ?? "Component";

const defaultBody = (kind: UiComponentKind): string => ({
  "ui.card": "A clear summary of the work and its next step.", "ui.alert": "Your latest changes are saved.", "ui.dialog": "This action cannot be undone. The project and its files will be removed.", "ui.toast": "Your work is up to date.",
} as Partial<Record<UiComponentKind, string>>)[kind] ?? "";

const defaultPlaceholder = (kind: UiComponentKind): string => ({
  "ui.text-field": "Enter your name", "ui.select": "Choose a country", "ui.textarea": "Add a message…", "ui.search": "Search projects", "ui.date-field": "Select a date", "ui.password-field": "Enter password", "ui.email-field": "name@example.com", "ui.file-upload": "Drop files here or browse",
} as Partial<Record<UiComponentKind, string>>)[kind] ?? "";

export function defaultUiComponentRecord(kind: string): UiComponentRecord | undefined {
  if (!isUiComponentKind(kind)) return undefined;
  const items = defaultItems(kind);
  const properties: UiComponentProperties = {
    title: defaultTitle(kind),
    ...(defaultBody(kind) ? { body: defaultBody(kind) } : {}),
    ...(defaultPlaceholder(kind) ? { placeholder: defaultPlaceholder(kind) } : {}),
    ...(kind === "ui.button" ? { tone: "brand" as const } : {}),
    ...(kind === "ui.alert" || kind === "ui.toast" ? { tone: "positive" as const } : {}),
    ...(kind === "ui.progress" ? { progress: 68 } : {}),
    ...(kind === "ui.slider" ? { progress: 65 } : {}),
    ...(kind === "ui.switch" ? { checked: true } : {}),
    ...(items.length ? { items } : {}),
    ...(kind === "ui.select" || kind === "ui.radio-group" ? { selectedItemId: "item-1" } : {}),
    ...(kind === "ui.checkbox-group" ? { selectedItemIds: ["item-1"] } : {}),
    ...(kind === "ui.tabs" || kind === "ui.side-navigation" || kind === "ui.menu" ? { selectedItemId: "item-1" } : {}),
    ...(kind === "ui.breadcrumbs" && items.length ? { selectedItemId: items[items.length - 1].id } : {}),
    ...(kind === "ui.pagination" ? { selectedItemId: "item-1" } : {}),
    ...(kind === "ui.checkbox-group" || kind === "ui.radio-group" ? { titlePlacement: "above" as const, arrangement: "stack" as const, columns: 2, gap: 8, columnGap: 12 } : {}),
  };
  return { schema: 1, properties };
}

const LEGACY_KIND_MAP: Record<string, UiComponentKind> = {
  "form-button": "ui.button", "form-input": "ui.text-field", "form-select": "ui.select", "form-checkbox": "ui.checkbox-group", "form-radio": "ui.radio-group", "form-toggle": "ui.switch", "form-textarea": "ui.textarea", "form-search": "ui.search", "form-date": "ui.date-field", "form-slider": "ui.slider", "form-password": "ui.password-field", "form-email": "ui.email-field", "form-file": "ui.file-upload",
  "gui-card": "ui.card", "gui-app-bar": "ui.app-bar", "gui-navigation": "ui.side-navigation", "gui-tabs": "ui.tabs", "gui-image": "ui.image", "gui-alert": "ui.alert", "gui-modal": "ui.dialog", "gui-breadcrumbs": "ui.breadcrumbs", "gui-avatar": "ui.avatar", "gui-badge": "ui.badge", "gui-progress": "ui.progress", "gui-list": "ui.list", "gui-table": "ui.table", "gui-accordion": "ui.accordion", "gui-menu": "ui.menu", "gui-toast": "ui.toast", "gui-pagination": "ui.pagination", "gui-divider": "ui.divider", "gui-footer": "ui.footer",
};

function normalizeItems(value: unknown, fallback: UiComponentItem[]): UiComponentItem[] {
  if (!Array.isArray(value)) return fallback;
  const used = new Set<string>();
  return value.slice(0, 12).flatMap((item, index) => {
    const label = typeof item === "string" ? item : item && typeof item === "object" && typeof (item as Record<string, unknown>).label === "string" ? (item as Record<string, unknown>).label as string : "";
    if (!label.trim()) return [];
    const requestedId = item && typeof item === "object" && typeof (item as Record<string, unknown>).id === "string" ? (item as Record<string, unknown>).id as string : `item-${index + 1}`;
    let id = requestedId.slice(0, 80) || `item-${index + 1}`;
    while (used.has(id)) id = `${id.slice(0, 72)}-${index + 1}`;
    used.add(id);
    const detail = item && typeof item === "object" && typeof (item as Record<string, unknown>).detail === "string" ? ((item as Record<string, unknown>).detail as string).slice(0, 200) : undefined;
    return [{ id, label: label.trim().slice(0, 120), ...(detail ? { detail } : {}) }];
  });
}

function clampIndex(items: UiComponentItem[], value: unknown, fallback: string | undefined) {
  if (typeof value === "string" && items.some(item => item.id === value)) return value;
  return fallback && items.some(item => item.id === fallback) ? fallback : items[0]?.id;
}

function normalizeProperties(kind: UiComponentKind, value: unknown, defaults: UiComponentProperties): UiComponentProperties {
  const raw = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const items = normalizeItems(raw.items, defaults.items ?? []);
  const itemIds = new Set(items.map(item => item.id));
  const tone = ["brand", "neutral", "positive", "warning", "critical"].includes(String(raw.tone)) ? raw.tone as UiComponentProperties["tone"] : defaults.tone;
  const titlePlacement = ["above", "below", "leading", "trailing"].includes(String(raw.titlePlacement)) ? raw.titlePlacement as UiComponentProperties["titlePlacement"] : defaults.titlePlacement;
  const arrangement = ["stack", "inline", "grid"].includes(String(raw.arrangement)) ? raw.arrangement as UiComponentProperties["arrangement"] : defaults.arrangement;
  const selectedItemIds = Array.isArray(raw.selectedItemIds) ? [...new Set(raw.selectedItemIds.filter((id): id is string => typeof id === "string" && itemIds.has(id)))].slice(0, 12) : defaults.selectedItemIds;
  return {
    ...(typeof raw.title === "string" ? { title: raw.title.slice(0, 240) } : defaults.title !== undefined ? { title: defaults.title } : {}),
    ...(typeof raw.body === "string" ? { body: raw.body.slice(0, 2000) } : defaults.body !== undefined ? { body: defaults.body } : {}),
    ...(typeof raw.placeholder === "string" ? { placeholder: raw.placeholder.slice(0, 240) } : defaults.placeholder !== undefined ? { placeholder: defaults.placeholder } : {}),
    ...(typeof raw.action === "string" ? { action: raw.action.slice(0, 120) } : defaults.action !== undefined ? { action: defaults.action } : {}),
    ...(typeof raw.secondaryAction === "string" ? { secondaryAction: raw.secondaryAction.slice(0, 120) } : defaults.secondaryAction !== undefined ? { secondaryAction: defaults.secondaryAction } : {}),
    ...(items.length ? { items } : {}),
    ...(items.length && ["ui.select", "ui.radio-group", "ui.tabs", "ui.side-navigation", "ui.menu", "ui.breadcrumbs", "ui.pagination"].includes(kind) ? { selectedItemId: clampIndex(items, raw.selectedItemId, defaults.selectedItemId) } : {}),
    ...(items.length && kind === "ui.checkbox-group" ? { selectedItemIds } : {}),
    ...(typeof raw.checked === "boolean" ? { checked: raw.checked } : defaults.checked !== undefined ? { checked: defaults.checked } : {}),
    ...(typeof raw.progress === "number" && Number.isFinite(raw.progress) ? { progress: Math.max(0, Math.min(100, raw.progress)) } : defaults.progress !== undefined ? { progress: defaults.progress } : {}),
    ...(tone ? { tone } : {}), ...(titlePlacement ? { titlePlacement } : {}), ...(arrangement ? { arrangement } : {}),
    ...(typeof raw.columns === "number" && Number.isFinite(raw.columns) ? { columns: Math.max(1, Math.min(6, Math.round(raw.columns))) } : defaults.columns !== undefined ? { columns: defaults.columns } : {}),
    ...(typeof raw.gap === "number" && Number.isFinite(raw.gap) ? { gap: Math.max(0, Math.min(40, raw.gap)) } : defaults.gap !== undefined ? { gap: defaults.gap } : {}),
    ...(typeof raw.columnGap === "number" && Number.isFinite(raw.columnGap) ? { columnGap: Math.max(0, Math.min(40, raw.columnGap)) } : defaults.columnGap !== undefined ? { columnGap: defaults.columnGap } : {}),
  };
}

/** Converts old catalog kinds and fields into the new UI record during file and clipboard import. */
export function migrateUiComponent(kind: string, recordValue: unknown, legacyValue?: unknown): { kind: UiComponentKind; uiComponent: UiComponentRecord } | undefined {
  const canonicalKind = isUiComponentKind(kind) ? kind : LEGACY_KIND_MAP[kind];
  if (!canonicalKind) return undefined;
  const defaults = defaultUiComponentRecord(canonicalKind)!;
  if (recordValue && typeof recordValue === "object" && !Array.isArray(recordValue) && (recordValue as Record<string, unknown>).schema === 1) {
    const record = recordValue as Record<string, unknown>;
    return { kind: canonicalKind, uiComponent: { schema: 1, properties: normalizeProperties(canonicalKind, record.properties, defaults.properties) } };
  }
  const legacy = legacyValue && typeof legacyValue === "object" && !Array.isArray(legacyValue) ? legacyValue as Record<string, unknown> : {};
  const gui = legacy.guiProperties && typeof legacy.guiProperties === "object" && !Array.isArray(legacy.guiProperties) ? legacy.guiProperties as Record<string, unknown> : {};
  const oldOptions = Array.isArray(legacy.formOptions) ? legacy.formOptions : undefined;
  const oldStates = Array.isArray(legacy.formStates) ? legacy.formStates : undefined;
  const itemsSource = oldOptions ?? (Array.isArray(gui.items) ? gui.items : undefined);
  const items = itemsSource?.slice(0, 12).flatMap((item, index) => typeof item === "string" && item.trim() ? [{ id: `item-${index + 1}`, label: item.trim().slice(0, 120) }] : []) ?? defaults.properties.items;
  const oldIndex = typeof legacy.selectedOption === "number" ? legacy.selectedOption : typeof gui.activeItem === "number" ? gui.activeItem : undefined;
  const oldTitle = typeof legacy.formTitle === "string" ? legacy.formTitle : typeof gui.title === "string" ? gui.title : undefined;
  const oldPosition = ({ top: "above", bottom: "below", left: "leading", right: "trailing" } as Record<string, UiComponentProperties["titlePlacement"]>)[String(gui.titlePosition)];
  const oldLayout = ({ vertical: "stack", horizontal: "inline", grid: "grid" } as Record<string, UiComponentProperties["arrangement"]>)[String(gui.optionLayout)];
  const props: UiComponentProperties = {
    ...defaults.properties,
    ...(oldTitle !== undefined ? { title: oldTitle.slice(0, 240) } : {}),
    ...(typeof gui.bodyText === "string" ? { body: gui.bodyText.slice(0, 2000) } : {}),
    ...(typeof gui.placeholder === "string" ? { placeholder: gui.placeholder.slice(0, 240) } : {}),
    ...(typeof gui.actionLabel === "string" ? { action: gui.actionLabel.slice(0, 120) } : {}),
    ...(items?.length ? { items } : {}),
    ...(items?.length && oldIndex !== undefined ? { selectedItemId: items[Math.max(0, Math.min(items.length - 1, Math.floor(oldIndex)))]?.id } : {}),
    ...(canonicalKind === "ui.checkbox-group" && oldStates ? { selectedItemIds: items?.filter((_item, index) => oldStates[index] === true).map(item => item.id) } : {}),
    ...(typeof legacy.formState === "boolean" ? { checked: legacy.formState } : {}),
    ...(oldPosition ? { titlePlacement: oldPosition } : {}), ...(oldLayout ? { arrangement: oldLayout } : {}),
    ...(typeof gui.optionColumns === "number" ? { columns: Math.max(1, Math.min(6, Math.round(gui.optionColumns))) } : {}),
    ...(typeof gui.optionRowGap === "number" ? { gap: Math.max(0, Math.min(40, gui.optionRowGap)) } : typeof gui.optionGap === "number" ? { gap: Math.max(0, Math.min(40, gui.optionGap)) } : {}),
    ...(typeof gui.optionColumnGap === "number" ? { columnGap: Math.max(0, Math.min(40, gui.optionColumnGap)) } : {}),
  };
  return { kind: canonicalKind, uiComponent: { schema: 1, properties: normalizeProperties(canonicalKind, props, defaults.properties) } };
}

export function uiProperties(group: GroupElement): UiComponentProperties {
  return group.libraryComponent?.uiComponent?.properties ?? defaultUiComponentRecord(group.libraryComponent?.kind ?? "")?.properties ?? {};
}

export function uiChoiceColumnCount(group: GroupElement, contentWidth: number): number {
  const props = uiProperties(group); const items = props.items ?? [];
  if (!items.length) return 1;
  const gap = props.columnGap ?? props.gap ?? 8;
  const fitting = Math.max(1, Math.floor((Math.max(0, contentWidth) + gap) / (76 + gap)));
  return Math.min(items.length, props.arrangement === "inline" ? items.length : props.arrangement === "grid" ? props.columns ?? 2 : 1, fitting);
}

function choiceLayout(group: GroupElement) {
  const bounds = group.componentBounds!; const props = uiProperties(group); const items = props.items ?? [];
  const titlePlacement = props.titlePlacement ?? "above"; const horizontalTitle = titlePlacement === "leading" || titlePlacement === "trailing";
  const fontSize = Math.max(8, Math.min(16, group.libraryComponent?.textStyle?.fontSize ?? 12));
  const titleWidth = horizontalTitle ? Math.min(bounds.w * .38, Math.max(38, (props.title ?? "Select an option").length * fontSize * .52)) : bounds.w - 24;
  const contentX = titlePlacement === "leading" ? bounds.x + titleWidth + 8 : bounds.x + 12;
  const contentW = horizontalTitle ? Math.max(32, bounds.w - titleWidth - 20) : bounds.w - 24;
  const titleHeight = horizontalTitle ? 0 : 25;
  const contentY = titlePlacement === "above" ? bounds.y + titleHeight : bounds.y + 10;
  const columns = uiChoiceColumnCount(group, contentW); const columnGap = props.columnGap ?? props.gap ?? 8;
  const rowGap = props.gap ?? 8; const cellWidth = Math.max(1, (contentW - columnGap * (columns - 1)) / columns);
  const rowHeight = Math.max(19, Math.min(28, fontSize * 1.85));
  return { items, props, horizontalTitle, titlePlacement, titleWidth, contentX, contentW, contentY, columns, columnGap, rowGap, cellWidth, rowHeight, fontSize };
}

export function uiChoiceMinimumHeight(group: GroupElement): number {
  const layout = choiceLayout(group); const rows = Math.ceil(layout.items.length / Math.max(1, layout.columns));
  return Math.max(52, 20 + rows * layout.rowHeight + Math.max(0, rows - 1) * layout.rowGap + (layout.titlePlacement === "below" ? 25 : 4));
}

export function uiNavigationMinimumHeight(group: GroupElement): number {
  const items = uiProperties(group).items?.length ?? 4;
  return Math.max(64, 50 + Math.max(1, Math.min(12, items)) * 24);
}

export function uiCardCompactThreshold(_group: GroupElement): number { return 104; }

type Primitive =
  | { type: "rect"; x: number; y: number; w: number; h: number; fill: string; stroke: string; radius: number; width: number }
  | { type: "circle"; x: number; y: number; r: number; fill: string; stroke: string; width: number }
  | { type: "line"; x1: number; y1: number; x2: number; y2: number; stroke: string; width: number }
  | { type: "path"; points: Point[]; fill: string; stroke: string; width: number; closed?: boolean }
  | { type: "text"; value: string; x: number; y: number; maxWidth: number; size: number; fill: string; weight: number; anchor: "start" | "middle" | "end"; family?: FontFamily; italic?: boolean; underline?: boolean };
type Palette = { ink: string; muted: string; edge: string; surface: string; soft: string; accent: string; accentSoft: string; positive: string; warning: string; critical: string; shadow: string };

function paletteFor(group: GroupElement, theme: Theme): Palette {
  const dark = theme === "dark"; const host = typeof document === "undefined" ? undefined : document.querySelector<HTMLElement>(dark ? ".app-shell:is(.theme-dark, .theme-ai)" : ".app-shell.theme-light") ?? document.documentElement;
  const token = (name: string, fallback: string) => host && typeof getComputedStyle === "function" ? getComputedStyle(host).getPropertyValue(name).trim() || fallback : fallback;
  const safe = (value: string | null | undefined, fallback: string) => value && /^(#[\da-f]{3,8}|rgba?\([\d\s.,%]+\)|[a-z]+)$/i.test(value) ? value : fallback;
  const overrides = group.libraryComponent?.styleOverrides;
  return {
    ink: safe(overrides?.color, token("--diagram-ink", dark ? "#edf2f7" : "#182230")),
    muted: token("--diagram-muted", dark ? "#a8b4c2" : "#697789"),
    edge: safe(overrides?.color, token("--diagram-edge", dark ? "#465363" : "#d5dde6")),
    surface: overrides?.fillColor === null ? "transparent" : safe(overrides?.fillColor, token("--diagram-fill", dark ? "#1d2530" : "#ffffff")),
    soft: token("--diagram-soft", dark ? "#273342" : "#f2f5f9"),
    accent: token("--diagram-accent-blue", dark ? "#91b6ff" : "#386ee5"),
    accentSoft: dark ? "#263a5a" : "#edf3ff", positive: dark ? "#64d7a0" : "#16845a", warning: dark ? "#f1bd5b" : "#b96a08", critical: dark ? "#ff8991" : "#ca3947", shadow: dark ? "rgba(0,0,0,.2)" : "rgba(22,34,52,.07)",
  };
}

function fitted(value: string, maxWidth: number, size: number) {
  const text = value.replace(/[\r\n\t]+/g, " ").trim(); const limit = Math.max(1, Math.floor(maxWidth / Math.max(1, size * .56)));
  const chars = Array.from(text); return chars.length > limit ? `${chars.slice(0, Math.max(1, limit - 1)).join("").trimEnd()}…` : text;
}

function makePrimitives(group: GroupElement, theme: Theme): Primitive[] | undefined {
  const bounds = group.componentBounds; const meta = group.libraryComponent;
  if (!bounds || !meta || !isUiComponentKind(meta.kind)) return undefined;
  const props = uiProperties(group); const style = paletteFor(group, theme); const { x, y, w, h } = bounds;
  const simple = meta.appearance === "simple"; const radius = (value: number) => simple ? 0 : Math.max(2, Math.min(value, h / 2, w / 2));
  const p: Primitive[] = []; const inset = Math.max(8, Math.min(16, w * .055));
  const textStyle = meta.textStyle; const baseSize = Math.max(8, Math.min(16, textStyle?.fontSize ?? 12, h * .22));
  const title = props.title ?? ""; const itemList = (props.items ?? []).slice(0, 12);
  const rect = (rx: number, ry: number, rw: number, rh: number, fill = style.surface, stroke = style.edge, r = 8, sw = 1) => { if (rw > 0 && rh > 0) p.push({ type: "rect", x: rx, y: ry, w: rw, h: rh, fill, stroke, radius: radius(r), width: sw }); };
  const circle = (cx: number, cy: number, r: number, fill = style.surface, stroke = style.edge, sw = 1) => p.push({ type: "circle", x: cx, y: cy, r: Math.max(1, r), fill, stroke, width: sw });
  const line = (x1: number, y1: number, x2: number, y2: number, stroke = style.edge, sw = 1) => p.push({ type: "line", x1, y1, x2, y2, stroke, width: sw });
  const path = (points: Point[], fill = "none", stroke = style.edge, sw = 1, closed = false) => p.push({ type: "path", points, fill, stroke, width: sw, closed });
  const text = (value: string, tx: number, ty: number, maxWidth: number, size = baseSize, fill = style.ink, weight = 450, anchor: "start" | "middle" | "end" = "start") => {
    if (!value || maxWidth < 2 || h < 5) return;
    p.push({ type: "text", value: fitted(value, maxWidth, Math.max(5, size)), x: tx, y: ty, maxWidth, size: Math.max(5, size), fill: textStyle?.color ?? fill, weight: textStyle?.bold === undefined ? weight : textStyle.bold ? 700 : 400, anchor, family: textStyle?.fontFamily, italic: textStyle?.italic, underline: textStyle?.underline });
  };
  const surfaceCard = (rx = x, ry = y, rw = w, rh = h, r = 12) => { rect(rx, ry + 2, rw, rh, style.shadow, "none", r); rect(rx, ry, rw, rh, style.surface, style.edge, r); };
  const checkMark = (cx: number, cy: number, color: string, scale = 1) => path([{ x: cx - 3 * scale, y: cy }, { x: cx - scale, y: cy + 2.5 * scale }, { x: cx + 4 * scale, y: cy - 3.5 * scale }], "none", color, 1.8 * scale);
  const chevron = (cx: number, cy: number, direction: "left" | "right" | "down", color = style.muted) => direction === "left" ? path([{ x: cx + 2, y: cy - 4 }, { x: cx - 2, y: cy }, { x: cx + 2, y: cy + 4 }], "none", color, 1.6) : direction === "right" ? path([{ x: cx - 2, y: cy - 4 }, { x: cx + 2, y: cy }, { x: cx - 2, y: cy + 4 }], "none", color, 1.6) : path([{ x: cx - 4, y: cy - 2 }, { x: cx, y: cy + 2 }, { x: cx + 4, y: cy - 2 }], "none", color, 1.6);
  const searchIcon = (cx: number, cy: number, color: string) => { circle(cx - 1, cy - 1, 4, "none", color, 1.4); line(cx + 2, cy + 2, cx + 6, cy + 6, color, 1.6); };
  const calendarIcon = (cx: number, cy: number, color: string) => { rect(cx - 7, cy - 6, 14, 13, "none", color, 2, 1.2); line(cx - 7, cy - 2, cx + 7, cy - 2, color, 1.2); line(cx - 3, cy - 8, cx - 3, cy - 4, color, 1.2); line(cx + 3, cy - 8, cx + 3, cy - 4, color, 1.2); };
  const pill = (label: string, rx: number, ry: number, rw: number, rh: number, fill: string, ink: string) => { rect(rx, ry, rw, rh, fill, "none", rh / 2); text(label, rx + rw / 2, ry + rh / 2, rw - 8, Math.min(9, baseSize * .8), ink, 600, "middle"); };
  const fieldBox = (fieldY: number, titleWidth?: number) => {
    const placement = props.titlePlacement ?? "above"; const horizontal = placement === "leading" || placement === "trailing";
    const labelW = horizontal ? Math.min(w * .4, Math.max(42, title.length * baseSize * .52)) : w - inset * 2;
    const fieldX = placement === "leading" ? x + labelW + 8 : x + 1; const fieldW = horizontal ? Math.max(25, w - labelW - 10) : w - 2;
    const labelX = placement === "trailing" ? x + w - labelW : x + inset;
    const labelY = placement === "below" ? y + h - 5 : horizontal ? y + h / 2 : y + 12;
    const fy = horizontal ? y + 1 : fieldY; const fh = horizontal ? h - 2 : Math.max(15, h - (placement === "below" ? 29 : 27));
    text(title, labelX, labelY, Math.max(4, labelW - 2), Math.min(10, baseSize * .84), style.muted, 600);
    rect(fieldX, fy, fieldW, fh, style.surface, style.edge, 7);
    return { fieldX, fieldW, fieldY: fy, fieldH: fh, labelW: titleWidth ?? labelW };
  };

  if (meta.kind === "ui.button") {
    const tone = props.tone ?? "brand"; const fill = tone === "brand" ? style.accent : tone === "critical" ? style.critical : style.surface; const ink = tone === "brand" || tone === "critical" ? "#ffffff" : style.ink;
    rect(x, y, w, h, fill, tone === "neutral" ? style.edge : fill, 9, 1); line(x + 12, y + 1, x + w - 12, y + 1, "rgba(255,255,255,.18)", 1);
    text(title || "Action", x + w / 2, y + h / 2, w - inset * 2, Math.min(14, baseSize + 1), ink, 650, "middle");
  } else if (["ui.text-field", "ui.select", "ui.search", "ui.date-field", "ui.password-field", "ui.email-field"].includes(meta.kind)) {
    const f = fieldBox(y + Math.min(25, h * .38)); const startIcon = meta.kind === "ui.search"; const endIcon = meta.kind === "ui.select" || meta.kind === "ui.date-field";
    if (startIcon) searchIcon(f.fieldX + 15, f.fieldY + f.fieldH / 2, style.muted);
    const placeholder = meta.kind === "ui.password-field" ? "••••••••••" : props.placeholder ?? "Enter a value";
    text(placeholder, f.fieldX + (startIcon ? 29 : 11), f.fieldY + f.fieldH / 2, f.fieldW - (startIcon ? 42 : 24) - (endIcon ? 22 : 0), Math.min(11, baseSize), style.muted, 450);
    if (meta.kind === "ui.select") chevron(f.fieldX + f.fieldW - 15, f.fieldY + f.fieldH / 2, "down");
    if (meta.kind === "ui.date-field") calendarIcon(f.fieldX + f.fieldW - 17, f.fieldY + f.fieldH / 2, style.muted);
  } else if (meta.kind === "ui.textarea") {
    text(title, x + inset, y + 13, w - inset * 2, Math.min(10, baseSize * .84), style.muted, 600);
    const top = y + Math.min(23, h * .22); rect(x + 1, top, w - 2, Math.max(18, h - (top - y) - 1), style.surface, style.edge, 8);
    const words = (props.placeholder ?? "Write your message…").split(/\s+/); let cursorY = top + 16; let cursor = "";
    for (const word of words) { if ((cursor + " " + word).trim().length > Math.max(8, Math.floor((w - 32) / (baseSize * .55)))) { text(cursor, x + inset, cursorY, w - inset * 2, Math.min(10, baseSize * .82), style.muted, 400); cursorY += 15; cursor = word; } else cursor = `${cursor} ${word}`.trim(); }
    if (cursor) text(cursor, x + inset, cursorY, w - inset * 2, Math.min(10, baseSize * .82), style.muted, 400);
    line(x + w - 13, y + h - 7, x + w - 7, y + h - 13, style.muted, 1.1);
  } else if (meta.kind === "ui.file-upload") {
    rect(x + 1, y + 1, w - 2, h - 2, style.surface, style.edge, 9);
    p.push({ type: "path", points: [{ x: x + 20, y: y + h / 2 + 4 }, { x: x + 20, y: y + h / 2 - 6 }, { x: x + 16, y: y + h / 2 - 2 }, { x: x + 20, y: y + h / 2 - 6 }, { x: x + 24, y: y + h / 2 - 2 }], fill: "none", stroke: style.accent, width: 1.6 });
    text(title || "Attachments", x + 35, y + 19, w - 48, 10, style.ink, 600); text(props.placeholder ?? "Drop files or browse", x + 35, y + 36, w - 48, 9, style.muted, 400);
  } else if (meta.kind === "ui.checkbox-group" || meta.kind === "ui.radio-group") {
    const layout = choiceLayout(group); const titleY = layout.titlePlacement === "below" ? y + h - 7 : y + 15;
    if (!layout.horizontalTitle) text(title, x + 12, titleY, w - 24, Math.min(11, baseSize), style.ink, 650);
    else text(title, layout.titlePlacement === "trailing" ? x + w - layout.titleWidth : x + 12, y + h / 2, layout.titleWidth - 8, Math.min(11, baseSize), style.ink, 650);
    layout.items.forEach((item, index) => {
      const col = index % layout.columns; const row = Math.floor(index / layout.columns); const cellX = layout.contentX + col * (layout.cellWidth + layout.columnGap); const cy = layout.contentY + row * (layout.rowHeight + layout.rowGap) + layout.rowHeight / 2;
      const selected = meta.kind === "ui.checkbox-group" ? (layout.props.selectedItemIds ?? []).includes(item.id) : layout.props.selectedItemId === item.id;
      if (meta.kind === "ui.checkbox-group") { rect(cellX, cy - 6, 12, 12, selected ? style.accent : style.surface, selected ? style.accent : style.edge, 3); if (selected) checkMark(cellX + 6, cy, "#ffffff", .9); }
      else { circle(cellX + 6, cy, 6, style.surface, selected ? style.accent : style.edge, 1.3); if (selected) circle(cellX + 6, cy, 2.8, style.accent, style.accent); }
      text(item.label, cellX + 20, cy, layout.cellWidth - 22, Math.min(10, baseSize * .86), style.ink, 450);
    });
  } else if (meta.kind === "ui.switch") {
    text(title, x + inset, y + h / 2, w - 72, Math.min(12, baseSize), style.ink, 550); const sw = Math.min(46, w * .27); const sh = Math.min(25, h * .52); const sx = x + w - inset - sw; const sy = y + (h - sh) / 2;
    rect(sx, sy, sw, sh, props.checked ? style.accent : style.soft, props.checked ? style.accent : style.edge, sh / 2); circle(sx + (props.checked ? sw - sh / 2 : sh / 2), sy + sh / 2, sh * .36, "#ffffff", "rgba(0,0,0,.08)", 1);
  } else if (meta.kind === "ui.slider" || meta.kind === "ui.progress") {
    const progress = Math.max(0, Math.min(100, props.progress ?? (meta.kind === "ui.slider" ? 65 : 68))); text(title, x + inset, y + 15, w * .67, Math.min(11, baseSize), style.ink, 600); text(`${Math.round(progress)}%`, x + w - inset, y + 15, 40, 9, style.muted, 500, "end");
    const barY = y + h * .68; const barX = x + inset; const barW = w - inset * 2; rect(barX, barY, barW, 8, style.soft, "none", 4); rect(barX, barY, barW * progress / 100, 8, style.accent, "none", 4);
    if (meta.kind === "ui.slider") circle(barX + barW * progress / 100, barY + 4, 7, style.surface, style.accent, 2);
  } else if (meta.kind === "ui.card") {
    surfaceCard(x, y, w, h, 12); const imageH = Math.max(38, h * .35); rect(x + 1, y + 1, w - 2, imageH, style.accentSoft, "none", 11);
    path([{ x: x + w * .1, y: y + imageH - 6 }, { x: x + w * .35, y: y + imageH * .5 }, { x: x + w * .52, y: y + imageH * .72 }, { x: x + w * .67, y: y + imageH * .44 }, { x: x + w * .9, y: y + imageH - 6 }], theme === "dark" ? "#34465d" : "#d5e3f7", "none", 0, true);
    circle(x + w * .76, y + imageH * .34, Math.min(7, imageH * .13), style.accent, "none");
    text(title, x + inset, y + imageH + 17, w - inset * 2, Math.min(13, baseSize + 1), style.ink, 650); text(props.body ?? "A short description goes here.", x + inset, y + imageH + 37, w - inset * 2, 9, style.muted, 400);
    pill(props.action ?? "View details", x + inset, y + h - 31, Math.min(98, w - inset * 2), 22, style.accent, "#ffffff");
  } else if (meta.kind === "ui.app-bar") {
    surfaceCard(x, y, w, h, 11); rect(x + 12, y + h / 2 - 15, 30, 30, style.accent, "none", 9); text("S", x + 27, y + h / 2, 22, 14, "#ffffff", 700, "middle");
    text(title || "Workspace", x + 52, y + h / 2, w * .42, 12, style.ink, 650); const actionX = x + w - 76; searchIcon(actionX, y + h / 2, style.muted); circle(x + w - 26, y + h / 2, 17, style.accentSoft, "none"); text("JD", x + w - 26, y + h / 2, 30, 9, style.accent, 650, "middle");
  } else if (meta.kind === "ui.side-navigation") {
    surfaceCard(x, y, w, h, 11); rect(x + 12, y + 12, 28, 28, style.accent, "none", 8); text("S", x + 26, y + 26, 20, 12, "#ffffff", 700, "middle"); text(title || "Workspace", x + 49, y + 26, w - 60, 11, style.ink, 650);
    const rows = itemList.slice(0, 8); const rowTop = y + 54; const pitch = Math.max(22, (h - 65) / Math.max(1, rows.length));
    rows.forEach((item, index) => { const yy = rowTop + index * pitch; const selected = item.id === props.selectedItemId; if (selected) { rect(x + 7, yy - 9, w - 14, 20, style.accentSoft, "none", 6); rect(x + 7, yy - 5, 3, 12, style.accent, "none", 2); } circle(x + 23, yy + 1, 3.3, selected ? style.accent : style.soft, selected ? style.accent : style.edge); text(item.label, x + 35, yy + 1, w - 49, 9.5, selected ? style.accent : style.ink, selected ? 600 : 450); });
  } else if (meta.kind === "ui.tabs") {
    surfaceCard(x, y, w, h, 9); const tabs = itemList.slice(0, 6); const cell = w / Math.max(1, tabs.length);
    tabs.forEach((item, index) => { const cx = x + cell * index + cell / 2; const active = item.id === props.selectedItemId; text(item.label, cx, y + h / 2 - 1, cell - 8, 9.5, active ? style.accent : style.muted, active ? 650 : 500, "middle"); if (active) rect(x + cell * index + 8, y + h - 3, cell - 16, 2, style.accent, "none", 1); });
  } else if (meta.kind === "ui.image") {
    rect(x + 1, y + 1, w - 2, h - 2, style.soft, style.edge, 10); const cx = x + w / 2; const cy = y + h * .44; circle(cx, cy - 12, 7, style.accentSoft, "none"); path([{ x: cx - 38, y: cy + 22 }, { x: cx - 16, y: cy - 1 }, { x: cx + 1, y: cy + 13 }, { x: cx + 17, y: cy - 4 }, { x: cx + 39, y: cy + 22 }], theme === "dark" ? "#354961" : "#dce7f4", "none", 0, true); text(props.placeholder ?? title, cx, y + h - 14, w - 16, 9, style.muted, 500, "middle");
  } else if (meta.kind === "ui.alert") {
    const tone = props.tone ?? "positive"; const color = tone === "critical" ? style.critical : tone === "warning" ? style.warning : tone === "brand" ? style.accent : style.positive;
    rect(x + 1, y + 1, w - 2, h - 2, style.surface, style.edge, 10); rect(x + 1, y + 8, 3, h - 16, color, "none", 2); circle(x + 24, y + 25, 8, color, "none"); text(tone === "critical" ? "!" : tone === "warning" ? "!" : "✓", x + 24, y + 25, 14, 10, "#ffffff", 700, "middle"); text(title, x + 41, y + 22, w - 54, 11, style.ink, 650); text(props.body ?? "Status details appear here.", x + 41, y + 43, w - 54, 9, style.muted, 400);
  } else if (meta.kind === "ui.dialog") {
    rect(x, y, w, h, style.shadow, "none", 14); rect(x + 5, y + 5, w - 10, h - 10, style.surface, style.edge, 13); circle(x + 31, y + 34, 13, style.accentSoft, "none"); text("!", x + 31, y + 34, 18, 14, style.accent, 700, "middle"); text(title, x + 54, y + 34, w - 75, 13, style.ink, 650); text(props.body ?? "Review this action before you continue.", x + 20, y + 76, w - 40, 9.5, style.muted, 400);
    const buttonY = y + h - 48; const primaryW = Math.min(100, w * .34); const secondaryW = Math.min(88, w * .29); pill(props.secondaryAction ?? "Cancel", x + w - primaryW - secondaryW - 28, buttonY, secondaryW, 26, style.soft, style.ink); pill(props.action ?? "Confirm", x + w - primaryW - 15, buttonY, primaryW, 26, style.accent, "#ffffff");
  } else if (meta.kind === "ui.breadcrumbs") {
    let cx = x + 12; const items = itemList.slice(0, 5);
    items.forEach((item, index) => { const active = item.id === (props.selectedItemId ?? items[items.length - 1]?.id); const width = Math.max(20, Math.min(w * .35, item.label.length * 6 + 10)); text(item.label, cx, y + h / 2, width, 9.5, active ? style.ink : style.muted, active ? 600 : 450); cx += width + 4; if (index < items.length - 1) { chevron(cx, y + h / 2, "right", style.edge); cx += 10; } });
  } else if (meta.kind === "ui.avatar") {
    const d = Math.min(w, h) - 8; circle(x + w / 2, y + h / 2, d / 2, style.accentSoft, style.surface, 2); circle(x + w / 2, y + h / 2, d / 2 - 5, "none", style.accent, 1.2); text((title || "JD").slice(0, 3).toUpperCase(), x + w / 2, y + h / 2, d * .7, Math.min(14, baseSize + 2), style.accent, 700, "middle");
  } else if (meta.kind === "ui.badge") {
    const tone = props.tone ?? "positive"; const color = tone === "critical" ? style.critical : tone === "warning" ? style.warning : tone === "brand" ? style.accent : tone === "neutral" ? style.muted : style.positive; const badgeW = Math.min(w - 4, Math.max(54, title.length * baseSize * .58 + 28)); const bx = x + (w - badgeW) / 2; const fill = tone === "critical" ? "#fff0f1" : tone === "warning" ? "#fff6e6" : tone === "brand" ? style.accentSoft : tone === "neutral" ? style.soft : "#eaf8f1";
    rect(bx, y + 4, badgeW, h - 8, fill, "none", 16); circle(bx + 12, y + h / 2, 3, color, "none"); text(title, bx + 21, y + h / 2, badgeW - 27, 9, color, 600);
  } else if (meta.kind === "ui.list" || meta.kind === "ui.menu" || meta.kind === "ui.accordion") {
    surfaceCard(x, y, w, h, 10); const isMenu = meta.kind === "ui.menu"; const isAccordion = meta.kind === "ui.accordion"; text(title, x + 13, y + 17, w - 26, 10.5, style.ink, 650); const rows = itemList.slice(0, 8); const top = y + 37; const pitch = Math.max(20, (h - 43) / Math.max(1, rows.length));
    rows.forEach((item, index) => { const yy = top + index * pitch; const active = item.id === props.selectedItemId; if (isMenu && active) rect(x + 6, yy - 9, w - 12, pitch, style.accentSoft, "none", 5); if (isAccordion) line(x + 12, yy + pitch / 2, x + w - 12, yy + pitch / 2, style.edge, .7); if (meta.kind === "ui.list") circle(x + 17, yy + 1, 3.5, index === 0 ? style.accent : style.soft, index === 0 ? style.accent : style.edge); text(item.label, x + (meta.kind === "ui.list" ? 28 : 14), yy + 1, w - (meta.kind === "ui.list" ? 54 : 48), 9.5, active ? style.accent : style.ink, active ? 600 : 450); if (isAccordion || isMenu) chevron(x + w - 19, yy + 1, isAccordion && index === 0 ? "down" : "right", style.muted); });
  } else if (meta.kind === "ui.table") {
    const rows = itemList.slice(0, 12); const cols = 3; const rowCount = Math.max(2, Math.ceil(rows.length / cols)); const cellW = w / cols; const rowH = h / rowCount; rect(x, y, w, h, style.surface, style.edge, 8);
    for (let r = 0; r < rowCount; r++) { if (r === 0) rect(x + 1, y + 1, w - 2, rowH, style.soft, "none", 7); for (let c = 0; c < cols; c++) { const i = r * cols + c; const xx = x + c * cellW; if (c) line(xx, y, xx, y + h, style.edge, .7); if (r) line(x, y + r * rowH, x + w, y + r * rowH, style.edge, .7); text(rows[i]?.label ?? (r === 0 ? ["Name", "Role", "Status"][c] : "—"), xx + 7, y + r * rowH + rowH / 2, cellW - 14, 8.5, r === 0 ? style.ink : style.muted, r === 0 ? 600 : 450); } }
  } else if (meta.kind === "ui.toast") {
    surfaceCard(x, y, w, h, 11); const tone = props.tone ?? "positive"; const color = tone === "critical" ? style.critical : tone === "warning" ? style.warning : style.positive; circle(x + 23, y + h / 2, 10, color, "none"); checkMark(x + 23, y + h / 2, "#ffffff", .8); text(title, x + 42, y + 28, w - 70, 10.5, style.ink, 650); text(props.body ?? "Your work is up to date.", x + 42, y + 49, w - 58, 9, style.muted, 400); line(x + w - 18, y + 14, x + w - 10, y + 22, style.muted, 1.2); line(x + w - 10, y + 14, x + w - 18, y + 22, style.muted, 1.2);
  } else if (meta.kind === "ui.pagination") {
    const items = itemList.slice(0, 7); const gap = 5; const bw = Math.min(32, (w - 28 - gap * (items.length + 1)) / (items.length + 2)); let bx = x + 12; const by = y + (h - 30) / 2;
    rect(bx, by, bw, 30, style.surface, style.edge, 7); chevron(bx + bw / 2, y + h / 2, "left"); bx += bw + gap;
    items.forEach(item => { const selected = item.id === props.selectedItemId; rect(bx, by, bw, 30, selected ? style.accent : style.surface, selected ? style.accent : style.edge, 7); text(item.label, bx + bw / 2, y + h / 2, bw - 3, 9, selected ? "#ffffff" : style.ink, selected ? 650 : 450, "middle"); bx += bw + gap; });
    rect(bx, by, bw, 30, style.surface, style.edge, 7); chevron(bx + bw / 2, y + h / 2, "right");
  } else if (meta.kind === "ui.divider") {
    line(x + inset, y + h / 2, x + w - inset, y + h / 2, style.edge, 1); if (title) { const tw = Math.min(w * .4, title.length * baseSize * .58 + 10); rect(x + w / 2 - tw / 2, y + h / 2 - 9, tw, 18, style.surface, "none", 0); text(title, x + w / 2, y + h / 2, tw, 8, style.muted, 500, "middle"); }
  } else if (meta.kind === "ui.footer") {
    line(x + 1, y + 3, x + w - 1, y + 3, style.edge, 1); rect(x + 10, y + h / 2 - 13, 26, 26, style.accent, "none", 7); text("S", x + 23, y + h / 2, 18, 11, "#ffffff", 700, "middle"); text(title, x + 44, y + h / 2, Math.max(38, w * .34), 8.5, style.muted, 500); const links = itemList.slice(0, 5); const step = Math.min(62, w * .15); links.forEach((item, index) => text(item.label, x + w - links.length * step + index * step, y + h / 2, step - 4, 8.5, style.muted, 450, "middle"));
  }
  return p;
}

function drawPrimitive(ctx: CanvasRenderingContext2D, item: Primitive) {
  ctx.save(); ctx.lineCap = "round"; ctx.lineJoin = "round";
  if (item.type === "rect") {
    ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(item.x, item.y, item.w, item.h, item.radius); else ctx.rect(item.x, item.y, item.w, item.h);
    if (item.fill !== "none" && item.fill !== "transparent") { ctx.fillStyle = item.fill; ctx.fill(); }
    if (item.stroke !== "none" && item.stroke !== "transparent") { ctx.strokeStyle = item.stroke; ctx.lineWidth = item.width; ctx.stroke(); }
  } else if (item.type === "circle") {
    ctx.beginPath(); ctx.arc(item.x, item.y, item.r, 0, Math.PI * 2);
    if (item.fill !== "none" && item.fill !== "transparent") { ctx.fillStyle = item.fill; ctx.fill(); }
    if (item.stroke !== "none" && item.stroke !== "transparent") { ctx.strokeStyle = item.stroke; ctx.lineWidth = item.width; ctx.stroke(); }
  } else if (item.type === "line" || item.type === "path") {
    ctx.beginPath(); if (item.type === "line") { ctx.moveTo(item.x1, item.y1); ctx.lineTo(item.x2, item.y2); } else { item.points.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y)); if (item.closed) ctx.closePath(); }
    if (item.type === "path" && item.fill !== "none" && item.fill !== "transparent") { ctx.fillStyle = item.fill; ctx.fill(); }
    if (item.stroke !== "none" && item.stroke !== "transparent") { ctx.strokeStyle = item.stroke; ctx.lineWidth = item.width; ctx.stroke(); }
  } else {
    ctx.fillStyle = item.fill; ctx.font = componentFont(item.size, item.weight, item.family, item.italic); ctx.textAlign = item.anchor === "middle" ? "center" : item.anchor === "end" ? "right" : "left"; ctx.textBaseline = "alphabetic";
    ctx.fillText(item.value, item.x, item.y + componentBaselineOffset(item.size, item.weight, item.family, item.italic), item.maxWidth);
    if (item.underline) { const width = Math.min(item.maxWidth, ctx.measureText(item.value).width); const left = item.anchor === "middle" ? item.x - width / 2 : item.anchor === "end" ? item.x - width : item.x; ctx.fillRect(left, item.y + item.size * .38, width, Math.max(1, item.size / 14)); }
  }
  ctx.restore();
}

export function uiChoiceIndexAtPoint(group: GroupElement, point: Point): number | undefined {
  if (!group.componentBounds || !group.libraryComponent || !["ui.checkbox-group", "ui.radio-group"].includes(group.libraryComponent.kind)) return undefined;
  const { items, contentX, contentY, columns, columnGap, rowGap, cellWidth, rowHeight } = choiceLayout(group);
  const contentWidth = cellWidth * columns + columnGap * (columns - 1); const localX = point.x - contentX; const localY = point.y - contentY;
  if (localX < 0 || localX > contentWidth || localY < 0) return undefined;
  const column = Math.floor(localX / (cellWidth + columnGap)); const row = Math.floor(localY / (rowHeight + rowGap));
  if (column < 0 || column >= columns || localX - column * (cellWidth + columnGap) > cellWidth || localY - row * (rowHeight + rowGap) > rowHeight) return undefined;
  const index = row * columns + column;
  return index >= 0 && index < items.length ? index : undefined;
}

export function uiItemIndexAtPoint(group: GroupElement, point: Point): number | undefined {
  const bounds = group.componentBounds; const kind = group.libraryComponent?.kind; const items = uiProperties(group).items ?? [];
  if (!bounds || !kind || !items.length) return undefined;
  const x = point.x - bounds.x; const y = point.y - bounds.y;
  if (kind === "ui.tabs") {
    const visibleCount = Math.min(6, items.length); if (x < 0 || x > bounds.w || y < 0 || y > bounds.h) return undefined;
    return Math.min(visibleCount - 1, Math.floor(x / (bounds.w / visibleCount)));
  }
  if (kind === "ui.side-navigation" || kind === "ui.menu") {
    const visibleItems = items.slice(0, kind === "ui.side-navigation" ? 8 : 8);
    const top = kind === "ui.side-navigation" ? 54 : 37;
    const pitch = kind === "ui.side-navigation" ? Math.max(22, (bounds.h - 65) / Math.max(1, visibleItems.length)) : Math.max(20, (bounds.h - 43) / Math.max(1, visibleItems.length));
    const index = Math.floor((y - top) / pitch);
    return x >= 4 && x <= bounds.w - 4 && index >= 0 && index < visibleItems.length && y <= top + pitch * visibleItems.length ? index : undefined;
  }
  if (kind === "ui.pagination") {
    const visibleItems = items.slice(0, 7); const gap = 5; const buttonWidth = Math.min(32, (bounds.w - 28 - gap * (visibleItems.length + 1)) / (visibleItems.length + 2));
    const top = (bounds.h - 30) / 2; if (y < top || y > top + 30) return undefined;
    const first = 12; const previousEnd = first + buttonWidth;
    if (x >= first && x <= previousEnd) return Math.max(0, visibleItems.findIndex(item => item.id === uiProperties(group).selectedItemId) - 1);
    let start = previousEnd + gap;
    for (let index = 0; index < visibleItems.length; index++) {
      if (x >= start && x <= start + buttonWidth) return index;
      start += buttonWidth + gap;
    }
    if (x >= start && x <= start + buttonWidth) return Math.min(visibleItems.length - 1, Math.max(0, visibleItems.findIndex(item => item.id === uiProperties(group).selectedItemId)) + 1);
  }
  return undefined;
}

export function drawUiComponent(ctx: CanvasRenderingContext2D, group: GroupElement, theme: Theme) {
  const bounds = group.componentBounds; const primitives = makePrimitives(group, theme); if (!bounds || !primitives) return false;
  ctx.save(); ctx.beginPath(); ctx.rect(bounds.x - 1, bounds.y - 1, bounds.w + 2, bounds.h + 2); ctx.clip();
  for (const primitive of primitives) {
    if (primitive.type === "line" || primitive.type === "path") ctx.setLineDash(strokeDashPattern(group.libraryComponent?.styleOverrides?.lineStyle ?? "solid", primitive.width));
    drawPrimitive(ctx, primitive);
  }
  ctx.restore(); return true;
}

function xml(value: string) { return value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&apos;" })[char]!); }
function svgStroke(style: StrokeStyle, width: number) { const dash = strokeDashPattern(style, width); return dash.length ? ` stroke-dasharray="${dash.join(" ")}"` : ""; }

export function uiComponentSvg(group: GroupElement, theme: Theme = "light") {
  const primitives = makePrimitives(group, theme); const meta = group.libraryComponent; if (!primitives || !meta) return undefined;
  const lineStyle = meta.styleOverrides?.lineStyle ?? "solid";
  return `<g data-component="${xml(meta.kind)}">${primitives.map(item => {
    if (item.type === "rect") return `<rect x="${item.x}" y="${item.y}" width="${item.w}" height="${item.h}" rx="${item.radius}" fill="${xml(item.fill)}" stroke="${xml(item.stroke)}" stroke-width="${item.width}"${svgStroke(lineStyle, item.width)}/>`;
    if (item.type === "circle") return `<circle cx="${item.x}" cy="${item.y}" r="${item.r}" fill="${xml(item.fill)}" stroke="${xml(item.stroke)}" stroke-width="${item.width}"${svgStroke(lineStyle, item.width)}/>`;
    if (item.type === "line") return `<path d="M ${item.x1} ${item.y1} L ${item.x2} ${item.y2}" fill="none" stroke="${xml(item.stroke)}" stroke-width="${item.width}"${svgStroke(lineStyle, item.width)}/>`;
    if (item.type === "path") return `<path d="${item.points.map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`).join(" ")}${item.closed ? " Z" : ""}" fill="${xml(item.fill)}" stroke="${xml(item.stroke)}" stroke-width="${item.width}"${svgStroke(lineStyle, item.width)}/>`;
    return `<text x="${item.x}" y="${item.y}" text-anchor="${item.anchor}" dominant-baseline="middle" fill="${xml(item.fill)}" font-family="${xml(componentFontFamily(item.family))}" font-size="${item.size}" font-weight="${item.weight}"${item.italic ? " font-style=\"italic\"" : ""}${item.underline ? " text-decoration=\"underline\"" : ""}>${xml(item.value)}</text>`;
  }).join("")}</g>`;
}
