import { createMemo, createSignal, For, Show } from "solid-js";
import type { ArrowHead, ArrowRoute, ComponentMaster, FlowchartShape, LineRoute, StrokeStyle } from "../../model";
import { LIBRARY_COMPONENTS, type LibraryComponentKind } from "../components/library-components";
import { BASIC_SHAPES, FLOWCHART_SHAPES, GENERAL_SHAPES, type BasicShapeTool } from "../shapes/shape-catalog";
import type { CustomStencil } from "../components/custom-stencils";
import { LibraryComponentIcon } from "../../components/LibraryComponentIcon";
import { cloudNeutralComponent, cloudProviderComponent } from "../diagrams/cloud-providers";
import { proposalComponentSubcategory } from "../components/proposal-components";

type PrimitiveShape = BasicShapeTool;

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
type PaletteSection = { name: string; category: string; entries: PaletteEntry[] };

const COMPONENT_GROUPS = [
  { name: "Diagram structure", category: "Diagram structure", sources: ["General"] },
  { name: "Database", category: "Database, data & schemas", sources: ["ER", "Database", "Data & schemas"] },
  { name: "Architecture", category: "Software architecture & integration", sources: ["Architecture", "Architecture patterns"] },
  { name: "GUI design", category: "Wireframing & UI", sources: ["Forms & UI", "Wireframing & UI"] },
  { name: "Software", category: "Software architecture & integration", sources: ["Software"] },
  { name: "Cloud", category: "Cloud", sources: ["Cloud"] },
  { name: "Network", category: "Network", sources: ["Network"] },
  { name: "UML", category: "Systems engineering & UML", sources: ["UML", "Systems engineering"] },
  { name: "BPMN", category: "BPMN & decision modelling", sources: ["BPMN", "Decision modelling"] },
  { name: "Visual planning & decision", category: "Visual planning & decisions", sources: ["Visual planning"] },
  { name: "Data visualization", category: "Data visualization", sources: ["Data visualization"] },
  { name: "Text & annotations", category: "Drawing basics", sources: ["Annotations & aids"] },
] as const;

const COMPONENT_GROUP_BY_SOURCE = new Map<string, string>(
  COMPONENT_GROUPS.flatMap(group => group.sources.map(source => [source, group.name] as const)),
);
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
  const proposalSectionCategories = new Map<string, string>();
  for (const component of LIBRARY_COMPONENTS) {
    const sourceGroup = component.section.split("|")[0].trim();
    const category = COMPONENT_GROUP_BY_SOURCE.get(sourceGroup);
    // New component families must be assigned to a real palette group before they are shown.
    if (!category) continue;
    const proposalSection = proposalComponentSubcategory(component.kind);
    const sectionName = proposalSection ?? category;
    if (proposalSection) proposalSectionCategories.set(sectionName, category);
    if (!components.has(sectionName)) components.set(sectionName, []);
    const entries = components.get(sectionName)!;
    entries.push({ item: { type: "component", kind: component.kind, label: component.label }, searchText: `${component.label} ${component.description} ${component.section}` });
  }

  const architectureEntries = components.get("Architecture")!;
  const bpmnEntries = components.get("BPMN")!;

  const databaseEntries: PaletteEntry[] = [
    { item: { type: "schema-table", label: "Schema table" }, searchText: "schema table entity sql database relational table" },
    ...components.get("Database")!,
  ];
  const basicShapeEntries: PaletteEntry[] = [
    ...BASIC_SHAPES.map(shape => ({ item: { type: "primitive" as const, shape: shape.value, label: shape.label }, searchText: shape.label })),
    ...GENERAL_SHAPES.map(shape => ({ item: { type: "flowchart" as const, shape: shape.value, label: shape.label }, searchText: `${shape.label} general shape ${shape.value}` })),
  ];
  const connectorEntries = connectorPresets.map(preset => ({
    item: { type: "connector" as const, ...preset },
    searchText: `${preset.label} ${preset.connector} connector ${preset.route} ${preset.lineStyle} line arrow C4 relationship BPMN sequence flow message flow data association`,
  }));
  const sections: PaletteSection[] = [
    { name: "Basic shapes", category: "Drawing basics", entries: basicShapeEntries },
    { name: "Connectors", category: "Drawing basics", entries: connectorEntries },
    { name: "Flowchart", category: "Drawing basics", entries: FLOWCHART_SHAPES.map(shape => ({ item: { type: "flowchart", shape: shape.value, label: shape.label }, searchText: `${shape.label} flowchart ${shape.value}` })) },
    { name: "Database", category: "Database, data & schemas", entries: databaseEntries },
    { name: "Architecture", category: "Software architecture & integration", entries: architectureEntries },
    { name: "GUI design", category: "Wireframing & UI", entries: components.get("GUI design")! },
    { name: "Software", category: "Software architecture & integration", entries: components.get("Software")! },
    { name: "Cloud", category: "Cloud", entries: components.get("Cloud")! },
    { name: "Network", category: "Network", entries: components.get("Network")! },
    { name: "UML", category: "Systems engineering & UML", entries: components.get("UML")! },
    { name: "BPMN", category: "BPMN & decision modelling", entries: bpmnEntries },
    { name: "Visual planning", category: "Visual planning & decisions", entries: components.get("Visual planning & decision")! },
    { name: "Data visualization", category: "Data visualization", entries: components.get("Data visualization")! },
    { name: "Diagram structure", category: "Diagram structure", entries: components.get("Diagram structure")! },
    { name: "Text & annotations", category: "Drawing basics", entries: [
      { item: { type: "text", label: "Text" }, searchText: "text label annotation" },
      ...components.get("Text & annotations")!,
    ] },
  ];
  for (const [name, category] of proposalSectionCategories) sections.push({ name, category, entries: components.get(name) ?? [] });
  if (stencils.length) sections.push({ name: "My stencils", category: "My stencils", entries: stencils.map(stencil => ({ item: { type: "custom-stencil", stencil, label: stencil.name }, searchText: `${stencil.name} ${stencil.tags.join(" ")} ${stencil.folder ?? ""} ${stencil.preview}` })) });
  if (masters.length) sections.push({ name: "Reusable components", category: "Reusable components", entries: masters.map(master => ({ item: { type: "component-master", master, label: master.name }, searchText: `${master.name} reusable component` })) });
  return sections.filter(section => section.entries.length > 0);
}

