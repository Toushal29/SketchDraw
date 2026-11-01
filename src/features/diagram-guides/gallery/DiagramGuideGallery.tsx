import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js";
import type { DiagramGuide, DiagramGuideCategory, DiagramGuideId, GuideNode } from "../guide-diagrams";
import { DIAGRAM_GUIDES } from "../guide-diagrams";
import { layoutDiagramGuide } from "../guide-engine";
import { shapePathData } from "../../shapes/geometry";
import type { ShapeElement } from "../../../model";
import "./diagram-guide-gallery.css";

type Props = { onClose: () => void; onInsert: (id: DiagramGuideId) => void };

const categories: (DiagramGuideCategory | "All guides")[] = [
  "All guides", "Workshop", "Diagram types", "Architecture", "Flowchart", "UML", "Database", "Data flow",
  "API", "BPMN", "Network", "Brainstorming", "UX", "DevOps", "Security", "Operations",
];

const guideCategoryClass = (category: DiagramGuideCategory) =>
  `diagram-guide-category diagram-guide-category--${category.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

function previewPath(node: GuideNode) {
  const type = node.flowchartShape ? "flowchart" : node.shape ?? "rectangle";
  if (type === "rectangle") return undefined;

  const shape: ShapeElement = {
    type,
    x: node.x,
    y: node.y,
    w: node.w,
    h: node.h,
    color: "#526b84",
    thickness: 1,
    ...(node.flowchartShape ? { flowchartShape: node.flowchartShape } : {}),
  };
  return shapePathData(shape);
}

function GuidePreviewNode(props: { node: GuideNode }) {
  const item = props.node;
  const { title, x, y, w, h, component: kind } = item;
  const fill = item.fill ?? "var(--theme-surface)";

  if (kind === "uml-actor") {
    return <g class="diagram-guide-preview-node">
      <circle cx={x + w / 2} cy={y + 19} r="10" fill={fill} />
      <path class="diagram-guide-preview-detail" d={`M${x + w / 2} ${y + 29} V${y + h * .62} M${x + w * .2} ${y + h * .42} H${x + w * .8} M${x + w / 2} ${y + h * .62} L${x + w * .25} ${y + h * .78} M${x + w / 2} ${y + h * .62} L${x + w * .75} ${y + h * .78}`} />
      <text x={x + w / 2} y={y + h - 5} text-anchor="middle">{title}</text>
    </g>;
  }

  if (kind === "uml-use-case") {
    return <g class="diagram-guide-preview-node">
      <ellipse cx={x + w / 2} cy={y + h / 2} rx={w / 2 - 3} ry={h / 2 - 3} fill={fill} />
      <text x={x + w / 2} y={y + h / 2} text-anchor="middle">{title}</text>
    </g>;
  }

  if (kind === "uml-lifeline") {
    return <g class="diagram-guide-preview-node">
      <rect x={x} y={y} width={w} height="35" rx="7" fill="var(--theme-surface)" />
      <text x={x + w / 2} y={y + 19} text-anchor="middle">{title}</text>
      <path class="diagram-guide-preview-detail" d={`M${x + w / 2} ${y + 35} V${y + h}`} stroke-dasharray="10 8" />
    </g>;
  }

  if (kind === "uml-component") {
    return <g class="diagram-guide-preview-node">
      <rect x={x} y={y} width={w} height={h} rx="7" fill={fill} />
      <path class="diagram-guide-preview-detail" d={`M${x + w - 28} ${y + 15} h16 v12 h-16z M${x + w - 28} ${y + 35} h16 v12 h-16z`} />
      <text x={x + w / 2} y={y + h / 2} text-anchor="middle">{title}</text>
    </g>;
  }

  if (kind === "uml-node") {
    return <g class="diagram-guide-preview-node">
      <path d={`M${x + 12} ${y + 13} l16 -12 h${w - 29} l-16 12 v${h - 14} h${w - 13} v-${h - 14} M${x + 12} ${y + 13} h${w - 13}`} fill={fill} />
      <text x={x + w / 2 + 6} y={y + h / 2} text-anchor="middle">{title}</text>
    </g>;
  }

  if (kind === "uml-artifact") {
    return <g class="diagram-guide-preview-node">
      <path d={`M${x} ${y} H${x + w - 20} L${x + w} ${y + 20} V${y + h} H${x} Z M${x + w - 20} ${y} V${y + 20} H${x + w}`} fill={fill} />
      <text x={x + w / 2} y={y + h / 2} text-anchor="middle">{title}</text>
    </g>;
  }

  if (kind === "c4-system" || kind === "c4-container" || kind === "c4-component") {
    return <g class="diagram-guide-preview-node">
      <rect x={x} y={y} width={w} height={h} rx="8" fill={fill} stroke-dasharray="12 8" />
      <text x={x + 16} y={y + 30} text-anchor="start">{title}</text>
    </g>;
  }

  if (kind === "uml-class" || kind === "er-table") {
    return <g class="diagram-guide-preview-node">
      <rect x={x} y={y} width={w} height={h} rx="8" fill={fill} />
      <rect class="diagram-guide-preview-node-header" x={x + 2} y={y + 2} width={w - 4} height="42" rx="6" />
      <text x={x + w / 2} y={y + 26} text-anchor="middle">{title}</text>
      <path class="diagram-guide-preview-detail" d={`M${x} ${y + 46} H${x + w} M${x} ${y + 94} H${x + w}`} />
    </g>;
  }

  if (kind === "bpmn-start" || kind === "bpmn-end") {
    return <g class="diagram-guide-preview-node">
      <circle cx={x + w / 2} cy={y + h / 2} r={Math.min(w, h) * .42} fill="var(--theme-surface)" stroke-width={kind === "bpmn-end" ? 7 : 4} />
      {kind === "bpmn-end" && <circle class="diagram-guide-preview-ring" cx={x + w / 2} cy={y + h / 2} r={Math.min(w, h) * .32} />}
      <text x={x + w / 2} y={y + h + 24} text-anchor="middle">{title}</text>
    </g>;
  }

  if (kind === "bpmn-gateway") {
    return <g class="diagram-guide-preview-node">
      <path d={`M${x + w / 2} ${y} L${x + w} ${y + h / 2} L${x + w / 2} ${y + h} L${x} ${y + h / 2} Z`} fill="var(--theme-surface)" />
      <path class="diagram-guide-preview-detail" d={`M${x + w * .34} ${y + h * .34} L${x + w * .66} ${y + h * .66} M${x + w * .66} ${y + h * .34} L${x + w * .34} ${y + h * .66}`} />
    </g>;
  }

  if (kind === "c4-person") {
    return <g class="diagram-guide-preview-node">
      <circle cx={x + w / 2} cy={y + 22} r="10" fill="var(--theme-surface)" />
      <path class="diagram-guide-preview-detail" d={`M${x + w / 2} ${y + 32} V${y + 72} M${x + w * .28} ${y + 45} H${x + w * .72} M${x + w / 2} ${y + 72} L${x + w * .3} ${y + 92} M${x + w / 2} ${y + 72} L${x + w * .7} ${y + 92}`} />
      <text x={x + w / 2} y={y + h - 10} text-anchor="middle">{title}</text>
    </g>;
  }

  const path = previewPath(item);
  if (item.shape === "circle") {
    return <g class="diagram-guide-preview-node" opacity={item.fillOpacity ?? 1}>
      <ellipse cx={x + w / 2} cy={y + h / 2} rx={w / 2 - 3} ry={h / 2 - 3} fill={fill} />
      <text x={x + w / 2} y={y + h / 2} text-anchor="middle">{title}</text>
    </g>;
  }

  return <g class="diagram-guide-preview-node">
    {path ? <path d={path} fill={fill} /> : <rect x={x} y={y} width={w} height={h} rx="12" fill={fill} />}
    <text x={x + w / 2} y={y + h / 2} text-anchor="middle">{title.length > 18 ? `${title.slice(0, 16)}…` : title}</text>
  </g>;
}

function GuidePreview(props: { guide: DiagramGuide }) {
  const guide = () => props.guide;
  const layout = createMemo(() => layoutDiagramGuide(guide().id));
  const arrowId = () => `guide-arrow-${guide().id}`;
  const backgroundId = () => `guide-bg-${guide().id}`;

  return <svg
    class="diagram-guide-preview"
    viewBox={`0 0 ${layout().frame.width} ${layout().frame.height}`}
    role="img"
    aria-label={`${guide().title} diagram preview`}
  >
    <defs>
      <linearGradient id={backgroundId()} x1="0" y1="0" x2="1" y2="1">
        <stop class="diagram-guide-preview-background-start" offset="0" />
        <stop class="diagram-guide-preview-background-end" offset="1" />
      </linearGradient>
      <marker id={arrowId()} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
        <path d="M0 0 8 4 0 8z" class="diagram-guide-preview-arrowhead" />
      </marker>
    </defs>
    <rect class="diagram-guide-preview-background" width={layout().frame.width} height={layout().frame.height} rx="20" fill={`url(#${backgroundId()})`} />
    <For each={layout().backgroundNodes}>{node => <GuidePreviewNode node={node} />}</For>
    <For each={layout().edges}>{edgeLayout => {
      const edge = edgeLayout.definition;

      return <g class="diagram-guide-preview-edge">
        <path
          classList={{ "diagram-guide-preview-dashed": !!edge.dashed }}
          d={`M${edgeLayout.start.x} ${edgeLayout.start.y} L${edgeLayout.end.x} ${edgeLayout.end.y}`}
          marker-end={edge.arrow === false ? undefined : `url(#${arrowId()})`}
        />
        <Show when={edge.label}><text x={edgeLayout.label?.x} y={edgeLayout.label?.y}>{edge.label}</text></Show>
      </g>;
    }}</For>
    <For each={layout().foregroundNodes}>{node => <GuidePreviewNode node={node} />}</For>
  </svg>;
}

