import type { FlowchartShape, Tool } from "../../model";
import { BASIC_SHAPES, FLOWCHART_SHAPES, GENERAL_SHAPES, type BasicShapeTool } from "../../features/shapes/shape-catalog";

export type WindowsShapeChoice =
  | { kind: "basic"; tool: BasicShapeTool }
  | { kind: "flowchart"; shape: FlowchartShape };

type ShapeOption = WindowsShapeChoice & { label: string; path: string };
type Props = {
  activeTool: Tool;
  activeFlowchartShape: FlowchartShape;
  onSelect: (choice: WindowsShapeChoice) => void;
  canSpawnAll: boolean;
  busy: boolean;
  onSpawnAll: () => void;
};

const basicShapes: ShapeOption[] = BASIC_SHAPES.map(shape => ({ kind: "basic", tool: shape.value, label: shape.label, path: shape.path }));

const flowchartGroup = (shapes: typeof FLOWCHART_SHAPES): ShapeOption[] => shapes.map(shape => ({ kind: "flowchart", shape: shape.value, label: shape.label, path: shape.path }));

const groups: { label: string; shapes: ShapeOption[] }[] = [
  { label: "Basic", shapes: basicShapes },
  { label: "Flowchart", shapes: flowchartGroup(FLOWCHART_SHAPES) },
  { label: "General", shapes: flowchartGroup(GENERAL_SHAPES) },
];

function isActive(shape: ShapeOption, activeTool: Tool, activeFlowchartShape: FlowchartShape) {
  return shape.kind === "basic"
    ? activeTool === shape.tool
    : activeTool === "flowchart" && activeFlowchartShape === shape.shape;
}

export function WindowsShapePalette(props: Props) {
  return <div class="tool-options windows-shape-palette" role="menu" aria-label="Shape library">
    {groups.map(group => <section class="windows-shape-group" role="group" aria-label={group.label}>
      <h3 class="windows-shape-group-title">{group.label}</h3>
      {group.shapes.map(shape => <button type="button" role="menuitem" class="windows-shape-option" classList={{ active: isActive(shape, props.activeTool, props.activeFlowchartShape) }} title={shape.label} aria-label={shape.label} onClick={() => props.onSelect(shape)}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d={shape.path} /></svg>
        <span>{shape.label}</span>
      </button>)}
    </section>)}
    <footer class="windows-shape-footer"><span>{groups.reduce((count, group) => count + group.shapes.length, 0)} shapes</span><button type="button" disabled={!props.canSpawnAll || props.busy} onClick={props.onSpawnAll}>{props.busy ? "Preparing…" : "Spawn all shapes"}</button></footer>
  </div>;
}
