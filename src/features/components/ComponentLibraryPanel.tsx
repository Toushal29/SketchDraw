import { createEffect, createMemo, createSignal, For, onCleanup, Show } from "solid-js";
import { Portal } from "solid-js/web";
import type { ComponentMaster, Theme } from "../../model";
import { LibraryComponentIcon } from "../../components/LibraryComponentIcon";
import { LIBRARY_COMPONENTS, type LibraryComponentKind } from "./library-components";
import type { CustomStencil } from "./custom-stencils";
import "./component-library-panel.css";

type Filter = "all" | "gui" | "stencils" | "masters" | `section:${string}`;
type StencilView = "all" | "recent" | "favorites";

type Props = {
  open: boolean;
  anchor: () => HTMLButtonElement | undefined;
  canInsert: boolean;
  canEditLibrary: boolean;
  canSaveSelection: boolean;
  busy: boolean;
  theme: Theme;
  stencils: CustomStencil[];
  favorites: string[];
  recent: string[];
  masters: ComponentMaster[];
  onPointerEnter: () => void;
  onPointerLeave: () => void;
  onInsertComponent: (kind: LibraryComponentKind) => void;
  onInsertStencil: (stencil: CustomStencil) => void;
  onInsertMaster: (master: ComponentMaster) => void;
  onToggleFavorite: (id: string) => void;
  onRemoveStencil: (id: string) => void;
  onSaveSelection: () => void;
  onCreateMaster: () => void;
  onImport: () => void;
  onExport: () => void;
  onSpawnAll: () => void;
};

const sectionName = (section: string) => {
  const [group, ...categories] = section.split("|").map(part => part.trim());
  return [group === "Forms & UI" ? "GUI" : group, ...categories].join(" · ");
};
const filters: { id: Filter; label: string; count?: number }[] = [
  { id: "all", label: "All", count: LIBRARY_COMPONENTS.length },
  { id: "gui", label: "GUI design", count: LIBRARY_COMPONENTS.filter(component => component.section.startsWith("Forms & UI")).length },
  ...[...new Set(LIBRARY_COMPONENTS.map(component => component.section))].sort().map(section => ({ id: `section:${section}` as const, label: sectionName(section), count: LIBRARY_COMPONENTS.filter(component => component.section === section).length })),
  { id: "stencils", label: "My stencils" },
  { id: "masters", label: "Document components" },
];

