import { createEffect, createSignal, For, Show } from "solid-js";
import type { DiagramGuide, DiagramGuideCategory, DiagramGuideId, GuideNode } from "./guide-diagrams";
import { DIAGRAM_GUIDES, guideEdgePoints } from "./guide-diagrams";
import { shapePathData } from "../../shapes/geometry";
import type { ShapeElement } from "../../../model";
import "./diagram-guides.css";

type Props = { onClose: () => void; onInsert: (id: DiagramGuideId) => void };
const categories: (DiagramGuideCategory | "All guides")[] = ["All guides", "Architecture", "Flowchart", "UML", "Database", "Data flow", "API", "BPMN", "Network", "Brainstorming", "UX", "DevOps", "Security", "Operations"];
const guideCategoryClass = (category: DiagramGuideCategory) => "diagram-guide-category guide-category-" + category.toLowerCase().replace(/[^a-z0-9]+/g, "-");

function previewPath(node: GuideNode) {
  const type = node.flowchartShape ? "flowchart" : node.shape ?? "rectangle";
  if (type === "rectangle") return undefined;
  const shape: ShapeElement = { type, x: node.x, y: node.y, w: node.w, h: node.h, color: "#526b84", thickness: 1, ...(node.flowchartShape ? { flowchartShape: node.flowchartShape } : {}) };
  return shapePathData(shape);
}