function paletteEntryMatches(entry: PaletteEntry, section: string, words: readonly string[]): boolean {
  if (!words.length) return true;
  const haystack = `${entry.searchText} ${section}`.toLocaleLowerCase();
  return words.every(word => haystack.includes(word));
}

function PaletteIcon(props: { item: DesignPaletteItem }) {
  const item = props.item;
  if (item.type === "component") return <LibraryComponentIcon kind={item.kind} />;
  if (item.type === "flowchart") {
    const shape = [...FLOWCHART_SHAPES, ...GENERAL_SHAPES].find(entry => entry.value === item.shape);
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d={shape?.path ?? "M4 4h16v16H4z"} /></svg>;
  }
  if (item.type === "primitive") {
    const shape = BASIC_SHAPES.find(entry => entry.value === item.shape);
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
  const [expandedSections, setExpandedSections] = createSignal(new Set<string>());
  let searchInput: HTMLInputElement | undefined;
  let searchComposing = false;
  // Keep the catalog independent from the query so typing only updates the
  // visible results and never rebuilds or replaces the search control.
  const paletteSections = createMemo(() => createPaletteSections(props.stencils, props.masters));
  function updateSearch(value: string, input?: HTMLInputElement) {
    const retainFocus = !!input && document.activeElement === input;
    const selectionStart = input?.selectionStart ?? null;
    const selectionEnd = input?.selectionEnd ?? null;
    setSearch(current => current === value ? current : value);
    if (retainFocus) requestAnimationFrame(() => {
      const currentInput = searchInput;
      if (!currentInput?.isConnected) return;

      // A matching-results update can replace the active input while Solid
      // commits the newly visible palette items. Restore focus after that DOM
      // commit, but leave focus alone if the user moved to another control.
      const activeElement = document.activeElement;
      if (activeElement !== currentInput && activeElement !== document.body && activeElement !== input) return;
      if (activeElement !== currentInput) currentInput.focus({ preventScroll: true });
      if (currentInput !== input && selectionStart !== null && selectionEnd !== null) {
        currentInput.setSelectionRange(selectionStart, selectionEnd);
      }
    });
  }
  const searchWords = createMemo(() => search().trim().toLocaleLowerCase().split(/\s+/).filter(Boolean));
  const filteredEntries = createMemo(() => {
    const words = searchWords();
    const visible = new Map<string, PaletteEntry[]>();
    for (const section of paletteSections()) {
      const entries = words.length ? section.entries.filter(entry => paletteEntryMatches(entry, `${section.category} ${section.name}`, words)) : section.entries;
      if (entries.length) visible.set(section.name, entries);
    }
    return visible;
  });
  const sectionByName = (name: string) => paletteSections().find(section => section.name === name);
  const visibleSections = createMemo(() => [...filteredEntries().keys()]);
  const entriesFor = (name: string) => filteredEntries().get(name) ?? [];
  const allSectionsExpanded = () => visibleSections().length > 0 && visibleSections().every(name => expandedSections().has(name));
  const toggleAllSections = () => setExpandedSections(() => {
    if (allSectionsExpanded()) return new Set<string>();
    return new Set(visibleSections());
  });

  return <div class="design-shape-library">
    <header class="design-palette-heading">
      <label class="design-palette-search">
        <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" /><path d="m13 13 4 4" /></svg>
        <input ref={element => { searchInput = element; element.value = search(); }} type="text" inputmode="search" enterkeyhint="search" autocomplete="off" autocapitalize="none" spellcheck={false} aria-label="Search shapes" placeholder="Search shapes" onCompositionStart={() => { searchComposing = true; }} onCompositionEnd={event => { searchComposing = false; updateSearch(event.currentTarget.value, event.currentTarget); }} onInput={event => { if (!searchComposing) updateSearch(event.currentTarget.value, event.currentTarget); }} onKeyDown={event => { if (event.key === "Escape" && search()) { event.preventDefault(); event.stopPropagation(); event.currentTarget.value = ""; updateSearch("", event.currentTarget); } }} />
      </label>
      <button type="button" class="design-palette-sections-toggle" aria-label={allSectionsExpanded() ? "Collapse all shape categories" : "Expand all shape categories"} title={allSectionsExpanded() ? "Collapse all categories" : "Expand all categories"} aria-expanded={allSectionsExpanded()} disabled={!!searchWords().length || !visibleSections().length} onClick={toggleAllSections}>
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d={allSectionsExpanded() ? "m5 12 5-5 5 5m-10 5 5-5 5 5" : "m5 8 5 5 5-5m-10-5 5 5 5-5"} /></svg>
      </button>
      <button type="button" class="design-panel-toggle" aria-label={props.collapsed ? "Expand shape library" : "Collapse shape library"} title={props.collapsed ? "Expand panel" : "Collapse panel"} aria-expanded={!props.collapsed} onClick={props.onToggle}>
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d={props.collapsed ? "M4 10h12m-5-5 5 5-5 5" : "M16 10H4m5-5-5 5 5 5"} /></svg>
      </button>
    </header>
    <div class="design-palette-groups">
      <For each={visibleSections()}>{sectionName => {
        const sectionId = `design-palette-${sectionName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
        const entries = () => entriesFor(sectionName);
        const section = () => sectionByName(sectionName);
        const isExpanded = () => !!searchWords().length || expandedSections().has(sectionName);
        return <section class="design-palette-section" aria-labelledby={`${sectionId}-heading`}>
          <button type="button" class="design-palette-section-toggle" id={`${sectionId}-heading`} aria-controls={sectionId} aria-expanded={isExpanded()} onClick={() => setExpandedSections(current => {
            const next = new Set(current);
            if (next.has(sectionName)) next.delete(sectionName);
            else next.add(sectionName);
            return next;
          })}>
            <span><small>{section()?.category}</small>{sectionName}</span><small>{entries().length}</small>
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg>
          </button>
          <div class="design-palette-grid" id={sectionId} role="group" aria-label={`${sectionName} shapes`} hidden={!isExpanded()}>
            <Show when={isExpanded()}>
              <For each={entries()}>{entry => <button type="button" class="design-palette-item" classList={{ "design-palette-item-model-component": entry.item.type === "component" && (!!cloudProviderComponent(entry.item.kind) || !!cloudNeutralComponent(entry.item.kind)) }} title={entry.item.label} aria-label={`Add ${entry.item.label}`} disabled={props.disabled} onClick={() => props.onInsert(entry.item)}>
                <PaletteIcon item={entry.item} />
                <span>{entry.item.label}</span>
              </button>}</For>
            </Show>
          </div>
        </section>;
      }}</For>
      <Show when={!visibleSections().length}><p class="design-palette-empty">No matching shapes</p></Show>
    </div>
  </div>;
}
