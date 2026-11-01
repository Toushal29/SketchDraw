import type { Element, LiveDiagramFormat, Point } from "../../model";
import { layoutMermaidFlowchart, layoutMermaidSequence, parseMermaidFlowchart, parseMermaidSequence } from "../../mermaid";
import { detectExtendedMermaidType, layoutExtendedMermaid } from "./mermaid-extended";
import { elementBounds, unionBounds } from "../canvas/bounds";
import { translateElement } from "../canvas/translate";
import { isConnector } from "../../operations";
import { plantUmlToDiagram } from "./code-formats";
import { cloudDiagramFromText } from "./cloud-diagram";
import { ORG_CHART_EXAMPLE, buildOrgChart } from "./org-chart";

export const LIVE_DIAGRAM_FORMATS: readonly { id: LiveDiagramFormat; label: string; example: string }[] = [
  { id: "mermaid", label: "Mermaid", example: "flowchart TD\n  Start([Start]) --> Check{Ready?}\n  Check -->|Yes| Done[Finish]\n  Check -->|No| Fix[Fix issues]\n  Fix --> Check\n" },
  { id: "plantuml", label: "PlantUML", example: "@startuml\nclass User {\n  id: UUID\n  name: string\n}\nclass Order {\n  id: UUID\n}\nUser \"1\" --> \"many\" Order : places\n@enduml\n" },
  { id: "d2", label: "D2", example: "client: Client\nserver: API server\ndb: Database {shape: cylinder}\nclient -> server: HTTPS\nserver -> db: SQL\n" },
  { id: "org", label: "Org chart (CSV)", example: ORG_CHART_EXAMPLE },
  { id: "cloud", label: "Cloud architecture", example: "direction right\nUsers [icon: user]\nVPC {\n  Gateway [icon: aws-api-gateway]\n  Orders [icon: aws-lambda]\n  DB [icon: aws-rds]\n}\nQueue [icon: aws-sqs]\nUsers > Gateway: HTTPS\nGateway > Orders\nOrders > DB: SQL\nOrders > Queue\n" },
];

export function isLiveDiagramFormat(value: unknown): value is LiveDiagramFormat { return LIVE_DIAGRAM_FORMATS.some(format => format.id === value); }

function prefixIds(items: Element[], prefix: string): Element[] {
  const rename = (id: string | undefined) => id ? `${prefix}:${id}` : id;
  const binding = <T extends { elementId: string } | undefined>(value: T): T => value ? { ...value, elementId: `${prefix}:${value.elementId}` } : value;
  return items.map(item => {
    const base = { ...item, id: rename(item.id) } as Element;
    if (item.type === "group") return { ...base, elements: prefixIds(item.elements, prefix) } as Element;
    if (item.type === "line" || item.type === "arrow") return { ...base, startBinding: binding(item.startBinding), endBinding: binding(item.endBinding), ...(item.forkUpper ? { forkUpper: { ...item.forkUpper, endBinding: binding(item.forkUpper.endBinding) } } : {}), ...(item.forkLower ? { forkLower: { ...item.forkLower, endBinding: binding(item.forkLower.endBinding) } } : {}) } as Element;
    return base;
  });
}

const keyFromId = (id: string | undefined) => { const at = id?.indexOf(":") ?? -1; return id && at >= 0 ? id.slice(at + 1) : undefined; };

export type LiveDiagramResult = { elements: Element[]; warnings: string[] };

/** Load the parser only when the editor is actually asked to render D2 source. */
export function loadLiveDiagramParser(format: LiveDiagramFormat): Promise<(source: string) => Element[]> | undefined {
  return format === "d2" ? import("./d2").then(module => module.d2ToDiagram) : undefined;
}

/**
 * Turns diagram code into editable canvas objects centered on `center`. Every object is tagged with the live
 * session so the next edit can replace it, and the first carries the source so the editor can reopen from the file.
 */