export function ComponentLibraryPanel(props: Props) {
  const [filter, setFilter] = createSignal<Filter>("all");
  const [stencilView, setStencilView] = createSignal<StencilView>("all");
  const [query, setQuery] = createSignal("");
  let panelElement: HTMLElement | undefined;
  let frame = 0;

  const placePanel = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const panel = panelElement;
      const source = props.anchor();
      const visibleAnchors = [...document.querySelectorAll<HTMLElement>(".component-library-tool")].filter(element => {
        const bounds = element.getBoundingClientRect();
        return element.getClientRects().length > 0 && bounds.width > 0 && bounds.height > 0;
      });
      const anchorElement = visibleAnchors.find(element => element === source) ?? visibleAnchors[0] ?? source;
      const anchor = anchorElement?.getBoundingClientRect();
      if (!panel || !anchor || anchor.width <= 0 || anchor.height <= 0) return;
      const edge = 12;
      const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      const width = Math.min(720, viewportWidth - edge * 2);
      const left = Math.max(edge, Math.min(anchor.left + anchor.width / 2 - width / 2, viewportWidth - width - edge));
      const wantedHeight = Math.min(680, viewportHeight - edge * 2);
      const below = viewportHeight - anchor.bottom - edge - 6;
      const above = anchor.top - edge - 6;
      const openBelow = below >= Math.min(300, wantedHeight) || below >= above;
      const top = openBelow ? anchor.bottom + 6 : Math.max(edge, anchor.top - wantedHeight - 6);
      panel.style.left = `${left}px`;
      panel.style.top = `${top}px`;
      panel.style.width = `${width}px`;
      panel.style.maxHeight = `${Math.max(180, Math.min(wantedHeight, viewportHeight - top - edge))}px`;
    });
  };

  createEffect(() => {
    if (!props.open) return;
    placePanel();
    window.addEventListener("resize", placePanel);
    window.addEventListener("scroll", placePanel, true);
    const observer = new ResizeObserver(placePanel);
    const anchor = props.anchor();
    if (anchor) observer.observe(anchor);
    onCleanup(() => { cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener("resize", placePanel); window.removeEventListener("scroll", placePanel, true); });
  });

  const componentGroups = createMemo(() => {
    const normalizedQuery = query().trim().toLowerCase();
    const groups = new Map<string, typeof LIBRARY_COMPONENTS>();
    for (const component of LIBRARY_COMPONENTS) {
      const selectedFilter = filter();
      const matchesFilter = selectedFilter === "all"
        || selectedFilter === "gui" && component.section.startsWith("Forms & UI")
        || selectedFilter.startsWith("section:") && component.section === selectedFilter.slice("section:".length);
      if (!matchesFilter || normalizedQuery && !`${component.label} ${component.description} ${component.section}`.toLowerCase().includes(normalizedQuery)) continue;
      const entries = groups.get(component.section) ?? [];
      entries.push(component);
      groups.set(component.section, entries);
    }
    return [...groups.entries()].map(([section, entries]) => ({ section: sectionName(section), entries }));
  });

  const visibleStencils = createMemo(() => {
    const normalizedQuery = query().trim().toLowerCase();
    const available = stencilView() === "favorites"
      ? props.stencils.filter(stencil => props.favorites.includes(stencil.id))
      : stencilView() === "recent"
        ? props.recent.flatMap(id => { const stencil = props.stencils.find(item => item.id === id); return stencil ? [stencil] : []; })
        : props.stencils;
    return available.filter(stencil => !normalizedQuery || `${stencil.name} ${stencil.tags.join(" ")} ${stencil.folder ?? ""} ${stencil.preview}`.toLowerCase().includes(normalizedQuery));
  });
  const visibleMasters = createMemo(() => {
    const normalizedQuery = query().trim().toLowerCase();
    return props.masters.filter(master => !normalizedQuery || `${master.name} ${master.template.map(item => item.type).join(" ")}`.toLowerCase().includes(normalizedQuery));
  });

  const selectFilter = (next: Filter) => { setFilter(next); setQuery(""); };

  return <Portal mount={document.body}>
    <Show when={props.open}>
      <aside ref={element => { panelElement = element; if (props.open) placePanel(); }} class="component-library-panel" classList={{ "theme-dark": props.theme === "dark", "theme-light": props.theme === "light" }} role="dialog" aria-label="Components" onPointerDown={event => event.stopPropagation()} onPointerEnter={props.onPointerEnter} onPointerLeave={event => { if (event.pointerType === "mouse") props.onPointerLeave(); }}>
        <label class="component-library-search"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5"/><path d="m13 13 4 4"/></svg><input type="search" aria-label="Search components" placeholder="Search components" value={query()} onInput={event => setQuery(event.currentTarget.value)} /></label>
        <nav class="component-library-tabs" aria-label="Filter components">
          <For each={filters}>{item => <button type="button" class={filter() === item.id ? "active" : ""} aria-pressed={filter() === item.id} onClick={() => selectFilter(item.id)}>{item.label}<Show when={item.count !== undefined}><small>{item.count}</small></Show></button>}</For>
        </nav>
        <div class="component-library-body">
          <Show when={filter() === "all" || filter() === "gui" || filter().startsWith("section:")}>
            <For each={componentGroups()}>{group => <section class="component-library-group" aria-label={group.section}>
              <h3>{group.section}<small>{group.entries.length}</small></h3>
              <div class="component-library-grid"><For each={group.entries}>{component => <button type="button" class="component-library-item" title={component.description} disabled={!props.canInsert} onClick={() => props.onInsertComponent(component.kind)}><LibraryComponentIcon kind={component.kind} loadProviderArtwork={props.open} /><span>{component.label}</span></button>}</For></div>
            </section>}</For>
            <Show when={!componentGroups().length}><p class="component-library-empty">No components found.</p></Show>
          </Show>

          <Show when={filter() === "stencils"}>
            <div class="component-library-subtabs" role="group" aria-label="Saved stencil filter">
              <For each={[{ id: "all", label: "All" }, { id: "recent", label: "Recent" }, { id: "favorites", label: "Favorites" }] as const}>{item => <button type="button" class={stencilView() === item.id ? "active" : ""} aria-pressed={stencilView() === item.id} onClick={() => setStencilView(item.id)}>{item.label}</button>}</For>
              <button type="button" disabled={!props.canEditLibrary || props.busy} onClick={props.onImport}>Import</button>
              <button type="button" disabled={!props.canEditLibrary || props.busy || !props.stencils.length && !props.masters.length} onClick={props.onExport}>Export</button>
            </div>
            <Show when={props.canSaveSelection}><div class="component-library-actions"><button type="button" disabled={!props.canEditLibrary} onClick={props.onSaveSelection}>Save selection as stencil</button><button type="button" disabled={!props.canEditLibrary} onClick={props.onCreateMaster}>Create document component</button></div></Show>
            <div class="component-library-saved-list"><For each={visibleStencils()}>{stencil => <article class="component-library-saved-item">
              <button type="button" class="component-library-saved-insert" title={`Insert ${stencil.name}`} disabled={!props.canInsert} onClick={() => props.onInsertStencil(stencil)}><strong>{stencil.name}</strong><small>{stencil.folder ? `${stencil.folder} · ` : ""}{stencil.preview}</small></button>
              <button type="button" class="component-library-icon-action" aria-label={`${props.favorites.includes(stencil.id) ? "Remove from" : "Add to"} favorites: ${stencil.name}`} aria-pressed={props.favorites.includes(stencil.id)} onClick={() => props.onToggleFavorite(stencil.id)}>{props.favorites.includes(stencil.id) ? "★" : "☆"}</button>
              <button type="button" class="component-library-icon-action" aria-label={`Delete stencil ${stencil.name}`} disabled={!props.canEditLibrary} onClick={() => props.onRemoveStencil(stencil.id)}>×</button>
            </article>}</For><Show when={!visibleStencils().length}><p class="component-library-empty">No saved stencils found.</p></Show></div>
          </Show>

          <Show when={filter() === "masters"}>
            <Show when={props.canSaveSelection}><div class="component-library-actions"><button type="button" disabled={!props.canEditLibrary} onClick={props.onCreateMaster}>Create component from selection</button></div></Show>
            <div class="component-library-saved-list"><For each={visibleMasters()}>{master => <button type="button" class="component-library-master" title={`Insert ${master.name}`} disabled={!props.canInsert} onClick={() => props.onInsertMaster(master)}><strong>{master.name}</strong><small>{master.template.length} objects</small></button>}</For><Show when={!visibleMasters().length}><p class="component-library-empty">No document components found.</p></Show></div>
          </Show>
        </div>
        <Show when={filter() !== "stencils" && filter() !== "masters"}><footer class="component-library-footer"><span>{LIBRARY_COMPONENTS.length} components</span><button type="button" disabled={!props.canInsert || props.busy} onClick={props.onSpawnAll}>{props.busy ? "Preparing…" : "Spawn all components"}</button></footer></Show>
      </aside>
    </Show>
  </Portal>;
}
