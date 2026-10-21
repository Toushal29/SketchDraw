import { createMemo, createSignal, For, Show } from "solid-js";
import { LibraryComponentIcon } from "../../components/LibraryComponentIcon";
import { LIBRARY_COMPONENTS } from "../../notes";

/** Explain the built-in modeling symbols without leaving the Planning workspace. */
export function ModelingGuide() {
  const [query, setQuery] = createSignal("");
  const groups = createMemo(() => {
    const term = query().trim().toLowerCase();
    const sections = new Map<string, typeof LIBRARY_COMPONENTS>();
    for (const component of LIBRARY_COMPONENTS) {
      if (term && !`${component.label} ${component.description} ${component.section}`.toLowerCase().includes(term)) continue;
      const section = component.section.replace(" | ", " - ");
      const entries = sections.get(section) ?? [];
      entries.push(component);
      sections.set(section, entries);
    }
    return [...sections].map(([name, components]) => ({ name, components }));
  });

  return <div class="project-page modeling-guide-page">
    <div class="project-page-heading">
      <div><span class="project-eyebrow">REFERENCE</span><h1>Modeling guide</h1><p>Look up what each diagram component represents and where it fits.</p></div>
      <label class="modeling-guide-search"><span>Search components</span><input type="search" value={query()} placeholder="Search by name or purpose" onInput={event => setQuery(event.currentTarget.value)} /></label>
    </div>
    <Show when={groups().length} fallback={<div class="project-empty-state"><strong>No components match</strong><p>Try a shorter name or a different term.</p></div>}>
      <div class="modeling-guide-groups">
        <For each={groups()}>{group => <section class="modeling-guide-group">
          <h2>{group.name}<span>{group.components.length}</span></h2>
          <div class="modeling-guide-grid">
            <For each={group.components}>{component => <article class="modeling-guide-item">
              <span class="modeling-guide-icon"><LibraryComponentIcon kind={component.kind} /></span>
              <div><h3>{component.label}</h3><p>{component.description}</p></div>
            </article>}</For>
          </div>
        </section>}</For>
      </div>
    </Show>
  </div>;
}