export function generateLiveDiagram(format: LiveDiagramFormat, source: string, center: Point, sessionId: string, d2Parser?: (source: string) => Element[]): LiveDiagramResult {
  let elements: Element[]; let warnings: string[] = [];
  if (format === "mermaid") {
    const extended = detectExtendedMermaidType(source);
    elements = /^\s*sequenceDiagram\b/im.test(source) ? layoutMermaidSequence(parseMermaidSequence(source), center) : extended ? layoutExtendedMermaid(source, center).elements : layoutMermaidFlowchart(parseMermaidFlowchart(source), center);
  }
  else if (format === "org") { const built = buildOrgChart(source, center); elements = built.elements; warnings = built.warnings; }
  else if (format === "cloud") { const built = cloudDiagramFromText(source, center); elements = built.elements; warnings = built.warnings; }
  else {
    const generated = format === "plantuml" ? plantUmlToDiagram(source) : d2Parser ? d2Parser(source) : [];
    if (format === "d2" && !d2Parser) throw new Error("The D2 parser has not been loaded yet.");
    const bounds = unionBounds(generated.map(elementBounds));
    elements = bounds ? generated.map(item => translateElement(item, center.x - bounds.x - bounds.w / 2, center.y - bounds.y - bounds.h / 2)) : generated;
  }
  if (!elements.length) throw new Error("This code did not produce any shapes.");
  const keyed = elements.map(item => !item.liveKey && !isConnector(item) && keyFromId(item.id) ? { ...item, liveKey: keyFromId(item.id)!.slice(0, 100) } as Element : item);
  const prefixed = prefixIds(keyed, `live-${sessionId.slice(0, 8)}`);
  return { elements: prefixed.map((item, index) => ({ ...item, liveSourceId: sessionId, ...(index === 0 ? { liveSource: { format, source } } : {}) }) as Element), warnings };
}

const norm = (value: string) => value.trim().toLowerCase();
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function mentions(line: string, key: string): boolean {
  const clean = norm(key); if (!clean) return false;
  return new RegExp(`(^|[^\\p{L}\\p{N}_])${escapeRegExp(clean)}(?=$|[^\\p{L}\\p{N}_])`, "iu").test(line);
}
function labelOf(element: Element): string {
  if (element.type === "text") return element.text;
  if (element.type === "schemaTable") return element.name;
  if (element.type === "group") return element.container?.name ?? element.libraryComponent?.label ?? "";
  return "label" in element ? element.label?.text ?? "" : "";
}
/** Words in the source that name this object: its key first, then its visible label. */
export function liveKeysOf(element: Element): string[] {
  return [element.liveKey ?? "", labelOf(element).replace(/\s+/g, " ").trim()].filter((key, index, all) => !!key && all.indexOf(key) === index);
}

/** Roots of one session whose names appear on a source line, plus connectors between two of them. */
export function matchLineElements(elements: Element[], sessionId: string, line: string): number[] {
  const text = norm(line); if (!text) return [];
  const members = elements.map((element, index) => ({ element, index })).filter(({ element }) => element.liveSourceId === sessionId);
  const nodes = members.filter(({ element }) => !isConnector(element) && liveKeysOf(element).some(key => mentions(text, key)));
  const ids = new Set(nodes.flatMap(({ element }) => element.id ? [element.id] : []));
  const links = members.filter(({ element }) => isConnector(element) && !!element.startBinding && !!element.endBinding && ids.has(element.startBinding.elementId) && ids.has(element.endBinding.elementId));
  return [...nodes, ...links].map(({ index }) => index);
}

/** The first source line that names the object, or undefined when none does. */
export function findLineForElement(source: string, element: Element): number | undefined {
  const lines = source.split(/\r?\n/).map(norm);
  for (const key of liveKeysOf(element)) {
    const found = lines.findIndex(line => mentions(line, key));
    if (found >= 0) return found;
  }
  return undefined;
}