function GuidePreviewNode(props: { node: GuideNode }) {
  const item = props.node;
  const { title, x, y, w, h, component: kind } = item;
  if (kind === "uml-actor") return <g class="guide-preview-node"><circle cx={x + w / 2} cy={y + 19} r="10" fill={item.fill ?? "#ffffff"} /><path class="guide-preview-detail" d={`M${x + w / 2} ${y + 29} V${y + h * .62} M${x + w * .2} ${y + h * .42} H${x + w * .8} M${x + w / 2} ${y + h * .62} L${x + w * .25} ${y + h * .78} M${x + w / 2} ${y + h * .62} L${x + w * .75} ${y + h * .78}`} /><text x={x + w / 2} y={y + h - 5} text-anchor="middle">{title}</text></g>;
  if (kind === "uml-use-case") return <g class="guide-preview-node"><ellipse cx={x + w / 2} cy={y + h / 2} rx={w / 2 - 3} ry={h / 2 - 3} fill={item.fill ?? "#ffffff"} /><text x={x + w / 2} y={y + h / 2} text-anchor="middle">{title}</text></g>;
  if (kind === "uml-lifeline") return <g class="guide-preview-node"><rect x={x} y={y} width={w} height="35" rx="7" fill="#ffffff"/><text x={x + w / 2} y={y + 19} text-anchor="middle">{title}</text><path class="guide-preview-detail" d={`M${x + w / 2} ${y + 35} V${y + h}`} stroke-dasharray="10 8" /></g>;
  if (kind === "uml-component") return <g class="guide-preview-node"><rect x={x} y={y} width={w} height={h} rx="7" fill={item.fill ?? "#ffffff"}/><path class="guide-preview-detail" d={`M${x + w - 28} ${y + 15} h16 v12 h-16z M${x + w - 28} ${y + 35} h16 v12 h-16z`} /><text x={x + w / 2} y={y + h / 2} text-anchor="middle">{title}</text></g>;
  if (kind === "uml-node") return <g class="guide-preview-node"><path d={`M${x + 12} ${y + 13} l16 -12 h${w - 29} l-16 12 v${h - 14} h${w - 13} v-${h - 14} M${x + 12} ${y + 13} h${w - 13}`} fill={item.fill ?? "#ffffff"} /><text x={x + w / 2 + 6} y={y + h / 2} text-anchor="middle">{title}</text></g>;
  if (kind === "uml-artifact") return <g class="guide-preview-node"><path d={`M${x} ${y} H${x + w - 20} L${x + w} ${y + 20} V${y + h} H${x} Z M${x + w - 20} ${y} V${y + 20} H${x + w}`} fill={item.fill ?? "#ffffff"} /><text x={x + w / 2} y={y + h / 2} text-anchor="middle">{title}</text></g>;
  if (kind === "c4-system" || kind === "c4-container" || kind === "c4-component") return <g class="guide-preview-node"><rect x={x} y={y} width={w} height={h} rx="8" fill={item.fill ?? "#ffffff"} stroke-dasharray="12 8" /><text x={x + 16} y={y + 30} text-anchor="start">{title}</text></g>;
  if (kind === "uml-class" || kind === "er-table") return <g class="guide-preview-node"><rect x={x} y={y} width={w} height={h} rx="8" fill="#ffffff"/><rect class="guide-preview-node-header" x={x + 2} y={y + 2} width={w - 4} height="42" rx="6" fill={item.fill ?? "#e8eff8"}/><text x={x + w / 2} y={y + 26} text-anchor="middle">{title}</text><path class="guide-preview-detail" d={`M${x} ${y + 46} H${x + w} M${x} ${y + 94} H${x + w}`} /></g>;
  if (kind === "bpmn-start" || kind === "bpmn-end") return <g class="guide-preview-node"><circle cx={x + w / 2} cy={y + h / 2} r={Math.min(w, h) * .42} fill="#ffffff" stroke-width={kind === "bpmn-end" ? 7 : 4}/>{kind === "bpmn-end" && <circle cx={x + w / 2} cy={y + h / 2} r={Math.min(w, h) * .32} fill="none" stroke="#526b84" stroke-width="4"/>}<text x={x + w / 2} y={y + h + 24} text-anchor="middle">{title}</text></g>;
  if (kind === "bpmn-gateway") return <g class="guide-preview-node"><path d={`M${x + w / 2} ${y} L${x + w} ${y + h / 2} L${x + w / 2} ${y + h} L${x} ${y + h / 2} Z`} fill="#ffffff"/><path class="guide-preview-detail" d={`M${x + w * .34} ${y + h * .34} L${x + w * .66} ${y + h * .66} M${x + w * .66} ${y + h * .34} L${x + w * .34} ${y + h * .66}`} /></g>;
  if (kind === "c4-person") return <g class="guide-preview-node"><circle cx={x + w / 2} cy={y + 22} r="10" fill="#ffffff"/><path class="guide-preview-detail" d={`M${x + w / 2} ${y + 32} V${y + 72} M${x + w * .28} ${y + 45} H${x + w * .72} M${x + w / 2} ${y + 72} L${x + w * .3} ${y + 92} M${x + w / 2} ${y + 72} L${x + w * .7} ${y + 92}`} /><text x={x + w / 2} y={y + h - 10} text-anchor="middle">{title}</text></g>;
  const path = previewPath(item);
  return <g class="guide-preview-node">{path ? <path d={path} fill={item.fill ?? "#ffffff"} /> : <rect x={x} y={y} width={w} height={h} rx="12" fill={item.fill ?? "#ffffff"} />}<text x={x + w / 2} y={y + h / 2} text-anchor="middle">{title.length > 18 ? `${title.slice(0, 16)}…` : title}</text></g>;
}

function GuidePreview(props: { guide: DiagramGuide }) {
  const guide = () => props.guide;
  return <svg class="diagram-guide-preview" viewBox={`0 0 ${guide().width} ${guide().height}`} role="img" aria-label={`${guide().title} diagram preview`}>
    <defs><linearGradient id={`guide-bg-${guide().id}`} x1="0" y1="0" x2="1" y2="1"><stop stop-color="#eef6ff"/><stop offset="1" stop-color="#f5f0ff"/></linearGradient><marker id={`guide-arrow-${guide().id}`} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 8 4 0 8z" fill="#8498ad"/></marker></defs>
    <rect width={guide().width} height={guide().height} rx="24" fill={`url(#guide-bg-${guide().id})`}/>
    <For each={guide().nodes.filter(node => node.background)}>{node => <GuidePreviewNode node={node}/>}</For>
    <For each={guide().edges}>{edge => { const from = guide().nodes[edge.from]; const to = guide().nodes[edge.to]; if (!from || !to) return null; const points = guideEdgePoints(edge, guide().nodes); const midX = (points.start.x + points.end.x) / 2; const midY = (points.start.y + points.end.y) / 2; return <g class="guide-preview-edge"><path classList={{ "guide-preview-dashed": !!edge.dashed }} d={`M${points.start.x} ${points.start.y} L${points.end.x} ${points.end.y}`} marker-end={edge.arrow === false ? undefined : `url(#guide-arrow-${guide().id})`}/><Show when={edge.label}><text x={midX} y={midY - 8}>{edge.label}</text></Show></g>; }}</For>
    <For each={guide().nodes.filter(node => !node.background)}>{node => <GuidePreviewNode node={node}/>}</For>
  </svg>;
}

