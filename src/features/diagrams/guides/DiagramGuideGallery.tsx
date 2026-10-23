import { createSignal, For, Show } from "solid-js";
import type { DiagramGuide, DiagramGuideCategory, DiagramGuideId, GuideNode } from "./guide-diagrams";
import { DIAGRAM_GUIDES, guideEdgePoints } from "./guide-diagrams";
import { shapePathData } from "../../shapes/geometry";
import type { ShapeElement } from "../../../model";
import "./diagram-guides.css";

type Props = { onClose: () => void; onInsert: (id: DiagramGuideId) => void };
const categories: (DiagramGuideCategory | "All")[] = ["All", "Flowchart", "UML", "Database", "BPMN", "Architecture", "Network"];

function previewPath(node: GuideNode) {
  if (!node.flowchartShape) return undefined;
  const shape: ShapeElement = { type: "flowchart", x: node.x, y: node.y, w: node.w, h: node.h, color: "#526b84", thickness: 1, flowchartShape: node.flowchartShape };
  return shapePathData(shape);
}

function GuidePreviewNode(props: { node: GuideNode }) {
  const node = () => props.node; const item = node(); const title = item.title;
  const x = item.x; const y = item.y; const w = item.w; const h = item.h; const kind = item.component;
  if (kind === "uml-lifeline") return <g class="guide-preview-node"><rect x={x} y={y} width={w} height="35" rx="7" fill="#ffffff"/><text x={x + w / 2} y={y + 19} text-anchor="middle">{title}</text><path class="guide-preview-detail" d={`M${x + w / 2} ${y + 35} V${y + h}`} stroke-dasharray="10 8" /></g>;
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
    <defs>
      <linearGradient id={`guide-bg-${guide().id}`} x1="0" y1="0" x2="1" y2="1"><stop stop-color="#eef6ff" /><stop offset="1" stop-color="#f5f0ff" /></linearGradient>
      <marker id={`guide-arrow-${guide().id}`} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 8 4 0 8z" fill="#8498ad" /></marker>
    </defs>
    <rect x="0" y="0" width={guide().width} height={guide().height} rx="24" fill={`url(#guide-bg-${guide().id})`} />
    {guide().edges.map(edge => {
      const start = guide().nodes[edge.from]; const end = guide().nodes[edge.to];
      if (!start || !end) return null;
      const points = guideEdgePoints(edge, guide().nodes); const midX = (points.start.x + points.end.x) / 2; const midY = (points.start.y + points.end.y) / 2;
      return <g class="guide-preview-edge"><path classList={{ "guide-preview-dashed": !!edge.dashed }} d={`M${points.start.x} ${points.start.y} L${points.end.x} ${points.end.y}`} marker-end={`url(#guide-arrow-${guide().id})`} />{edge.label && <text x={midX} y={midY - 8}>{edge.label}</text>}</g>;
    })}
    {guide().nodes.map(node => <GuidePreviewNode node={node} />)}
    <circle class="guide-preview-orbit" cx={guide().width - 45} cy="42" r="13" />
  </svg>;
}

export function DiagramGuideGallery(props: Props) {
  const [category, setCategory] = createSignal<DiagramGuideCategory | "All">("All");
  const visibleGuides = () => category() === "All" ? DIAGRAM_GUIDES : DIAGRAM_GUIDES.filter(guide => guide.category === category());

  return <div class="diagram-guides-backdrop" role="presentation" onPointerDown={event => { if (event.target === event.currentTarget) props.onClose(); }}>
    <section class="diagram-guides-dialog" role="dialog" aria-modal="true" aria-labelledby="diagram-guides-title">
      <header class="diagram-guides-header">
        <div><span class="diagram-guides-eyebrow">START WITH A PATTERN</span><h2 id="diagram-guides-title">Diagram guides</h2><p>Choose a model, learn what it communicates, and insert an editable example.</p></div>
        <button type="button" class="diagram-guides-close" aria-label="Close diagram guides" onClick={props.onClose}>×</button>
      </header>
      <nav class="diagram-guides-filters" aria-label="Filter diagram guide examples">
        <For each={categories}>{item => <button type="button" classList={{ active: category() === item }} aria-pressed={category() === item} onClick={() => setCategory(item)}>{item}</button>}</For>
      </nav>
      <div class="diagram-guides-grid">
        <For each={visibleGuides()}>{guide => <article class="diagram-guide-card">
          <GuidePreview guide={guide} />
          <div class="diagram-guide-copy">
            <span class={`diagram-guide-category guide-category-${guide.category.toLowerCase()}`}>{guide.category}</span>
            <h3>{guide.title}</h3>
            <p>{guide.summary}</p>
            <dl><div><dt>Use it for</dt><dd>{guide.use}</dd></div><div><dt>Tip</dt><dd>{guide.tip}</dd></div></dl>
            <footer><a href={guide.source.href} target="_blank" rel="noreferrer">Reference: {guide.source.label}<span aria-hidden="true"> ↗</span></a><button type="button" onClick={() => props.onInsert(guide.id)}>Insert editable diagram</button></footer>
          </div>
        </article>}</For>
        <Show when={!visibleGuides().length}><p class="diagram-guides-empty">No guides are available in this category.</p></Show>
      </div>
      <footer class="diagram-guides-footer"><span>{visibleGuides().length} editable examples</span><button type="button" onClick={props.onClose}>Close</button></footer>
    </section>
  </div>;
}