export function DiagramGuideGallery(props: Props) {
  const [category, setCategory] = createSignal<DiagramGuideCategory | "All guides">("All guides");
  const [query, setQuery] = createSignal("");
  const [selectedId, setSelectedId] = createSignal<DiagramGuideId | undefined>(DIAGRAM_GUIDES[0]?.id);
  const [mobileDetail, setMobileDetail] = createSignal(false);
  let dialogElement: HTMLElement | undefined;
  let previousFocus: HTMLElement | null = null;

  const visibleGuides = () => {
    const needle = query().trim().toLocaleLowerCase();
    return DIAGRAM_GUIDES.filter(guide =>
      (category() === "All guides" || guide.category === category()) &&
      (!needle || [guide.title, guide.category, guide.summary, guide.use, guide.tip, ...guide.lesson.tags, ...guide.lesson.steps, ...guide.lesson.practices, ...guide.lesson.pitfalls]
        .join(" ").toLocaleLowerCase().includes(needle)),
    );
  };
  const selectedGuide = () => visibleGuides().find(guide => guide.id === selectedId());
  const countFor = (item: DiagramGuideCategory | "All guides") =>
    item === "All guides" ? DIAGRAM_GUIDES.length : DIAGRAM_GUIDES.filter(guide => guide.category === item).length;

  const selectGuide = (guide: DiagramGuide) => {
    setSelectedId(guide.id);
    setMobileDetail(true);
  };

  const showCategory = (item: DiagramGuideCategory | "All guides") => {
    setCategory(item);
    setMobileDetail(false);
    const first = DIAGRAM_GUIDES.find(guide => item === "All guides" || guide.category === item);
    setSelectedId(first?.id);
  };

  const openRelated = (id: DiagramGuideId) => {
    const guide = DIAGRAM_GUIDES.find(item => item.id === id);
    if (!guide) return;
    setCategory("All guides");
    setQuery("");
    setSelectedId(id);
    setMobileDetail(true);
  };

  const handleDialogKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      props.onClose();
      return;
    }
    if (event.key !== "Tab" || !dialogElement) return;

    const focusable = [...dialogElement.querySelectorAll<HTMLElement>(
      'button:not(:disabled), input:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])',
    )].filter(element => element.getClientRects().length > 0);
    if (!focusable.length) {
      event.preventDefault();
      dialogElement.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  createEffect(() => {
    const visible = visibleGuides();
    if (!visible.some(guide => guide.id === selectedId())) setSelectedId(visible[0]?.id);
  });

  onMount(() => {
    previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogElement?.querySelector<HTMLButtonElement>(".diagram-guides-close")?.focus();
  });

  onCleanup(() => {
    if (previousFocus?.isConnected) previousFocus.focus();
  });

  return <div
    class="diagram-guides-backdrop"
    role="presentation"
    onPointerDown={event => {
      if (event.target === event.currentTarget) props.onClose();
    }}
  >
    <section
      ref={element => { dialogElement = element; }}
      class="diagram-guides-dialog"
      classList={{ "mobile-guide-detail": mobileDetail() }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="diagram-guides-title"
      aria-describedby="diagram-guides-description"
      tabIndex="-1"
      onKeyDown={handleDialogKeyDown}
    >
      <header class="diagram-guides-header">
        <div class="diagram-guides-heading-copy">
          <span class="diagram-guides-eyebrow">DIAGRAM REFERENCE</span>
          <h2 id="diagram-guides-title">Diagram guide library</h2>
          <p id="diagram-guides-description">Browse practical examples, learn the notation, and insert an editable starting point.</p>
        </div>
        <button type="button" class="diagram-guides-close" aria-label="Close diagram guides" onClick={props.onClose}>
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 4 8 8m0-8-8 8" /></svg>
        </button>
      </header>

      <aside class="diagram-guides-sidebar" aria-label="Browse diagram guides">
        <div class="diagram-guides-sidebar-content">
          <div class="diagram-guides-sidebar-heading"><strong>Browse diagrams</strong><small>{visibleGuides().length} guides</small></div>
          <label class="diagram-guides-search">
            <span>Search guides</span>
            <input type="search" value={query()} placeholder="Try ‘C4’ or ‘data flow’" onInput={event => setQuery(event.currentTarget.value)} />
            <Show when={query()}>
              <button type="button" aria-label="Clear search" onClick={() => setQuery("")}>
                <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 4 8 8m0-8-8 8" /></svg>
              </button>
            </Show>
          </label>

          <nav class="diagram-guides-categories" aria-label="Guide categories">
            <For each={categories}>{item => <button
              type="button"
              classList={{ active: category() === item }}
              aria-pressed={category() === item}
              onClick={() => showCategory(item)}
            ><span>{item}</span><small>{countFor(item)}</small></button>}</For>
          </nav>

          <div class="diagram-guides-list-heading"><strong>Examples</strong><span>{visibleGuides().length}</span></div>
          <nav class="diagram-guides-list" aria-label="Diagram guide examples">
            <For each={visibleGuides()}>{guide => <button
              type="button"
              class="diagram-guide-picker"
              classList={{ active: selectedId() === guide.id }}
              aria-pressed={selectedId() === guide.id}
              onClick={() => selectGuide(guide)}
            >
              <span class={guideCategoryClass(guide.category)}>{guide.category}</span>
              <strong>{guide.title}</strong>
              <small>{guide.summary}</small>
              <span class="diagram-guide-picker-meta">{guide.lesson.level}<i>·</i>{guide.lesson.minutes} min</span>
            </button>}</For>
            <Show when={!visibleGuides().length}>
              <p class="diagram-guides-empty">No guides match that search. Try another phrase or category.</p>
            </Show>
          </nav>
        </div>
      </aside>

      <main class="diagram-guide-detail" aria-live="polite">
        <Show when={selectedGuide()} fallback={<div class="diagram-guide-empty-detail">
          <span aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 5h14v14H5zM8 9h8M8 12h5M8 15h7" /></svg></span>
          <h3>Choose a diagram guide</h3>
          <p>Select an example to see its preview, steps, and modeling notes.</p>
        </div>}>
          {guide => <>
            <button type="button" class="diagram-guide-mobile-back" onClick={() => setMobileDetail(false)}>
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m10 3-5 5 5 5" /></svg>All guides
            </button>
            <div class="diagram-guide-detail-preview">
              <GuidePreview guide={guide()} />
              <span class="diagram-guide-preview-caption">Editable example preview</span>
            </div>
            <div class="diagram-guide-detail-copy">
              <div class="diagram-guide-detail-meta">
                <span class={guideCategoryClass(guide().category)}>{guide().category}</span>
                <span>{guide().lesson.level}</span>
                <span>{guide().lesson.minutes} min read</span>
              </div>
              <h3>{guide().title}</h3>
              <p class="diagram-guide-lead">{guide().summary}</p>
              <section class="diagram-guide-purpose"><span>When to use it</span><p>{guide().use}</p></section>
              <section class="diagram-guide-section">
                <h4>Build the diagram</h4>
                <ol><For each={guide().lesson.steps}>{step => <li>{step}</li>}</For></ol>
              </section>
              <div class="diagram-guide-advice-grid">
                <section class="diagram-guide-section diagram-guide-good">
                  <h4>Good practices</h4>
                  <ul><For each={guide().lesson.practices}>{item => <li>{item}</li>}</For></ul>
                </section>
                <section class="diagram-guide-section diagram-guide-watch">
                  <h4>Common traps</h4>
                  <ul><For each={guide().lesson.pitfalls}>{item => <li>{item}</li>}</For></ul>
                </section>
              </div>
              <section class="diagram-guide-tip"><strong>Modeling tip</strong><p>{guide().tip}</p></section>
              <Show when={guide().source}>
                <section class="diagram-guide-section diagram-guide-references">
                  <h4>References</h4>
                  <a href={guide().source!.href} target="_blank" rel="noopener noreferrer">
                    {guide().source!.label}<span aria-hidden="true">↗</span>
                  </a>
                </section>
              </Show>
              <Show when={guide().lesson.related.length}>
                <section class="diagram-guide-section diagram-guide-related">
                  <h4>Related guides</h4>
                  <div><For each={guide().lesson.related}>{id => {
                    const related = DIAGRAM_GUIDES.find(item => item.id === id);
                    return <Show when={related}>{item => <button type="button" onClick={() => openRelated(item().id)}>
                      {item().title}<span aria-hidden="true">→</span>
                    </button>}</Show>;
                  }}</For></div>
                </section>
              </Show>
              <Show when={guide().lesson.tags.length}>
                <div class="diagram-guide-tags" aria-label="Guide topics">
                  <For each={guide().lesson.tags}>{tag => <span>{tag}</span>}</For>
                </div>
              </Show>
            </div>
          </>}
        </Show>
      </main>

      <footer class="diagram-guides-footer">
        <span>{visibleGuides().length} of {DIAGRAM_GUIDES.length} guides</span>
        <div>
          <button type="button" class="diagram-guides-close-footer" onClick={props.onClose}>Close</button>
          <button
            type="button"
            class="diagram-guides-insert"
            disabled={!selectedGuide()}
            onClick={() => {
              const guide = selectedGuide();
              if (guide) props.onInsert(guide.id);
            }}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M3 8h10" /></svg>
            Insert editable example
          </button>
        </div>
      </footer>
    </section>
  </div>;
}
