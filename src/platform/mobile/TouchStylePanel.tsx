import type { ArrowHead, ArrowRoute, EdgeStyle, FlowchartShape, FontFamily, LineRoute, StrokeStyle, Tool } from "../../model";
import { ThicknessTuner } from "../../components/ThicknessTuner";

type BrushMode = "fine" | "pencil" | "brush" | "marker" | "highlighter" | "chalk";
type FontFormat = "bold" | "italic" | "underline" | "textAlign" | "listType" | "fontSize" | "fontFamily";
type Props = {
  tool: Tool;
  styleName: string;
  supportsStroke: boolean;
  supportsWidth: boolean;
  thicknessPickerMode: "presets" | "stepper";
  isLine: boolean;
  isArrow: boolean;
  straightOnly: boolean;
  isFlowchart: boolean;
  color: string;
  width: number;
  brushMode: BrushMode;
  supportsFill: boolean;
  supportsLineStyle: boolean;
  fillEnabled: boolean;
  fillColor: string;
  fillOpacity: number;
  lineStyle: StrokeStyle;
  lineRoute: LineRoute;
  lineRoutes: { value: LineRoute; label: string; path: string }[];
  arrowRoute: ArrowRoute;
  arrowRoutes: { value: ArrowRoute; label: string; path: string }[];
  flowchartShape: FlowchartShape;
  flowchartShapes: { value: FlowchartShape; label: string; path: string }[];
  arrowHeads: { value: ArrowHead; label: string }[];
  startHead: ArrowHead;
  endHead: ArrowHead;
  forkUpperHead: ArrowHead;
  forkLowerHead: ArrowHead;
  edgeStyle: EdgeStyle;
  cornerRadius: number;
  supportsCorners: boolean;
  supportsText: boolean;
  fontSize: number;
  fontFamily: FontFamily;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  textAlign: "left" | "center" | "right" | "justify";
  listType: "none" | "bullet" | "number";
  hasSelection: boolean;
  selectionOpacity: number;
  canRotate: boolean;
  penPressure: boolean;
  penTilt: boolean;
  penEraser: boolean;
  isLaser: boolean;
  laserColor: string;
  laserThickness: number;
  laserFadeDuration: number;
  laserRainbow: boolean;
  isBucket: boolean;
  locked: boolean;
  onClose: () => void;
  onColorChange: (color: string) => void;
  onWidthChange: (width: number) => void;
  onBrushModeChange: (mode: BrushMode) => void;
  onFillEnabledChange: (enabled: boolean) => void;
  onFillColorChange: (color: string) => void;
  onFillOpacityChange: (opacity: number) => void;
  onLineStyleChange: (style: StrokeStyle) => void;
  onLineRouteChange: (route: LineRoute) => void;
  onArrowRouteChange: (route: ArrowRoute) => void;
  onFlowchartShapeChange: (shape: FlowchartShape) => void;
  onConnectorHeadChange: (end: "start" | "end", head: ArrowHead) => void;
  onForkHeadChange: (branch: "upper" | "lower", head: ArrowHead) => void;
  onEdgeStyleChange: (style: EdgeStyle) => void;
  onCornerRadiusChange: (radius: number) => void;
  onTextChange: (property: FontFormat, value: boolean | string | number) => void;
  onSelectionOpacityChange: (opacity: number) => void;
  onRotate: (degrees: number) => void;
  onResetRotation: () => void;
  onPenPressureChange: (enabled: boolean) => void;
  onPenTiltChange: (enabled: boolean) => void;
  onPenEraserChange: (enabled: boolean) => void;
  onLaserChange: (key: "color" | "thickness" | "fade" | "rainbow", value: string) => void;
  onBucketColorChange: (color: string) => void;
};

