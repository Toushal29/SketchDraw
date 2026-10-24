import { createMemo, createSignal, For, Show } from "solid-js";
import type { ArrowHead, ArrowRoute, ComponentMaster, FlowchartShape, LineRoute, StrokeStyle } from "../../model";
import { LIBRARY_COMPONENTS, type LibraryComponentKind } from "../../notes";
import { FLOWCHART_SHAPES, GENERAL_SHAPES } from "../diagrams/config";
import type { CustomStencil } from "../components/custom-stencils";
import { LibraryComponentIcon } from "../../components/LibraryComponentIcon";

type PrimitiveShape = "rectangle" | "circle" | "diamond" | "triangle";

export type DesignPaletteItem =
  | { type: "primitive"; shape: PrimitiveShape; label: string }
  | { type: "connector"; connector: "line" | "arrow"; route: LineRoute | ArrowRoute; lineStyle: StrokeStyle; startHead: ArrowHead; endHead: ArrowHead; label: string }
  | { type: "text"; label: string }
  | { type: "flowchart"; shape: FlowchartShape; label: string }
  | { type: "component"; kind: LibraryComponentKind; label: string }
  | { type: "schema-table"; label: string }
  | { type: "custom-stencil"; stencil: CustomStencil; label: string }
  | { type: "component-master"; master: ComponentMaster; label: string };

type PaletteEntry = { item: DesignPaletteItem; searchText: string };
type PaletteSection = { name: string; entries: PaletteEntry[] };

const COMPONENT_GROUPS = [
  { name: "Diagram structure", sources: ["General"] },
  { name: "Database", sources: ["ER", "Database"] },
  { name: "Architecture", sources: ["Architecture"] },
  { name: "Software", sources: ["Software"] },
  { name: "Cloud", sources: ["Cloud"] },
  { name: "Network", sources: ["Network"] },
  { name: "UML", sources: ["UML"] },
  { name: "BPMN", sources: ["BPMN"] },
  { name: "Data visualization", sources: ["Data visualization"] },
  { name: "Text & annotations", sources: ["Annotations & aids"] },
] as const;

const COMPONENT_GROUP_BY_SOURCE = new Map<string, string>(
  COMPONENT_GROUPS.flatMap(group => group.sources.map(source => [source, group.name] as const)),
);

const primitiveShapes: { shape: PrimitiveShape; label: string; path: string }[] = [
  { shape: "rectangle", label: "Rectangle", path: "M4 5h16v14H4z" },
  { shape: "circle", label: "Ellipse", path: "M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0z" },
  { shape: "diamond", label: "Diamond", path: "m12 3 9 9-9 9-9-9z" },
  { shape: "triangle", label: "Triangle", path: "m12 4 9 16H3z" },
];

const connectorPresets: Omit<Extract<DesignPaletteItem, { type: "connector" }>, "type">[] = [
  { connector: "line", route: "straight", lineStyle: "solid", startHead: "none", endHead: "none", label: "Straight line" },
  { connector: "line", route: "elbow", lineStyle: "solid", startHead: "none", endHead: "none", label: "Elbow line" },
  { connector: "line", route: "curve", lineStyle: "solid", startHead: "none", endHead: "none", label: "Curved line" },
  { connector: "line", route: "straight", lineStyle: "dashed", startHead: "none", endHead: "none", label: "Dashed line" },
  { connector: "line", route: "straight", lineStyle: "dotted", startHead: "none", endHead: "none", label: "Dotted line" },
  { connector: "line", route: "straight", lineStyle: "double", startHead: "none", endHead: "none", label: "Double line" },
  { connector: "arrow", route: "straight", lineStyle: "solid", startHead: "none", endHead: "open", label: "Arrow" },
  { connector: "arrow", route: "elbow", lineStyle: "solid", startHead: "none", endHead: "open", label: "Elbow arrow" },
  { connector: "arrow", route: "curve", lineStyle: "solid", startHead: "none", endHead: "open", label: "Curve arrow" },
  { connector: "arrow", route: "forked", lineStyle: "solid", startHead: "none", endHead: "open", label: "Forked arrow" },
  { connector: "arrow", route: "straight", lineStyle: "solid", startHead: "none", endHead: "solid", label: "Filled arrow" },
  { connector: "arrow", route: "straight", lineStyle: "solid", startHead: "solid", endHead: "solid", label: "Two-way arrow" },
  { connector: "arrow", route: "straight", lineStyle: "dashed", startHead: "none", endHead: "open", label: "Dashed arrow" },
  { connector: "arrow", route: "straight", lineStyle: "dotted", startHead: "none", endHead: "open", label: "Dotted arrow" },
];