export function DiagramGuideGallery(props: Props) {
  const [category, setCategory] = createSignal<DiagramGuideCategory | "All guides">("All guides");
  const [query, setQuery] = createSignal("");
  const [selectedId, setSelectedId] = createSignal<DiagramGuideId | undefined>(DIAGRAM_GUIDES[0]?.id);
  const [mobileDetail, setMobileDetail] = createSignal(false);
  const visibleGuides = () => {
    const needle = query().trim().toLocaleLowerCase();
    return DIAGRAM_GUIDES.filter(guide => (category() === "All guides" || guide.category === category()) && (!needle || [guide.title, guide.category, guide.summary, guide.use, guide.tip, ...guide.lesson.tags, ...guide.lesson.steps, ...guide.lesson.practices, ...guide.lesson.pitfalls].join(" ").toLocaleLowerCase().includes(needle)));
  };
  const selectedGuide = () => visibleGuides().find(guide => guide.id === selectedId());
  const countFor = (item: DiagramGuideCategory | "All guides") => item === "All guides" ? DIAGRAM_GUIDES.length : DIAGRAM_GUIDES.filter(guide => guide.category === item).length;
  const selectGuide = (guide: DiagramGuide) => { setSelectedId(guide.id); setMobileDetail(true); };
  const showCategory = (item: DiagramGuideCategory | "All guides") => { setCategory(item); setMobileDetail(false); const first = DIAGRAM_GUIDES.find(guide => item === "All guides" || guide.category === item); setSelectedId(first?.id); };
  const openRelated = (id: DiagramGuideId) => { const guide = DIAGRAM_GUIDES.find(item => item.id === id); if (!guide) return; setCategory("All guides"); setQuery(""); setSelectedId(id); setMobileDetail(true); };
  createEffect(() => {
    const visible = visibleGuides();
    if (!visible.some(guide => guide.id === selectedId())) setSelectedId(visible[0]?.id);
  });

  return <div class="diagram-guides-backdrop" role="presentation" onPointerDown={event => { if (event.target === event.currentTarget) props.onClose(); }}>
    <section class="diagram-guides-dialog" classList={{ "mobile-guide-detail": mobileDetail() }} role="dialog" aria-modal="true" aria-labelledby="diagram-guides-title" onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); props.onClose(); } }}>
      <header class="diagram-guides-header">
        <div class="diagram-guides-heading-copy"><h2 id="diagram-guides-title">Diagram guide library</h2></div>
        <button type="button" class="diagram-guides-close" aria-label="Close diagram guides" onClick={props.onClose}>×</button>
      </header>
      <details class="diagram-guides-sidebar" open>
        <summary class="diagram-guides-sidebar-toggle"><span><strong>Browse diagrams</strong><small>{visibleGuides().length} guides</small></span><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4"/></svg></summary>
        <aside class="diagram-guides-sidebar-content" aria-label="Browse diagram guides">
        <label class="diagram-guides-search"><span>Search guides</span><input type="search" value={query()} placeholder="Try ‘C4’, ‘data flow’…" onInput={event => setQuery(event.currentTarget.value)} /><Show when={query()}><button type="button" aria-label="Clear search" onClick={() => setQuery("")}>×</button></Show></label>
        <nav class="diagram-guides-categories" aria-label="Guide categories"><For each={categories}>{item => <button type="button" classList={{ active: category() === item }} aria-pressed={category() === item} onClick={() => showCategory(item)}><span>{item}</span><small>{countFor(item)}</small></button>}</For></nav>
        <div class="diagram-guides-list-heading"><strong>Examples</strong><span>{visibleGuides().length}</span></div>
        <nav class="diagram-guides-list" aria-label="Diagram guide examples">
          <For each={visibleGuides()}>{guide => <button type="button" class="diagram-guide-picker" classList={{ active: selectedId() === guide.id }} aria-current={selectedId() === guide.id ? "true" : undefined} onClick={() => selectGuide(guide)}><span class={guideCategoryClass(guide.category)}>{guide.category}</span><strong>{guide.title}</strong><small>{guide.summary}</small><span class="diagram-guide-picker-meta">{guide.lesson.level} <i>·</i> {guide.lesson.minutes} min</span></button>}</For>
          <Show when={!visibleGuides().length}><p class="diagram-guides-empty">No guides match that search. Try another phrase or category.</p></Show>
        </nav>
        </aside>
      </details>
      <main class="diagram-guide-detail" aria-live="polite">
        <Show when={selectedGuide()} fallback={<div class="diagram-guide-empty-detail"><span>⌕</span><h3>Choose a diagram guide</h3><p>Select an example to see its preview, steps, and modeling notes.</p></div>}>
          {guide => <>
            <button type="button" class="diagram-guide-mobile-back" onClick={() => setMobileDetail(false)}><span aria-hidden="true">←</span> All guides</button>
            <div class="diagram-guide-detail-preview"><GuidePreview guide={guide()}/><span class="diagram-guide-preview-caption">Editable example preview</span></div>
            <div class="diagram-guide-detail-copy">
              <div class="diagram-guide-detail-meta"><span class={guideCategoryClass(guide().category)}>{guide().category}</span><span>{guide().lesson.level}</span><span>{guide().lesson.minutes} min read</span></div>
              <h3>{guide().title}</h3><p class="diagram-guide-lead">{guide().summary}</p>
              <section class="diagram-guide-purpose"><span>When to use it</span><p>{guide().use}</p></section>
              <section class="diagram-guide-section"><h4>Build the diagram</h4><ol><For each={guide().lesson.steps}>{step => <li>{step}</li>}</For></ol></section>
              <div class="diagram-guide-advice-grid">
                <section class="diagram-guide-section diagram-guide-good"><h4>Good practices</h4><ul><For each={guide().lesson.practices}>{item => <li>{item}</li>}</For></ul></section>
                <section class="diagram-guide-section diagram-guide-watch"><h4>Common traps</h4><ul><For each={guide().lesson.pitfalls}>{item => <li>{item}</li>}</For></ul></section>
              </div>
              <section class="diagram-guide-tip"><strong>Modeling tip</strong><p>{guide().tip}</p></section>
              <section class="diagram-guide-section diagram-guide-references"><h4>References</h4><a href={guide().source.href} target="_blank" rel="noreferrer">{guide().source.label}<span aria-hidden="true">↗</span></a></section>
              <Show when={guide().lesson.related.length}><section class="diagram-guide-section diagram-guide-related"><h4>Related guides</h4><div><For each={guide().lesson.related}>{id => { const related = DIAGRAM_GUIDES.find(item => item.id === id); return <Show when={related}>{item => <button type="button" onClick={() => openRelated(item().id)}>{item().title}<span aria-hidden="true">→</span></button>}</Show>; }}</For></div></section></Show>
              <Show when={guide().lesson.tags.length}><div class="diagram-guide-tags" aria-label="Guide topics"><For each={guide().lesson.tags}>{tag => <span>{tag}</span>}</For></div></Show>
            </div>
          </>}
        </Show>
      </main>
      <footer class="diagram-guides-footer"><span>{visibleGuides().length} of {DIAGRAM_GUIDES.length} guides</span><div><button type="button" class="diagram-guides-close-footer" onClick={props.onClose}>Close</button><button type="button" class="diagram-guides-insert" disabled={!selectedGuide()} onClick={() => { const guide = selectedGuide(); if (guide) props.onInsert(guide.id); }}>Insert editable example <span aria-hidden="true">↗</span></button></div></footer>
    </section>
  </div>;
}