const COLORS = ["#202124", "#e45454", "#ef8b37", "#ddb43c", "#5eaa72", "#3d91bd", "#6e70d2", "#b35ca4", "#ffffff", "#79818d"];
const WIDTHS = [1, 2, 4, 7, 12];
const BRUSHES: { value: BrushMode; label: string }[] = [
  { value: "fine", label: "Pen" }, { value: "pencil", label: "Pencil" }, { value: "brush", label: "Brush" },
  { value: "marker", label: "Marker" }, { value: "highlighter", label: "Highlight" }, { value: "chalk", label: "Chalk" },
];
const LINE_STYLES: { value: StrokeStyle; label: string; icon: string }[] = [
  { value: "solid", label: "Solid", icon: "M3 12h18" }, { value: "dashed", label: "Dash", icon: "M3 12h3m3 0h3m3 0h3m2 0h1" },
  { value: "dotted", label: "Dot", icon: "M4 12h.1m5.9 0h.1m5.9 0h.1m5.9 0h.1" }, { value: "double", label: "Double", icon: "M3 9h18M3 15h18" },
];
const EDGES: { value: EdgeStyle; label: string }[] = [
  { value: "sharp", label: "Square" }, { value: "rounded", label: "Rounded" }, { value: "pill", label: "Pill" }, { value: "cut", label: "Cut" },
];

function ColorPalette(props: { color: string; label: string; disabled: boolean; onChange: (value: string) => void }) {
  return <>
    <div class="touch-style-section-title"><strong>{props.label}</strong><label class="touch-style-custom-color" title={`Custom ${props.label.toLowerCase()}`}><input aria-label={`Custom ${props.label.toLowerCase()}`} type="color" value={props.color} disabled={props.disabled} onInput={event => props.onChange(event.currentTarget.value)} /></label></div>
    <div class="touch-style-palette" role="group" aria-label={`${props.label} palette`}>{COLORS.map(color => <button class={`touch-style-swatch ${props.color.toLowerCase() === color ? "active" : ""}`} style={{ "--swatch": color }} title={color} aria-label={`Use ${color}`} aria-pressed={props.color.toLowerCase() === color} disabled={props.disabled} onClick={() => props.onChange(color)} />)}</div>
  </>;
}