function connectorIconPath(item: Extract<DesignPaletteItem, { type: "connector" }>) {
  const routes: Record<string, string> = {
    straight: "M4 12h15",
    elbow: "M4 5v7h15",
    curve: "M4 18Q12 4 20 18",
    forked: "M4 12h8m0 0 7-6m-7 6 7 6",
    loop: "M4 17C3 4 20 4 20 17",
    jagged: "m4 12 4-6 4 12 4-12 4 6",
  };
  return routes[item.route] ?? routes.straight;
}

function createPaletteSections(stencils: CustomStencil[], masters: ComponentMaster[]): PaletteSection[] {
  const components = new Map<string, PaletteEntry[]>(COMPONENT_GROUPS.map(group => [group.name, []]));
  for (const component of LIBRARY_COMPONENTS) {
    const sourceGroup = component.section.split("|")[0].trim();
    const category = COMPONENT_GROUP_BY_SOURCE.get(sourceGroup);
    // New component families must be assigned to a real palette group before they are shown.
    if (!category) continue;
    const entries = components.get(category)!;
    entries.push({ item: { type: "component", kind: component.kind, label: component.label }, searchText: `${component.label} ${component.description} ${component.section}` });
  }

  const architectureEntries = components.get("Architecture")!;
  const bpmnEntries = components.get("BPMN")!;

  const databaseEntries: PaletteEntry[] = [
    { item: { type: "schema-table", label: "Schema table" }, searchText: "schema table entity sql database relational table" },
    ...components.get("Database")!,
  ];
  const basicShapeEntries: PaletteEntry[] = [
    ...primitiveShapes.map(shape => ({ item: { type: "primitive" as const, shape: shape.shape, label: shape.label }, searchText: shape.label })),
    ...GENERAL_SHAPES.map(shape => ({ item: { type: "flowchart" as const, shape: shape.value, label: shape.label }, searchText: `${shape.label} general shape ${shape.value}` })),
  ];
  const connectorEntries = connectorPresets.map(preset => ({
    item: { type: "connector" as const, ...preset },
    searchText: `${preset.label} ${preset.connector} connector ${preset.route} ${preset.lineStyle} line arrow C4 relationship BPMN sequence flow message flow data association`,
  }));
  const sections: PaletteSection[] = [
    { name: "Basic shapes", entries: basicShapeEntries },
    { name: "Connectors", entries: connectorEntries },
    { name: "Flowchart", entries: FLOWCHART_SHAPES.map(shape => ({ item: { type: "flowchart", shape: shape.value, label: shape.label }, searchText: `${shape.label} flowchart ${shape.value}` })) },
    { name: "Database", entries: databaseEntries },
    { name: "Architecture", entries: architectureEntries },
    { name: "Software", entries: components.get("Software")! },
    { name: "Cloud", entries: components.get("Cloud")! },
    { name: "Network", entries: components.get("Network")! },
    { name: "UML", entries: components.get("UML")! },
    { name: "BPMN", entries: bpmnEntries },
    { name: "Data visualization", entries: components.get("Data visualization")! },
    { name: "Diagram structure", entries: components.get("Diagram structure")! },
    { name: "Text & annotations", entries: [
      { item: { type: "text", label: "Text" }, searchText: "text label annotation" },
      ...components.get("Text & annotations")!,
    ] },
  ];
  if (stencils.length) sections.push({ name: "My stencils", entries: stencils.map(stencil => ({ item: { type: "custom-stencil", stencil, label: stencil.name }, searchText: `${stencil.name} ${stencil.tags.join(" ")} ${stencil.folder ?? ""} ${stencil.preview}` })) });
  if (masters.length) sections.push({ name: "Reusable components", entries: masters.map(master => ({ item: { type: "component-master", master, label: master.name }, searchText: `${master.name} reusable component` })) });
  return sections.filter(section => section.entries.length > 0);
}

