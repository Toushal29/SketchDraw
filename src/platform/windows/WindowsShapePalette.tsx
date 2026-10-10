import type { FlowchartShape, Tool } from "../../model";
import { FLOWCHART_SHAPES } from "../../features/diagrams/config";

type BasicShapeTool = Extract<Tool, "rectangle" | "circle" | "diamond" | "triangle">;
export type WindowsShapeChoice =
  | { kind: "basic"; tool: BasicShapeTool }
  | { kind: "flowchart"; shape: FlowchartShape };

type ShapeOption = WindowsShapeChoice & { label: string; path: string };
type Props = {
  activeTool: Tool;
  activeFlowchartShape: FlowchartShape;
  onSelect: (choice: WindowsShapeChoice) => void;
};

const basicShapes: ShapeOption[] = [
  { kind: "basic", tool: "rectangle", label: "Rectangle", path: "M5 5h14v14H5z" },
  { kind: "basic", tool: "circle", label: "Ellipse", path: "M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0z" },
  { kind: "basic", tool: "diamond", label: "Diamond", path: "M12 3 21 12 12 21 3 12z" },
  { kind: "basic", tool: "triangle", label: "Triangle", path: "M12 4 21 20H3z" },
];

const flowchartByValue = new Map(FLOWCHART_SHAPES.map(shape => [shape.value, shape]));
const flowchartGroup = (values: FlowchartShape[]): ShapeOption[] => values.flatMap(value => {
  const shape = flowchartByValue.get(value);
  return shape ? [{ kind: "flowchart" as const, shape: value, label: shape.label, path: shape.path }] : [];
});

const groups: { label: string; shapes: ShapeOption[] }[] = [
  { label: "Basic", shapes: basicShapes },
  { label: "Flowchart", shapes: flowchartGroup(["process", "terminator", "decision", "data", "document", "database", "predefined-process", "preparation", "manual-input", "connector", "off-page", "delay", "manual-operation", "stored-data", "cloud"]) },
  { label: "Block shapes", shapes: flowchartGroup(["hexagon", "parallelogram", "trapezoid", "pentagon", "octagon", "chevron", "cross", "folder", "note", "display", "cube", "rounded-rectangle", "shield"]) },
  { label: "Decorative", shapes: flowchartGroup(["star", "lightning", "heart", "callout", "gear"]) },
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
  </div>;
}
