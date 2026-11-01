import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import type { Element, GroupElement, ShapeElement } from "./model";
import { layoutMermaidFlowchart, parseMermaidFlowchart } from "./mermaid";
import { parseMermaidSequence } from "./mermaid";
import { detectExtendedMermaidType, layoutExtendedMermaid } from "./features/diagrams/mermaid-extended";
import { mermaidPreviewViewBox, zoomMermaidPreviewViewBox } from "./features/diagrams/mermaid-preview-geometry";

type PreviewModel = { error?: string; frames: ShapeElement[]; groups: GroupElement[]; nodes: ShapeElement[]; links: LinkPreview[]; texts: Extract<Element, { type: "text" }>[]; viewBox: string };
type LinkPreview = { shape: ShapeElement; start: { x: number; y: number }; end: { x: number; y: number } };

export function MermaidPreview(props: { source: string }) {
  const [previewZoom, setPreviewZoom] = createSignal(1);
  const [previewPan, setPreviewPan] = createSignal({ x: 0, y: 0 });
  const [panPointer, setPanPointer] = createSignal<{ id: number; x: number; y: number }>();
  createEffect(() => {
    props.source;
    setPreviewZoom(1); setPreviewPan({ x: 0, y: 0 }); setPanPointer(undefined);
  });
  const zoomedViewBox = (value: string) => zoomMermaidPreviewViewBox(value, previewZoom(), previewPan());
  const changeZoom = (factor: number) => setPreviewZoom(value => Math.max(.5, Math.min(8, value * factor)));
  const resetPreviewView = () => { setPreviewZoom(1); setPreviewPan({ x: 0, y: 0 }); };
  const startPreviewPan = (event: PointerEvent & { currentTarget: SVGSVGElement }) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setPanPointer({ id: event.pointerId, x: event.clientX, y: event.clientY });
  };
  const movePreviewPan = (event: PointerEvent & { currentTarget: SVGSVGElement }) => {
    const pointer = panPointer(); if (!pointer || pointer.id !== event.pointerId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const view = event.currentTarget.viewBox.baseVal;
    const dx = (event.clientX - pointer.x) * view.width / rect.width;
    const dy = (event.clientY - pointer.y) * view.height / rect.height;
    setPreviewPan(value => ({ x: value.x + dx, y: value.y + dy }));
    setPanPointer({ ...pointer, x: event.clientX, y: event.clientY });
  };
  const stopPreviewPan = (event: PointerEvent & { currentTarget: SVGSVGElement }) => {
    if (panPointer()?.id !== event.pointerId) return;
    setPanPointer(undefined);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const wheelPreviewZoom = (event: WheelEvent) => {
    event.preventDefault(); changeZoom(event.deltaY < 0 ? 1.12 : 1 / 1.12);
  };
  const sequence = createMemo(() => {
    if (!/^\s*sequenceDiagram\b/im.test(props.source)) return undefined;
    try {
      const parsed = parseMermaidSequence(props.source);
      return { ...parsed, width: Math.max(300, parsed.participants.length * 190 + 40), height: Math.max(220, parsed.messages.length * 50 + 120) };
    } catch (cause) { return { error: cause instanceof Error ? cause.message : String(cause), participants: [], messages: [], width: 1, height: 1 }; }
  });
  const preview = createMemo<PreviewModel>(() => {
    try {
      const extendedType = detectExtendedMermaidType(props.source);
      if (extendedType) {
        const elements = layoutExtendedMermaid(props.source, { x: 0, y: 0 }).elements;
        const groups = elements.filter((element): element is GroupElement => element.type === "group" && !!element.componentBounds
          && [element.componentBounds.x, element.componentBounds.y, element.componentBounds.w, element.componentBounds.h].every(Number.isFinite));
        const shapes = elements.filter((element): element is ShapeElement => ["rectangle", "circle", "diamond", "triangle", "flowchart", "line", "arrow", "svgPath"].includes(element.type));
        const texts = elements.filter((element): element is Extract<Element, { type: "text" }> => element.type === "text");
        const links: LinkPreview[] = elements.filter((element): element is ShapeElement => element.type === "line" || element.type === "arrow").map(shape => ({ shape, start: { x: shape.x, y: shape.y }, end: { x: shape.x + shape.w, y: shape.y + shape.h } }));
        return { frames: [], groups, nodes: shapes, links, texts, viewBox: mermaidPreviewViewBox(elements) };
      }
      const parsed = parseMermaidFlowchart(props.source);
      const elements = layoutMermaidFlowchart(parsed, { x: 0, y: 0 });
      const shapes = elements.filter((element): element is ShapeElement => element.type !== "line" && element.type !== "arrow");
      const frames = shapes.filter(element => element.id?.startsWith("mermaid-subgraph:"));
      const nodes = shapes.filter(element => element.id?.startsWith("mermaid-node:"));
      const links: LinkPreview[] = elements.filter((element): element is ShapeElement => element.type === "line" || element.type === "arrow").map(shape => ({ shape, start: { x: shape.x, y: shape.y }, end: { x: shape.x + shape.w, y: shape.y + shape.h } }));
      return { frames, groups: [], nodes, links, texts: [], viewBox: mermaidPreviewViewBox(elements) };
    } catch (cause) {
      return { error: cause instanceof Error ? cause.message : String(cause), frames: [], groups: [], nodes: [], links: [], texts: [], viewBox: "0 0 1 1" };
    }
  });
  const headMarker = (head: ShapeElement["endHead"]) => head === "none" || head === "dot" || head === "bar" ? undefined : "url(#mermaid-preview-" + (head === "open" ? "open" : "solid") + ")";
  return <section class="mermaid-preview-panel" aria-label="Live Mermaid preview">
    <div class="mermaid-preview-heading">
      <span>LIVE PREVIEW</span>
      <div class="mermaid-preview-controls" role="group" aria-label="Preview zoom and pan controls">
        <button type="button" title="Zoom out" aria-label="Zoom out" onClick={() => changeZoom(1 / 1.2)}>−</button>
        <output aria-live="polite">{Math.round(previewZoom() * 100)}%</output>
        <button type="button" title="Zoom in" aria-label="Zoom in" onClick={() => changeZoom(1.2)}>+</button>
        <button type="button" title="Reset preview to fit" aria-label="Reset preview to fit" onClick={resetPreviewView}>Fit</button>
      </div>
      <Show when={!preview().error}><small>Drag to pan · Scroll to zoom</small></Show>
    </div>
    <Show when={sequence()} fallback={<Show when={!preview().error} fallback={<div class="mermaid-preview-error">{preview().error || "Enter Mermaid flowchart or sequence diagram code to preview it."}</div>}>
      <svg class="mermaid-preview-svg" class:preview-panning={!!panPointer()} viewBox={zoomedViewBox(preview().viewBox)} onPointerDown={startPreviewPan} onPointerMove={movePreviewPan} onPointerUp={stopPreviewPan} onPointerCancel={stopPreviewPan} onWheel={wheelPreviewZoom} role="img" aria-label="Preview of the generated diagram. Drag to pan and scroll to zoom." preserveAspectRatio="xMidYMid meet">
        <defs>
          <marker id="mermaid-preview-solid" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto-start-reverse" markerUnits="userSpaceOnUse"><path d="M0 0 9 4.5 0 9z" fill="#71869b" /></marker>
          <marker id="mermaid-preview-open" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto-start-reverse" markerUnits="userSpaceOnUse"><path d="M1 1 8 4.5 1 8" fill="none" stroke="#71869b" stroke-width="1.4" /></marker>
        </defs>
        <For each={preview().frames}>{frame => <g>
          <rect x={frame.x} y={frame.y} width={frame.w} height={frame.h} rx="12" fill="#eaf0f5" fill-opacity=".72" stroke="#91a4b6" stroke-width="1.3" stroke-dasharray="5 4" />
          <text x={frame.x + 14} y={frame.y + 18} fill="#52697e" font-size="12" font-weight="700">{frame.label?.text}</text>
        </g>}</For>
        <For each={preview().groups}>{group => {
          const bounds = group.componentBounds!; const kind = group.libraryComponent?.kind; const mid = bounds.y + bounds.h / 2;
          const fieldValue = (key: string) => group.libraryComponent?.componentFields?.find(field => field.key === key)?.value.trim() ?? "";
          const attributes = fieldValue("attributes").split(/\r?\n/).filter(Boolean);
          const methods = fieldValue("methods").split(/\r?\n/).filter(Boolean);
          const classDivider = bounds.y + Math.min(36, bounds.h * .28) + (bounds.h - Math.min(36, bounds.h * .28)) * .49;
          return <g>
            <rect x={bounds.x} y={bounds.y} width={bounds.w} height={bounds.h} rx={kind === "uml-class" ? 8 : 5} fill="#f3f7fb" stroke="#657f98" stroke-width="1.4" />
            <rect x={bounds.x + 1} y={bounds.y + 1} width={Math.max(0, bounds.w - 2)} height={Math.min(36, bounds.h * .28)} rx="7" fill="#e8f0fb" />
            <text x={bounds.x + 12} y={kind === "uml-class" ? bounds.y + Math.min(18, bounds.h * .14) : mid} fill="#33495d" font-size="12" font-weight="700" dominant-baseline="middle">{group.libraryComponent?.label || kind || "Component"}</text>
            <Show when={kind === "uml-class"}>
              <path d={`M ${bounds.x} ${bounds.y + Math.min(36, bounds.h * .28)} H ${bounds.x + bounds.w} M ${bounds.x} ${classDivider} H ${bounds.x + bounds.w}`} stroke="#657f98" stroke-width="1" />
              <For each={attributes.slice(0, 8)}>{(line, index) => <text x={bounds.x + 12} y={bounds.y + 48 + index() * 14} fill="#40556a" font-size="10" dominant-baseline="middle">{line}</text>}</For>
              <For each={methods.slice(0, 8)}>{(line, index) => <text x={bounds.x + 12} y={classDivider + 14 + index() * 14} fill="#40556a" font-size="10" dominant-baseline="middle">{line}</text>}</For>
            </Show>
            <Show when={kind === "uml-lifeline"}><path d={`M ${bounds.x + bounds.w / 2} ${bounds.y + 32} V ${bounds.y + bounds.h}`} stroke="#8497a8" stroke-dasharray="5 4" /></Show>
          </g>;
        }}</For>
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
          <Show when={!!node.label?.text}><text x={node.x + node.w / 2} y={node.y + node.h / 2 - ((node.label?.text.split("\n").length ?? 1) - 1) * 7} fill="#33495d" font-size="12" text-anchor="middle" dominant-baseline="middle"><For each={(node.label?.text ?? "").split("\n")}>{(line, index) => <tspan x={node.x + node.w / 2} dy={index() === 0 ? 0 : 14}>{line}</tspan>}</For></text></Show>
        </g>}</For>
        <For each={preview().texts}>{text => <text x={text.x} y={text.y + text.fontSize} fill={text.color} font-size={String(text.fontSize)} font-weight={text.bold ? 700 : 400} text-anchor={text.textAlign === "center" ? "middle" : text.textAlign === "right" ? "end" : "start"}>{text.text}</text>}</For>
      </svg>
    </Show>}>
      {model => <Show when={!model().error} fallback={<div class="mermaid-preview-error">{model().error}</div>}><svg class="mermaid-preview-svg" class:preview-panning={!!panPointer()} viewBox={zoomedViewBox("0 0 " + model().width + " " + model().height)} onPointerDown={startPreviewPan} onPointerMove={movePreviewPan} onPointerUp={stopPreviewPan} onPointerCancel={stopPreviewPan} onWheel={wheelPreviewZoom} role="img" aria-label="Preview of the generated sequence diagram. Drag to pan and scroll to zoom." preserveAspectRatio="xMidYMid meet">
        <defs><marker id="mermaid-sequence-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 8 4 0 8z" fill="#71869b"/></marker></defs>
        <For each={model().participants}>{(participant, index) => { const x = 20 + index() * 190; return <g><rect x={x} y="18" width="150" height="32" rx="5" fill="#f3f7fb" stroke="#657f98"/><text x={x + 75} y="34" fill="#33495d" font-size="12" text-anchor="middle" dominant-baseline="middle">{participant.label}</text><path d={`M ${x + 75} 50 V ${model().height - 16}`} stroke="#8497a8" stroke-dasharray="5 4"/></g>; }}</For>
        <For each={model().messages}>{(message, index) => { const from = model().participants.findIndex(item => item.id === message.from); const to = model().participants.findIndex(item => item.id === message.to); const y = 82 + index() * 50; const x1 = 95 + from * 190; const x2 = 95 + to * 190; return <g><path d={`M ${x1} ${y} H ${x2}`} fill="none" stroke="#71869b" stroke-dasharray={message.operator.startsWith("--") ? "5 3" : undefined} marker-end="url(#mermaid-sequence-arrow)"/><text x={(x1 + x2) / 2} y={y - 7} fill="#40556a" font-size="10" text-anchor="middle">{message.label}</text></g>; }}</For>
      </svg></Show>}
    </Show>
  </section>;
}