function PaletteIcon(props: { item: DesignPaletteItem }) {
  const item = props.item;
  if (item.type === "component") return <LibraryComponentIcon kind={item.kind} />;
  if (item.type === "flowchart") {
    const shape = [...FLOWCHART_SHAPES, ...GENERAL_SHAPES].find(entry => entry.value === item.shape);
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d={shape?.path ?? "M4 4h16v16H4z"} /></svg>;
  }
  if (item.type === "primitive") {
    const shape = primitiveShapes.find(entry => entry.shape === item.shape);
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d={shape?.path ?? "M4 4h16v16H4z"} /></svg>;
  }
  if (item.type === "connector") {
    const path = connectorIconPath(item);
    return <svg viewBox="0 0 24 24" aria-hidden="true">
      {item.lineStyle === "double" && <path d={path} transform="translate(0 2)" />}
      <path d={path} stroke-dasharray={item.lineStyle === "dashed" ? "3 2" : item.lineStyle === "dotted" ? "1 2" : undefined} />
      {item.startHead !== "none" && <path d={item.startHead === "solid" ? "m8 8-4 4 4 4z" : "m8 8-4 4 4 4"} fill={item.startHead === "solid" ? "currentColor" : "none"} />}
      {item.endHead !== "none" && <path d={item.endHead === "solid" ? "m16 8 4 4-4 4z" : "m16 8 4 4-4 4"} fill={item.endHead === "solid" ? "currentColor" : "none"} />}
    </svg>;
  }
  if (item.type === "text") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M12 6v13m-4 0h8" /><text x="8" y="17" fill="currentColor" stroke="none" font-size="8">T</text></svg>;
  if (item.type === "schema-table") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="1" /><path d="M3 9h18M3 14h18" /></svg>;
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M8 9h8M8 13h5" /></svg>;
}

/** Show built-in and user-saved design shapes in a searchable, expandable palette. */
export function DesignShapePalette(props: {
  collapsed: boolean;
  disabled: boolean;
  stencils: CustomStencil[];
  masters: ComponentMaster[];
  onToggle: () => void;
  onInsert: (item: DesignPaletteItem) => void;
}) {
  const [search, setSearch] = createSignal("");
  const [openSections, setOpenSections] = createSignal(new Set(["Basic shapes"]));
  // Build the shape catalog once per document palette update, then filter it as the query changes.
  const paletteSections = createMemo(() => createPaletteSections(props.stencils, props.masters));
  function updateSearch(value: string) {
    setSearch(value);
    const query = value.trim().toLowerCase();
    if (!query) return;
    const matches = paletteSections().filter(section => section.entries.some(entry => `${entry.searchText} ${section.name}`.toLowerCase().includes(query)));
    setOpenSections(current => new Set([...current, ...matches.map(section => section.name)]));
  }
  const sections = createMemo(() => {
    const query = search().trim().toLowerCase();
    return paletteSections()
      .map(section => ({ ...section, entries: section.entries.filter(entry => !query || `${entry.searchText} ${section.name}`.toLowerCase().includes(query)) }))
      .filter(section => section.entries.length > 0);
  });

  return <div class="design-shape-library">
    <header class="design-palette-heading">
      <label class="design-palette-search">
        <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" /><path d="m13 13 4 4" /></svg>
        <input type="search" aria-label="Search shapes" placeholder="Search Shapes" value={search()} onInput={event => updateSearch(event.currentTarget.value)} />
      </label>
      <button type="button" class="design-panel-toggle" aria-label={props.collapsed ? "Expand shape library" : "Collapse shape library"} title={props.collapsed ? "Expand panel" : "Collapse panel"} aria-expanded={!props.collapsed} onClick={props.onToggle}>
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d={props.collapsed ? "M4 10h12m-5-5 5 5-5 5" : "M16 10H4m5-5-5 5 5 5"} /></svg>
      </button>
    </header>
    <div class="design-palette-groups">
      <For each={sections()}>{section => {
        const sectionId = `design-palette-${section.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
        const isOpen = () => openSections().has(section.name);
        return <section class="design-palette-section">
        <button type="button" class="design-palette-section-toggle" aria-expanded={isOpen()} aria-controls={sectionId} onClick={() => setOpenSections(current => {
          const next = new Set(current);
          if (next.has(section.name)) next.delete(section.name);
          else next.add(section.name);
          return next;
        })}>
          <span>{section.name}</span><small>{section.entries.length}</small><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg>
        </button>
          <div class="design-palette-grid" id={sectionId} role="group" aria-label={`${section.name} shapes`} hidden={!isOpen()}>
          <Show when={isOpen()}>
            <For each={section.entries}>{entry => <button type="button" class="design-palette-item" title={entry.item.label} aria-label={`Add ${entry.item.label}`} disabled={props.disabled} onClick={() => props.onInsert(entry.item)}>
              <PaletteIcon item={entry.item} />
              <span>{entry.item.label}</span>
            </button>}</For>
          </Show>
          </div>
      </section>}}</For>
      <Show when={!sections().length}><p class="design-palette-empty">No matching shapes</p></Show>
    </div>
  </div>;
}
