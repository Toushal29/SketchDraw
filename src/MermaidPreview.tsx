import { createMemo, For, Show } from "solid-js";
import type { ShapeElement } from "./model";
import { layoutMermaidFlowchart, parseMermaidFlowchart } from "./mermaid";

type PreviewModel = { error?: string; frames: ShapeElement[]; nodes: ShapeElement[]; links: LinkPreview[]; viewBox: string };
type LinkPreview = { shape: ShapeElement; start: { x: number; y: number }; end: { x: number; y: number } };

export function MermaidPreview(props: { source: string }) {
  const preview = createMemo<PreviewModel>(() => {
    try {
      const parsed = parseMermaidFlowchart(props.source);
      const elements = layoutMermaidFlowchart(parsed, { x: 0, y: 0 });
      const shapes = elements.filter((element): element is ShapeElement => element.type !== "line" && element.type !== "arrow");
      const frames = shapes.filter(element => element.id?.startsWith("mermaid-subgraph:"));
      const nodes = shapes.filter(element => element.id?.startsWith("mermaid-node:"));
      const links: LinkPreview[] = elements.filter((element): element is ShapeElement => element.type === "line" || element.type === "arrow").map(shape => ({ shape, start: { x: shape.x, y: shape.y }, end: { x: shape.x + shape.w, y: shape.y + shape.h } }));
      const xs = shapes.flatMap(shape => [shape.x, shape.x + shape.w]).concat(links.flatMap(link => [link.start.x, link.end.x]));
      const ys = shapes.flatMap(shape => [shape.y, shape.y + shape.h]).concat(links.flatMap(link => [link.start.y, link.end.y]));
      const x = Math.min(...xs) - 24; const y = Math.min(...ys) - 24; const width = Math.max(1, Math.max(...xs) - Math.min(...xs) + 48); const height = Math.max(160, Math.max(...ys) - Math.min(...ys) + 48);
      return { frames, nodes, links, viewBox: x + " " + y + " " + width + " " + height };
    } catch (cause) {
      return { error: cause instanceof Error ? cause.message : String(cause), frames: [], nodes: [], links: [], viewBox: "0 0 1 1" };
    }
  });
  const headMarker = (head: ShapeElement["endHead"]) => head === "none" || head === "dot" || head === "bar" ? undefined : "url(#mermaid-preview-" + (head === "open" ? "open" : "solid") + ")";
  return <section class="mermaid-preview-panel" aria-label="Live Mermaid preview">
    <div class="mermaid-preview-heading"><span>LIVE PREVIEW</span><Show when={!preview().error}><small>Native canvas shapes</small></Show></div>
    <Show when={!preview().error} fallback={<div class="mermaid-preview-error">{preview().error || "Enter Mermaid flowchart code to preview it."}</div>}>
      <svg class="mermaid-preview-svg" viewBox={preview().viewBox} role="img" aria-label="Preview of the generated flowchart" preserveAspectRatio="xMidYMid meet">
        <defs>
          <marker id="mermaid-preview-solid" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto-start-reverse" markerUnits="userSpaceOnUse"><path d="M0 0 9 4.5 0 9z" fill="#71869b" /></marker>
          <marker id="mermaid-preview-open" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto-start-reverse" markerUnits="userSpaceOnUse"><path d="M1 1 8 4.5 1 8" fill="none" stroke="#71869b" stroke-width="1.4" /></marker>
        </defs>
        <For each={preview().frames}>{frame => <g>
          <rect x={frame.x} y={frame.y} width={frame.w} height={frame.h} rx="12" fill="#eaf0f5" fill-opacity=".72" stroke="#91a4b6" stroke-width="1.3" stroke-dasharray="5 4" />
          <text x={frame.x + 14} y={frame.y + 18} fill="#52697e" font-size="12" font-weight="700">{frame.label?.text}</text>
        </g>}</For>
        <For each={preview().links}>{link => <g>
          <line x1={link.start.x} y1={link.start.y} x2={link.end.x} y2={link.end.y} stroke="#71869b" stroke-width={link.shape.thickness} stroke-dasharray={link.shape.lineStyle === "dotted" ? "2 4" : link.shape.lineStyle === "dashed" ? "6 4" : undefined} marker-start={headMarker(link.shape.startHead)} marker-end={headMarker(link.shape.endHead)} />
          <Show when={link.shape.startHead === "dot"}><circle cx={link.start.x} cy={link.start.y} r="3.5" fill="#71869b" /></Show>
          <Show when={link.shape.endHead === "dot"}><circle cx={link.end.x} cy={link.end.y} r="3.5" fill="#71869b" /></Show>
          <Show when={link.shape.startHead === "bar"}><path d={"M " + (link.start.x - 4) + " " + (link.start.y - 5) + " l 8 10"} stroke="#71869b" stroke-width="1.7" /></Show>
          <Show when={link.shape.endHead === "bar"}><path d={"M " + (link.end.x - 4) + " " + (link.end.y - 5) + " l 8 10"} stroke="#71869b" stroke-width="1.7" /></Show>
          <Show when={!!link.shape.label?.text}><text x={(link.start.x + link.end.x) / 2} y={(link.start.y + link.end.y) / 2 - 5} fill="#566b7e" font-size="10" text-anchor="middle">{link.shape.label?.text}</text></Show>
        </g>}</For>
        <For each={preview().nodes}>{node => <g>
          <Show when={node.type === "diamond"} fallback={<Show when={node.type === "circle"} fallback={<rect x={node.x} y={node.y} width={node.w} height={node.h} rx={node.edgeStyle === "pill" ? 24 : 10} fill="#f3f7fb" stroke="#657f98" stroke-width="1.6" />}><ellipse cx={node.x + node.w / 2} cy={node.y + node.h / 2} rx={node.w / 2} ry={node.h / 2} fill="#f3f7fb" stroke="#657f98" stroke-width="1.6" /></Show>}><path d={"M " + (node.x + node.w / 2) + " " + node.y + " L " + (node.x + node.w) + " " + (node.y + node.h / 2) + " L " + (node.x + node.w / 2) + " " + (node.y + node.h) + " L " + node.x + " " + (node.y + node.h / 2) + " Z"} fill="#f3f7fb" stroke="#657f98" stroke-width="1.6" /></Show>
          <text x={node.x + node.w / 2} y={node.y + node.h / 2 - ((node.label?.text.split("\n").length ?? 1) - 1) * 7} fill="#33495d" font-size="12" text-anchor="middle" dominant-baseline="middle"><For each={(node.label?.text ?? "").split("\n")}>{(line, index) => <tspan x={node.x + node.w / 2} dy={index() === 0 ? 0 : 14}>{line}</tspan>}</For></text>
        </g>}</For>
      </svg>
    </Show>
  </section>;
}