export function TouchStylePanel(props: Props) {
  const toolLabel = () => props.tool === "pen" ? (BRUSHES.find(item => item.value === props.brushMode)?.label ?? "Pen") : `${props.styleName.charAt(0).toUpperCase()}${props.styleName.slice(1)}`;
  return <section class="touch-style-panel" role="dialog" aria-label={`Tool style for ${toolLabel()}`}>
    <header class="touch-style-header">
      <div class="touch-style-title"><span>TOOL STYLE</span><strong>{toolLabel()}</strong></div>
      <button class="touch-style-close" aria-label="Close style panel" onClick={props.onClose}><svg viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"/></svg></button>
    </header>
    <div class="touch-style-content">
      {(props.supportsStroke || props.supportsWidth) && <section class="touch-style-section">
        {props.supportsStroke && <ColorPalette color={props.color} label="Stroke color" disabled={props.locked} onChange={props.onColorChange} />}
        {props.supportsWidth && <><div class="touch-style-section-title"><strong>Stroke width</strong><span>{props.width} px</span></div>
          {(props.tool === "pen" || props.styleName === "freehand") ? props.thicknessPickerMode === "presets" ?
            <div class="touch-style-widths" role="group" aria-label="Stroke width presets">{WIDTHS.map(width => <button class={props.width === width ? "active" : ""} aria-label={`${width} pixels`} aria-pressed={props.width === width} disabled={props.locked} onClick={() => props.onWidthChange(width)}><i style={{ height: `${Math.min(12, Math.max(2, width))}px` }} /></button>)}</div> :
            <ThicknessTuner value={props.width} color={props.color} disabled={props.locked} onChange={props.onWidthChange} /> :
            <><div class="touch-style-widths" role="group" aria-label="Stroke width presets">{WIDTHS.map(width => <button class={props.width === width ? "active" : ""} aria-label={`${width} pixels`} aria-pressed={props.width === width} disabled={props.locked} onClick={() => props.onWidthChange(width)}><i style={{ height: `${Math.min(12, Math.max(2, width))}px` }} /></button>)}</div>
              <input class="touch-style-range" aria-label="Stroke width" type="range" min="1" max="24" step="1" value={props.width} disabled={props.locked} onInput={event => props.onWidthChange(Number(event.currentTarget.value))} /></>}</>}
      </section>}

      {props.tool === "pen" && <section class="touch-style-section"><div class="touch-style-section-title"><strong>Pen and brush</strong></div><div class="touch-brush-grid">{BRUSHES.map(brush => <button class={props.brushMode === brush.value ? "active" : ""} aria-pressed={props.brushMode === brush.value} disabled={props.locked} onClick={() => props.onBrushModeChange(brush.value)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d={brush.value === "fine" ? "m5 18 13-12M4 21h16" : brush.value === "pencil" ? "m5 19 11-11 3 3L8 22H5zm10-13 2-2 4 4-2 2" : brush.value === "brush" ? "M5 17c4 0 3-7 8-7 4 0 4 4 7 4M5 20h14" : brush.value === "marker" ? "M5 18 17 6l3 3L8 21H5zm9-9 3 3" : brush.value === "highlighter" ? "M4 16 15 5l5 5-11 11H4zm4-2 5 5" : "M5 18 17 6m-8 12 2 2M4 21h16"}/></svg><span>{brush.label}</span></button>)}</div><div class="touch-style-subsection"><strong>Stylus input</strong><label class="touch-style-check"><input type="checkbox" checked={props.penPressure} onChange={event => props.onPenPressureChange(event.currentTarget.checked)} /> Pressure width</label><label class="touch-style-check"><input type="checkbox" checked={props.penTilt} onChange={event => props.onPenTiltChange(event.currentTarget.checked)} /> Tilt shaping</label><label class="touch-style-check"><input type="checkbox" checked={props.penEraser} onChange={event => props.onPenEraserChange(event.currentTarget.checked)} /> Stylus eraser end</label></div></section>}

      {props.supportsLineStyle && <section class="touch-style-section"><div class="touch-style-section-title"><strong>Line style</strong></div><div class="touch-line-style-grid">{LINE_STYLES.filter(style => style.value !== "double" || props.isLine || props.isArrow).map(style => <button class={props.lineStyle === style.value ? "active" : ""} aria-pressed={props.lineStyle === style.value} disabled={props.locked} onClick={() => props.onLineStyleChange(style.value)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d={style.icon}/></svg><span>{style.label}</span></button>)}</div></section>}

      {props.supportsFill && <section class="touch-style-section"><div class="touch-style-section-title"><strong>Shape fill</strong></div><label class="touch-style-switch"><span>{props.fillEnabled ? "Solid fill" : "No fill"}</span><input type="checkbox" checked={props.fillEnabled} disabled={props.locked} onChange={event => props.onFillEnabledChange(event.currentTarget.checked)} /></label>{props.fillEnabled && <><ColorPalette color={props.fillColor} label="Fill color" disabled={props.locked} onChange={props.onFillColorChange} /><label class="touch-style-range-label">Fill opacity <span>{Math.round(props.fillOpacity * 100)}%</span><input class="touch-style-range" type="range" min="5" max="100" value={Math.round(props.fillOpacity * 100)} disabled={props.locked} onInput={event => props.onFillOpacityChange(Number(event.currentTarget.value) / 100)} /></label></>}</section>}

      {props.supportsCorners && <section class="touch-style-section"><div class="touch-style-section-title"><strong>Rectangle corners</strong></div><div class="touch-edge-grid">{EDGES.map(edge => <button class={props.edgeStyle === edge.value ? "active" : ""} aria-pressed={props.edgeStyle === edge.value} disabled={props.locked} onClick={() => props.onEdgeStyleChange(edge.value)}>{edge.label}</button>)}</div>{(props.edgeStyle === "rounded" || props.edgeStyle === "cut") && <label class="touch-style-range-label">Corner {props.edgeStyle === "cut" ? "cut" : "radius"}<span>{props.cornerRadius} px</span><input class="touch-style-range" type="range" min="0" max="64" value={props.cornerRadius} disabled={props.locked} onInput={event => props.onCornerRadiusChange(Number(event.currentTarget.value))} /></label>}</section>}

      {props.isLine && <section class="touch-style-section"><div class="touch-style-section-title"><strong>{props.straightOnly ? "Relationship endpoints" : "Line path"}</strong></div>{props.straightOnly && <small class="touch-style-hint">Drag either endpoint to resize or connect to a component.</small>}{!props.straightOnly && <div class="touch-route-grid">{props.lineRoutes.map(route => <button class={props.lineRoute === route.value ? "active" : ""} aria-pressed={props.lineRoute === route.value} disabled={props.locked} onClick={() => props.onLineRouteChange(route.value)}><svg viewBox="0 0 24 24"><path d={route.path}/></svg><span>{route.label}</span></button>)}</div>}<label class="touch-style-select">Start head<select value={props.startHead} disabled={props.locked} onChange={event => props.onConnectorHeadChange("start", event.currentTarget.value as ArrowHead)}>{props.arrowHeads.map(head => <option value={head.value}>{head.label}</option>)}</select></label><label class="touch-style-select">End head<select value={props.endHead} disabled={props.locked} onChange={event => props.onConnectorHeadChange("end", event.currentTarget.value as ArrowHead)}>{props.arrowHeads.map(head => <option value={head.value}>{head.label}</option>)}</select></label></section>}
      {props.isArrow && <section class="touch-style-section"><div class="touch-style-section-title"><strong>Arrow path</strong></div><div class="touch-route-grid">{props.arrowRoutes.map(route => <button class={props.arrowRoute === route.value ? "active" : ""} aria-pressed={props.arrowRoute === route.value} disabled={props.locked} onClick={() => props.onArrowRouteChange(route.value)}><svg viewBox="0 0 24 24"><path d={route.path}/></svg><span>{route.label}</span></button>)}</div><label class="touch-style-select">Start head<select value={props.startHead} disabled={props.locked} onChange={event => props.onConnectorHeadChange("start", event.currentTarget.value as ArrowHead)}>{props.arrowHeads.map(head => <option value={head.value}>{head.label}</option>)}</select></label><label class="touch-style-select">End head<select value={props.endHead} disabled={props.locked} onChange={event => props.onConnectorHeadChange("end", event.currentTarget.value as ArrowHead)}>{props.arrowHeads.map(head => <option value={head.value}>{head.label}</option>)}</select></label>{props.arrowRoute === "forked" && <><label class="touch-style-select">Upper branch head<select value={props.forkUpperHead} disabled={props.locked} onChange={event => props.onForkHeadChange("upper", event.currentTarget.value as ArrowHead)}>{props.arrowHeads.map(head => <option value={head.value}>{head.label}</option>)}</select></label><label class="touch-style-select">Lower branch head<select value={props.forkLowerHead} disabled={props.locked} onChange={event => props.onForkHeadChange("lower", event.currentTarget.value as ArrowHead)}>{props.arrowHeads.map(head => <option value={head.value}>{head.label}</option>)}</select></label></>}</section>}

      {props.isFlowchart && <section class="touch-style-section"><div class="touch-style-section-title"><strong>Flowchart symbol</strong></div><div class="touch-flowchart-grid">{props.flowchartShapes.map(shape => <button class={props.flowchartShape === shape.value ? "active" : ""} aria-pressed={props.flowchartShape === shape.value} disabled={props.locked} title={shape.label} onClick={() => props.onFlowchartShapeChange(shape.value)}><svg viewBox="0 0 24 24"><path d={shape.path}/></svg><span>{shape.label}</span></button>)}</div></section>}

      {props.supportsText && <section class="touch-style-section"><div class="touch-style-section-title"><strong>Text formatting</strong></div><div class="touch-text-format-row"><button class={props.bold ? "active" : ""} aria-pressed={props.bold} disabled={props.locked} onClick={() => props.onTextChange("bold", !props.bold)}><b>B</b></button><button class={props.italic ? "active" : ""} aria-pressed={props.italic} disabled={props.locked} onClick={() => props.onTextChange("italic", !props.italic)}><i>I</i></button><button class={props.underline ? "active" : ""} aria-pressed={props.underline} disabled={props.locked} onClick={() => props.onTextChange("underline", !props.underline)}><u>U</u></button></div><label class="touch-style-select">Font size<input type="number" min="8" max="160" step="1" value={props.fontSize} disabled={props.locked} onInput={event => props.onTextChange("fontSize", Math.round(Number(event.currentTarget.value)))} /></label><label class="touch-style-select">Font family<select value={props.fontFamily} disabled={props.locked} onChange={event => props.onTextChange("fontFamily", event.currentTarget.value as FontFamily)}><option value="sans">Sans</option><option value="hand">Handwritten</option><option value="serif">Serif</option><option value="mono">Monospaced</option><option value="rounded">Rounded</option><option value="display">Display</option></select></label><label class="touch-style-select">Alignment<select value={props.textAlign} disabled={props.locked} onChange={event => props.onTextChange("textAlign", event.currentTarget.value)}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option><option value="justify">Justify</option></select></label><label class="touch-style-select">Paragraphs<select value={props.listType} disabled={props.locked} onChange={event => props.onTextChange("listType", event.currentTarget.value)}><option value="none">Plain</option><option value="bullet">Bulleted list</option><option value="number">Numbered list</option></select></label></section>}

      {props.isLaser && <section class="touch-style-section"><div class="touch-style-section-title"><strong>Laser pointer</strong></div><ColorPalette color={props.laserColor} label="Laser color" disabled={false} onChange={value => props.onLaserChange("color", value)} /><label class="touch-style-range-label">Thickness <span>{props.laserThickness} px</span><input class="touch-style-range" type="range" min="1" max="24" value={props.laserThickness} onInput={event => props.onLaserChange("thickness", event.currentTarget.value)} /></label><label class="touch-style-range-label">Fade duration <span>{(props.laserFadeDuration / 1000).toFixed(1)} s</span><input class="touch-style-range" type="range" min="250" max="5000" step="250" value={props.laserFadeDuration} onInput={event => props.onLaserChange("fade", event.currentTarget.value)} /></label><label class="touch-style-check"><input type="checkbox" checked={props.laserRainbow} onChange={event => props.onLaserChange("rainbow", String(event.currentTarget.checked))} /> Rainbow color</label></section>}

      {props.isBucket && <section class="touch-style-section"><ColorPalette color={props.fillColor} label="Bucket fill color" disabled={false} onChange={props.onBucketColorChange} /></section>}

      {props.hasSelection && <section class="touch-style-section"><label class="touch-style-range-label">Selection opacity <span>{Math.round(props.selectionOpacity * 100)}%</span><input class="touch-style-range" type="range" min="10" max="100" value={Math.round(props.selectionOpacity * 100)} disabled={props.locked} onInput={event => props.onSelectionOpacityChange(Number(event.currentTarget.value) / 100)} /></label>{props.canRotate && <div class="touch-selection-rotation"><strong>Rotation</strong><button disabled={props.locked} onClick={() => props.onRotate(-15)}>−15°</button><button disabled={props.locked} onClick={props.onResetRotation}>Reset</button><button disabled={props.locked} onClick={() => props.onRotate(15)}>+15°</button></div>}</section>}
    </div>
  </section>;
}
